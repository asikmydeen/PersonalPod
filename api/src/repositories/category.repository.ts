import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/database.service';
import {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryWithChildren,
  CategoryTreeOptions,
  MoveCategoryDto
} from '../models/category';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface CategoryRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  path: string;
  level: number;
  display_order: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class CategoryRepository {
  private tableName = 'categories';
  private entryCategoriesTableName = 'entry_categories';

  /**
   * Create a new category
   */
  async create(userId: string, data: CreateCategoryDto): Promise<Category> {
    const id = uuidv4();
    
    // Get next display order if not provided
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const maxOrderResult = await db.queryOne<{ max_order: number }>(
        `SELECT COALESCE(MAX(display_order), -1) + 1 as max_order 
         FROM ${this.tableName} 
         WHERE user_id = $1 AND parent_id ${data.parentId ? '= $2' : 'IS NULL'}`,
        data.parentId ? [userId, data.parentId] : [userId]
      );
      displayOrder = maxOrderResult?.max_order || 0;
    }

    const query = `
      INSERT INTO ${this.tableName} (
        id, user_id, name, description, color, icon,
        parent_id, path, display_order, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `;

    const values = [
      id,
      userId,
      data.name,
      data.description || null,
      data.color || null,
      data.icon || null,
      data.parentId || null,
      '', // Path will be set by trigger
      displayOrder,
      JSON.stringify(data.metadata || {})
    ];

    try {
      const result = await db.queryOne<CategoryRecord>(query, values);
      if (!result) {
        throw new AppError('Failed to create category', 500);
      }
      
      logger.info(`Category created: ${result.id} for user: ${userId}`);
      return this.mapToCategory(result);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new AppError('Category with this name already exists in this location', 409);
      }
      logger.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Find category by ID
   */
  async findById(id: string, userId: string): Promise<Category | null> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE id = $1 AND user_id = $2
    `;
    const result = await db.queryOne<CategoryRecord>(query, [id, userId]);
    return result ? this.mapToCategory(result) : null;
  }

  /**
   * List categories for user
   */
  async list(userId: string, options?: { includeInactive?: boolean }): Promise<Category[]> {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE user_id = $1
    `;
    
    if (!options?.includeInactive) {
      query += ` AND is_active = true`;
    }
    
    query += ` ORDER BY level, display_order, name`;
    
    const results = await db.query<CategoryRecord>(query, [userId]);
    return results.map(record => this.mapToCategory(record));
  }

  /**
   * Get category tree
   */
  async getTree(userId: string, options?: CategoryTreeOptions): Promise<CategoryWithChildren[]> {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE user_id = $1
    `;
    
    if (!options?.includeInactive) {
      query += ` AND is_active = true`;
    }
    
    if (options?.maxDepth !== undefined) {
      query += ` AND level <= ${options.maxDepth}`;
    }
    
    query += ` ORDER BY path, display_order`;
    
    const results = await db.query<CategoryRecord>(query, [userId]);
    const categories = results.map(record => this.mapToCategory(record));
    
    return this.buildTree(categories);
  }

  /**
   * Get category subtree
   */
  async getSubtree(categoryId: string, userId: string, options?: CategoryTreeOptions): Promise<CategoryWithChildren | null> {
    const rootCategory = await this.findById(categoryId, userId);
    if (!rootCategory) {
      return null;
    }

    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE user_id = $1 AND path LIKE $2
    `;
    
    if (!options?.includeInactive) {
      query += ` AND is_active = true`;
    }
    
    if (options?.maxDepth !== undefined) {
      query += ` AND level <= ${rootCategory.level + options.maxDepth}`;
    }
    
    query += ` ORDER BY path, display_order`;
    
    const results = await db.query<CategoryRecord>(query, [userId, `${rootCategory.path}%`]);
    const categories = results.map(record => this.mapToCategory(record));
    
    const tree = this.buildTree(categories);
    return tree.find(cat => cat.id === categoryId) || null;
  }

  /**
   * Update category
   */
  async update(id: string, userId: string, data: UpdateCategoryDto): Promise<Category | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      values.push(data.name);
      paramCount++;
    }

    if (data.description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      values.push(data.description);
      paramCount++;
    }

    if (data.color !== undefined) {
      updateFields.push(`color = $${paramCount}`);
      values.push(data.color);
      paramCount++;
    }

    if (data.icon !== undefined) {
      updateFields.push(`icon = $${paramCount}`);
      values.push(data.icon);
      paramCount++;
    }

    if (data.displayOrder !== undefined) {
      updateFields.push(`display_order = $${paramCount}`);
      values.push(data.displayOrder);
      paramCount++;
    }

    if (data.isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      values.push(data.isActive);
      paramCount++;
    }

    if (data.metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(data.metadata));
      paramCount++;
    }

    if (updateFields.length === 0 && data.parentId === undefined) {
      return await this.findById(id, userId);
    }

    // Handle parent change separately to ensure path update
    if (data.parentId !== undefined) {
      return await this.moveCategory(userId, { categoryId: id, newParentId: data.parentId });
    }

    values.push(id, userId);

    const query = `
      UPDATE ${this.tableName} 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    try {
      const result = await db.queryOne<CategoryRecord>(query, values);
      if (result) {
        logger.info(`Category updated: ${result.id}`);
      }
      return result ? this.mapToCategory(result) : null;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new AppError('Category with this name already exists in this location', 409);
      }
      logger.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Move category to new parent
   */
  async moveCategory(userId: string, data: MoveCategoryDto): Promise<Category | null> {
    const { categoryId, newParentId, newDisplayOrder } = data;

    // Prevent moving to self or descendants
    if (newParentId) {
      const isDescendant = await db.queryOne<{ is_descendant: boolean }>(
        `SELECT EXISTS(
          SELECT 1 FROM ${this.tableName} 
          WHERE id = $1 AND path LIKE $2 || '%'
        ) as is_descendant`,
        [newParentId, categoryId]
      );
      
      if (isDescendant?.is_descendant) {
        throw new AppError('Cannot move category to its own descendant', 400);
      }
    }

    const query = `
      UPDATE ${this.tableName} 
      SET parent_id = $3, 
          display_order = COALESCE($4, display_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [categoryId, userId, newParentId, newDisplayOrder];

    try {
      const result = await db.queryOne<CategoryRecord>(query, values);
      if (!result) {
        return null;
      }

      // Update paths for all descendants
      await this.updateDescendantPaths(categoryId, result.path);

      logger.info(`Category moved: ${categoryId}`);
      return this.mapToCategory(result);
    } catch (error: any) {
      logger.error('Error moving category:', error);
      throw error;
    }
  }

  /**
   * Delete category (and all descendants)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    // First, check if category exists and belongs to user
    const category = await this.findById(id, userId);
    if (!category) {
      return false;
    }

    // Delete category and all descendants (CASCADE will handle this)
    const query = `
      DELETE FROM ${this.tableName} 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await db.queryOne<{ id: string }>(query, [id, userId]);
    
    if (result) {
      logger.info(`Category deleted: ${id} and all descendants`);
    }
    
    return result !== null;
  }

  /**
   * Add entry to category
   */
  async addEntryToCategory(entryId: string, categoryId: string, userId: string): Promise<void> {
    // Verify both entry and category belong to user
    const categoryCheck = await db.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM ${this.tableName} c
        JOIN entries e ON e.user_id = c.user_id
        WHERE c.id = $1 AND e.id = $2 AND c.user_id = $3
      ) as exists`,
      [categoryId, entryId, userId]
    );

    if (!categoryCheck?.exists) {
      throw new AppError('Category or entry not found', 404);
    }

    const query = `
      INSERT INTO ${this.entryCategoriesTableName} (entry_id, category_id)
      VALUES ($1, $2)
      ON CONFLICT (entry_id, category_id) DO NOTHING
    `;

    await db.query(query, [entryId, categoryId]);
    logger.info(`Entry ${entryId} added to category ${categoryId}`);
  }

  /**
   * Remove entry from category
   */
  async removeEntryFromCategory(entryId: string, categoryId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const query = `
      DELETE FROM ${this.entryCategoriesTableName} ec
      USING ${this.tableName} c, entries e
      WHERE ec.entry_id = $1 
        AND ec.category_id = $2
        AND ec.entry_id = e.id
        AND ec.category_id = c.id
        AND e.user_id = $3
        AND c.user_id = $3
      RETURNING ec.entry_id
    `;

    const result = await db.queryOne<{ entry_id: string }>(query, [entryId, categoryId, userId]);
    
    if (result) {
      logger.info(`Entry ${entryId} removed from category ${categoryId}`);
    }
    
    return result !== null;
  }

  /**
   * Get categories for entry
   */
  async getEntryCategoryIds(entryId: string): Promise<string[]> {
    const query = `
      SELECT category_id FROM ${this.entryCategoriesTableName}
      WHERE entry_id = $1
    `;
    
    const results = await db.query<{ category_id: string }>(query, [entryId]);
    return results.map(row => row.category_id);
  }

  /**
   * Get entries in category
   */
  async getCategoryEntryIds(categoryId: string, includeDescendants: boolean = false): Promise<string[]> {
    let query: string;
    let values: any[];

    if (includeDescendants) {
      query = `
        SELECT DISTINCT ec.entry_id 
        FROM ${this.entryCategoriesTableName} ec
        JOIN ${this.tableName} c ON ec.category_id = c.id
        WHERE c.path LIKE (
          SELECT path || '%' FROM ${this.tableName} WHERE id = $1
        )
      `;
      values = [categoryId];
    } else {
      query = `
        SELECT entry_id FROM ${this.entryCategoriesTableName}
        WHERE category_id = $1
      `;
      values = [categoryId];
    }
    
    const results = await db.query<{ entry_id: string }>(query, values);
    return results.map(row => row.entry_id);
  }

  /**
   * Update descendant paths after moving a category
   */
  private async updateDescendantPaths(categoryId: string, newPath: string): Promise<void> {
    await db.query(
      `UPDATE ${this.tableName} 
       SET path = $2 || substring(path FROM length($3) + 1)
       WHERE path LIKE $3 || '/%'`,
      [categoryId, newPath, categoryId]
    );
  }

  /**
   * Build tree structure from flat list
   */
  private buildTree(categories: Category[]): CategoryWithChildren[] {
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create CategoryWithChildren objects
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree structure
    categories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }

  /**
   * Map database record to Category model
   */
  private mapToCategory(record: CategoryRecord): Category {
    return {
      id: record.id,
      userId: record.user_id,
      name: record.name,
      description: record.description || undefined,
      color: record.color || undefined,
      icon: record.icon || undefined,
      parentId: record.parent_id || undefined,
      path: record.path,
      level: record.level,
      displayOrder: record.display_order,
      isActive: record.is_active,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}

// Export singleton instance
export const categoryRepository = new CategoryRepository();
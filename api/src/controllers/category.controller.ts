import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { categoryRepository } from '../repositories/category.repository';
import { entryRepository } from '../repositories/entry.repository';
import { AppError } from '../middleware/errorHandler';
import { CreateCategoryDto, UpdateCategoryDto, MoveCategoryDto } from '../models/category';
import { logger } from '../utils/logger';

export class CategoryController {
  /**
   * Create a new category
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const dto: CreateCategoryDto = req.body;

      const category = await categoryRepository.create(userId, dto);

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category by ID
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const category = await categoryRepository.findById(id, userId);
      if (!category) {
        throw new AppError('Category not found', 404);
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all categories for user
   */
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const includeInactive = req.query.includeInactive === 'true';

      const categories = await categoryRepository.list(userId, { includeInactive });

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category tree
   */
  async getTree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const includeInactive = req.query.includeInactive === 'true';
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : undefined;

      const tree = await categoryRepository.getTree(userId, { includeInactive, maxDepth });

      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category subtree
   */
  async getSubtree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const includeInactive = req.query.includeInactive === 'true';
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : undefined;

      const subtree = await categoryRepository.getSubtree(id, userId, { includeInactive, maxDepth });
      if (!subtree) {
        throw new AppError('Category not found', 404);
      }

      res.json({
        success: true,
        data: subtree
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update category
   */
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const dto: UpdateCategoryDto = req.body;

      const category = await categoryRepository.update(id, userId, dto);
      if (!category) {
        throw new AppError('Category not found', 404);
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move category to new parent
   */
  async move(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { newParentId, newDisplayOrder } = req.body;

      const dto: MoveCategoryDto = {
        categoryId: id,
        newParentId,
        newDisplayOrder
      };

      const category = await categoryRepository.moveCategory(userId, dto);
      if (!category) {
        throw new AppError('Category not found', 404);
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete category
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const deleted = await categoryRepository.delete(id, userId);
      if (!deleted) {
        throw new AppError('Category not found', 404);
      }

      res.json({
        success: true,
        message: 'Category and all its subcategories deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add entry to category
   */
  async addEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: categoryId } = req.params;
      const { entryId } = req.body;
      const userId = req.user!.id;

      if (!entryId) {
        throw new AppError('Entry ID is required', 400);
      }

      await categoryRepository.addEntryToCategory(entryId, categoryId, userId);

      res.json({
        success: true,
        message: 'Entry added to category successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove entry from category
   */
  async removeEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: categoryId, entryId } = req.params;
      const userId = req.user!.id;

      const removed = await categoryRepository.removeEntryFromCategory(entryId, categoryId, userId);
      if (!removed) {
        throw new AppError('Entry not found in category', 404);
      }

      res.json({
        success: true,
        message: 'Entry removed from category successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get entries in category
   */
  async getEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: categoryId } = req.params;
      const userId = req.user!.id;
      const includeDescendants = req.query.includeDescendants === 'true';
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // Verify category belongs to user
      const category = await categoryRepository.findById(categoryId, userId);
      if (!category) {
        throw new AppError('Category not found', 404);
      }

      // Get entry IDs in category
      const entryIds = await categoryRepository.getCategoryEntryIds(categoryId, includeDescendants);

      // If no entries, return empty result
      if (entryIds.length === 0) {
        res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0
          }
        });
        return;
      }

      // Get entries with pagination
      const startIndex = (page - 1) * limit;
      const paginatedIds = entryIds.slice(startIndex, startIndex + limit);
      
      // Fetch full entry details
      const entries = await Promise.all(
        paginatedIds.map(id => entryRepository.findById(id, userId))
      );

      res.json({
        success: true,
        data: entries.filter(entry => entry !== null),
        pagination: {
          total: entryIds.length,
          page,
          limit,
          totalPages: Math.ceil(entryIds.length / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get entry's categories
   */
  async getEntryCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const userId = req.user!.id;

      // Verify entry belongs to user
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      // Get category IDs
      const categoryIds = await categoryRepository.getEntryCategoryIds(entryId);

      // Fetch full category details
      const categories = await Promise.all(
        categoryIds.map(id => categoryRepository.findById(id, userId))
      );

      res.json({
        success: true,
        data: categories.filter(cat => cat !== null)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set entry categories (replace all)
   */
  async setEntryCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const { categoryIds } = req.body;
      const userId = req.user!.id;

      if (!Array.isArray(categoryIds)) {
        throw new AppError('Category IDs must be an array', 400);
      }

      // Verify entry belongs to user
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      // Get current categories
      const currentCategoryIds = await categoryRepository.getEntryCategoryIds(entryId);

      // Remove from categories not in new list
      const toRemove = currentCategoryIds.filter(id => !categoryIds.includes(id));
      await Promise.all(
        toRemove.map(categoryId => 
          categoryRepository.removeEntryFromCategory(entryId, categoryId, userId)
        )
      );

      // Add to new categories
      const toAdd = categoryIds.filter(id => !currentCategoryIds.includes(id));
      await Promise.all(
        toAdd.map(categoryId => 
          categoryRepository.addEntryToCategory(entryId, categoryId, userId)
        )
      );

      res.json({
        success: true,
        message: 'Entry categories updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const categoryController = new CategoryController();
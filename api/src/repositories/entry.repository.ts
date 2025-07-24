import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/database.service';
import {
  Entry,
  CreateEntryDto,
  UpdateEntryDto,
  EntryListParams,
  EntryListResponse,
  EntryAttachment,
  EntryVersion,
  EntryWithAttachments,
  EntryWithVersions,
  EntryType,
  EntryStatus
} from '../models/entry';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface EntryRecord {
  id: string;
  user_id: string;
  type: EntryType;
  title: string;
  content: string | null;
  encrypted_content: string | null;
  is_encrypted: boolean;
  is_locked: boolean;
  status: EntryStatus;
  tags: string[];
  metadata: Record<string, any>;
  version: number;
  parent_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EntryAttachmentRecord {
  id: string;
  entry_id: string;
  file_name: string;
  file_size: bigint;
  mime_type: string;
  storage_key: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface EntryVersionRecord {
  id: string;
  entry_id: string;
  version: number;
  title: string;
  content: string | null;
  encrypted_content: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  created_by: string;
}

export class EntryRepository {
  private tableName = 'entries';
  private attachmentsTableName = 'entry_attachments';
  private versionsTableName = 'entry_versions';

  /**
   * Create a new entry
   */
  async create(userId: string, data: CreateEntryDto): Promise<Entry> {
    const id = uuidv4();
    
    const query = `
      INSERT INTO ${this.tableName} (
        id, user_id, type, title, content, encrypted_content,
        is_encrypted, is_locked, status, tags, metadata, parent_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING *
    `;

    const values = [
      id,
      userId,
      data.type,
      data.title,
      data.isEncrypted ? null : data.content || null,
      data.isEncrypted ? data.content || null : null,
      data.isEncrypted || false,
      data.isLocked || false,
      data.status || 'active',
      data.tags || [],
      JSON.stringify(data.metadata || {}),
      data.parentId || null
    ];

    try {
      const result = await db.queryOne<EntryRecord>(query, values);
      if (!result) {
        throw new AppError('Failed to create entry', 500);
      }
      
      // Create initial version
      await this.createVersion(result.id, result.version, result.title, result.content, result.encrypted_content, result.metadata, userId);
      
      logger.info(`Entry created: ${result.id} for user: ${userId}`);
      return this.mapToEntry(result);
    } catch (error: any) {
      logger.error('Error creating entry:', error);
      throw error;
    }
  }

  /**
   * Find entry by ID
   */
  async findById(id: string, userId: string): Promise<Entry | null> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE id = $1 AND user_id = $2 AND status != 'deleted'
    `;
    const result = await db.queryOne<EntryRecord>(query, [id, userId]);
    return result ? this.mapToEntry(result) : null;
  }

  /**
   * Find entry with attachments
   */
  async findByIdWithAttachments(id: string, userId: string): Promise<EntryWithAttachments | null> {
    const entry = await this.findById(id, userId);
    if (!entry) return null;

    const attachments = await this.getAttachments(id);
    return { ...entry, attachments };
  }

  /**
   * Find entry with versions
   */
  async findByIdWithVersions(id: string, userId: string): Promise<EntryWithVersions | null> {
    const entry = await this.findById(id, userId);
    if (!entry) return null;

    const versions = await this.getVersions(id);
    return { ...entry, versions };
  }

  /**
   * List entries with pagination and filters
   */
  async list(params: EntryListParams): Promise<EntryListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const sortBy = params.sortBy || 'created_at';
    const sortOrder = params.sortOrder || 'desc';

    let query = `SELECT * FROM ${this.tableName} WHERE user_id = $1 AND status != 'deleted'`;
    const values: any[] = [params.userId];
    let paramCount = 2;

    // Add filters
    if (params.type) {
      query += ` AND type = $${paramCount}`;
      values.push(params.type);
      paramCount++;
    }

    if (params.status) {
      query += ` AND status = $${paramCount}`;
      values.push(params.status);
      paramCount++;
    }

    if (params.parentId !== undefined) {
      if (params.parentId === null) {
        query += ` AND parent_id IS NULL`;
      } else {
        query += ` AND parent_id = $${paramCount}`;
        values.push(params.parentId);
        paramCount++;
      }
    }

    if (params.tags && params.tags.length > 0) {
      query += ` AND tags && $${paramCount}`;
      values.push(params.tags);
      paramCount++;
    }

    if (params.search) {
      query += ` AND to_tsvector('english', title || ' ' || COALESCE(content, '')) @@ plainto_tsquery('english', $${paramCount})`;
      values.push(params.search);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await db.queryOne<{ count: string }>(countQuery, values);
    const total = parseInt(countResult?.count || '0');

    // Add sorting and pagination
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const results = await db.query<EntryRecord>(query, values);
    const entries = results.map(record => this.mapToEntry(record));

    return {
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update entry
   */
  async update(id: string, userId: string, data: UpdateEntryDto): Promise<Entry | null> {
    // First, get the current entry
    const currentEntry = await this.findById(id, userId);
    if (!currentEntry) {
      return null;
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updateFields.push(`title = $${paramCount}`);
      values.push(data.title);
      paramCount++;
    }

    if (data.content !== undefined) {
      if (data.isEncrypted) {
        updateFields.push(`encrypted_content = $${paramCount}`);
        updateFields.push(`content = NULL`);
      } else {
        updateFields.push(`content = $${paramCount}`);
        updateFields.push(`encrypted_content = NULL`);
      }
      values.push(data.content);
      paramCount++;
    }

    if (data.isEncrypted !== undefined) {
      updateFields.push(`is_encrypted = $${paramCount}`);
      values.push(data.isEncrypted);
      paramCount++;
    }

    if (data.isLocked !== undefined) {
      updateFields.push(`is_locked = $${paramCount}`);
      values.push(data.isLocked);
      paramCount++;
    }

    if (data.status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(data.status);
      paramCount++;
    }

    if (data.tags !== undefined) {
      updateFields.push(`tags = $${paramCount}`);
      values.push(data.tags);
      paramCount++;
    }

    if (data.metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(data.metadata));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return currentEntry;
    }

    // Increment version
    updateFields.push(`version = version + 1`);
    values.push(id, userId);

    const query = `
      UPDATE ${this.tableName} 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    try {
      const result = await db.queryOne<EntryRecord>(query, values);
      if (!result) {
        return null;
      }

      // Create version record
      await this.createVersion(
        result.id,
        result.version,
        result.title,
        result.content,
        result.encrypted_content,
        result.metadata,
        userId
      );

      logger.info(`Entry updated: ${result.id}`);
      return this.mapToEntry(result);
    } catch (error: any) {
      logger.error('Error updating entry:', error);
      throw error;
    }
  }

  /**
   * Delete entry (soft delete)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName} 
      SET status = 'deleted', updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND user_id = $2 AND status != 'deleted'
      RETURNING id
    `;
    const result = await db.queryOne<{ id: string }>(query, [id, userId]);
    
    if (result) {
      logger.info(`Entry deleted: ${id}`);
    }
    
    return result !== null;
  }

  /**
   * Lock/unlock entry
   */
  async setLocked(id: string, userId: string, isLocked: boolean): Promise<Entry | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET is_locked = $3, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND user_id = $2 AND status != 'deleted'
      RETURNING *
    `;
    const result = await db.queryOne<EntryRecord>(query, [id, userId, isLocked]);
    
    if (result) {
      logger.info(`Entry ${isLocked ? 'locked' : 'unlocked'}: ${id}`);
    }
    
    return result ? this.mapToEntry(result) : null;
  }

  /**
   * Create entry version
   */
  private async createVersion(
    entryId: string,
    version: number,
    title: string,
    content: string | null,
    encryptedContent: string | null,
    metadata: Record<string, any>,
    createdBy: string
  ): Promise<void> {
    const query = `
      INSERT INTO ${this.versionsTableName} (
        id, entry_id, version, title, content, encrypted_content, metadata, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
    `;

    const values = [
      uuidv4(),
      entryId,
      version,
      title,
      content,
      encryptedContent,
      JSON.stringify(metadata),
      createdBy
    ];

    await db.query(query, values);
  }

  /**
   * Get entry attachments
   */
  async getAttachments(entryId: string): Promise<EntryAttachment[]> {
    const query = `SELECT * FROM ${this.attachmentsTableName} WHERE entry_id = $1 ORDER BY created_at DESC`;
    const results = await db.query<EntryAttachmentRecord>(query, [entryId]);
    return results.map(record => this.mapToAttachment(record));
  }

  /**
   * Get entry versions
   */
  async getVersions(entryId: string): Promise<EntryVersion[]> {
    const query = `SELECT * FROM ${this.versionsTableName} WHERE entry_id = $1 ORDER BY version DESC`;
    const results = await db.query<EntryVersionRecord>(query, [entryId]);
    return results.map(record => this.mapToVersion(record));
  }

  /**
   * Add attachment to entry
   */
  async addAttachment(
    entryId: string,
    userId: string,
    attachment: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      storageKey: string;
      metadata?: Record<string, any>;
    }
  ): Promise<EntryAttachment> {
    // Verify entry belongs to user
    const entry = await this.findById(entryId, userId);
    if (!entry) {
      throw new AppError('Entry not found', 404);
    }

    const id = uuidv4();
    const query = `
      INSERT INTO ${this.attachmentsTableName} (
        id, entry_id, file_name, file_size, mime_type, storage_key, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING *
    `;

    const values = [
      id,
      entryId,
      attachment.fileName,
      attachment.fileSize,
      attachment.mimeType,
      attachment.storageKey,
      JSON.stringify(attachment.metadata || {})
    ];

    const result = await db.queryOne<EntryAttachmentRecord>(query, values);
    if (!result) {
      throw new AppError('Failed to add attachment', 500);
    }

    logger.info(`Attachment added to entry: ${entryId}`);
    return this.mapToAttachment(result);
  }

  /**
   * Remove attachment
   */
  async removeAttachment(attachmentId: string, userId: string): Promise<boolean> {
    // First verify the attachment belongs to the user
    const query = `
      DELETE FROM ${this.attachmentsTableName} 
      WHERE id = $1 AND entry_id IN (
        SELECT id FROM ${this.tableName} WHERE user_id = $2
      )
      RETURNING id
    `;
    const result = await db.queryOne<{ id: string }>(query, [attachmentId, userId]);
    
    if (result) {
      logger.info(`Attachment removed: ${attachmentId}`);
    }
    
    return result !== null;
  }

  /**
   * Get popular tags for user
   */
  async getPopularTags(userId: string, limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const query = `
      SELECT tag, COUNT(*) as count
      FROM ${this.tableName}, unnest(tags) as tag
      WHERE user_id = $1 AND status != 'deleted'
      GROUP BY tag
      ORDER BY count DESC
      LIMIT $2
    `;
    
    const results = await db.query<{ tag: string; count: string }>(query, [userId, limit]);
    return results.map(row => ({
      tag: row.tag,
      count: parseInt(row.count)
    }));
  }

  /**
   * Suggest tags based on content
   */
  async suggestTags(userId: string, content: string, limit: number = 5): Promise<string[]> {
    // Get user's existing tags that match the content
    const query = `
      SELECT DISTINCT tag
      FROM ${this.tableName}, unnest(tags) as tag
      WHERE user_id = $1 
        AND status != 'deleted'
        AND to_tsvector('english', $2) @@ to_tsquery('english', tag)
      LIMIT $3
    `;
    
    const results = await db.query<{ tag: string }>(query, [userId, content, limit]);
    return results.map(row => row.tag);
  }

  /**
   * Map database record to Entry model
   */
  private mapToEntry(record: EntryRecord): Entry {
    return {
      id: record.id,
      userId: record.user_id,
      type: record.type,
      title: record.title,
      content: record.content || undefined,
      encryptedContent: record.encrypted_content || undefined,
      isEncrypted: record.is_encrypted,
      isLocked: record.is_locked,
      status: record.status,
      tags: record.tags,
      metadata: record.metadata,
      version: record.version,
      parentId: record.parent_id || undefined,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  /**
   * Map database record to EntryAttachment model
   */
  private mapToAttachment(record: EntryAttachmentRecord): EntryAttachment {
    return {
      id: record.id,
      entryId: record.entry_id,
      fileName: record.file_name,
      fileSize: Number(record.file_size),
      mimeType: record.mime_type,
      storageKey: record.storage_key,
      metadata: record.metadata,
      createdAt: record.created_at
    };
  }

  /**
   * Map database record to EntryVersion model
   */
  private mapToVersion(record: EntryVersionRecord): EntryVersion {
    return {
      id: record.id,
      entryId: record.entry_id,
      version: record.version,
      title: record.title,
      content: record.content || undefined,
      encryptedContent: record.encrypted_content || undefined,
      metadata: record.metadata,
      createdAt: record.created_at,
      createdBy: record.created_by
    };
  }
}

// Export singleton instance
export const entryRepository = new EntryRepository();
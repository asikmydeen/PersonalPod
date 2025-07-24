import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { entryRepository } from '../repositories/entry.repository';
import { AppError } from '../middleware/errorHandler';
import { CreateEntryDto, UpdateEntryDto, EntryListParams } from '../models/entry';
import { logger } from '../utils/logger';

export class EntryController {
  /**
   * Create a new entry
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const dto: CreateEntryDto = req.body;

      const entry = await entryRepository.create(userId, dto);

      res.status(201).json({
        success: true,
        data: entry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get entry by ID
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const includeAttachments = req.query.include?.includes('attachments');
      const includeVersions = req.query.include?.includes('versions');

      let entry;
      if (includeAttachments && includeVersions) {
        // Get both attachments and versions
        const entryWithAttachments = await entryRepository.findByIdWithAttachments(id, userId);
        if (!entryWithAttachments) {
          throw new AppError('Entry not found', 404);
        }
        const versions = await entryRepository.getVersions(id);
        entry = { ...entryWithAttachments, versions };
      } else if (includeAttachments) {
        entry = await entryRepository.findByIdWithAttachments(id, userId);
      } else if (includeVersions) {
        entry = await entryRepository.findByIdWithVersions(id, userId);
      } else {
        entry = await entryRepository.findById(id, userId);
      }

      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      res.json({
        success: true,
        data: entry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List entries with filters and pagination
   */
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const params: EntryListParams = {
        userId,
        type: req.query.type as any,
        status: req.query.status as any,
        tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : undefined,
        search: req.query.search as string,
        parentId: req.query.parentId as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any
      };

      // Validate pagination
      if (params.limit! > 100) {
        throw new AppError('Limit cannot exceed 100', 400);
      }

      const result = await entryRepository.list(params);

      res.json({
        success: true,
        data: result.entries,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update entry
   */
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const dto: UpdateEntryDto = req.body;

      const entry = await entryRepository.update(id, userId, dto);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      res.json({
        success: true,
        data: entry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete entry (soft delete)
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const deleted = await entryRepository.delete(id, userId);
      if (!deleted) {
        throw new AppError('Entry not found', 404);
      }

      res.json({
        success: true,
        message: 'Entry deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lock/unlock entry
   */
  async toggleLock(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { isLocked } = req.body;

      if (typeof isLocked !== 'boolean') {
        throw new AppError('isLocked must be a boolean', 400);
      }

      const entry = await entryRepository.setLocked(id, userId, isLocked);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      res.json({
        success: true,
        data: entry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search entries
   */
  async search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { q, type, status, tags, page = 1, limit = 20 } = req.query;

      if (!q) {
        throw new AppError('Search query is required', 400);
      }

      const params: EntryListParams = {
        userId,
        search: q as string,
        type: type as any,
        status: status as any,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      const result = await entryRepository.list(params);

      res.json({
        success: true,
        data: result.entries,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get entry attachments
   */
  async getAttachments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify entry belongs to user
      const entry = await entryRepository.findById(id, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      const attachments = await entryRepository.getAttachments(id);

      res.json({
        success: true,
        data: attachments
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get entry versions
   */
  async getVersions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify entry belongs to user
      const entry = await entryRepository.findById(id, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      const versions = await entryRepository.getVersions(id);

      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get popular tags
   */
  async getPopularTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const tags = await entryRepository.getPopularTags(userId, limit);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tag suggestions based on content
   */
  async suggestTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { content } = req.body;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      if (!content) {
        throw new AppError('Content is required for tag suggestions', 400);
      }

      const suggestions = await entryRepository.suggestTags(userId, content, limit);

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const entryController = new EntryController();
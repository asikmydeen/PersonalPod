import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { tagRepository } from '../repositories/tag.repository';
import { entryRepository } from '../repositories/entry.repository';
import { AppError } from '../middleware/errorHandler';
import { RenameTagDto, MergeTagsDto } from '../models/tag';
import { logger } from '../utils/logger';

export class TagController {
  /**
   * Get all tags
   */
  async getAllTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tags = await tagRepository.getAllTags(userId);

      res.json({
        success: true,
        data: tags
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

      const tags = await tagRepository.getPopularTags(userId, limit);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent tags
   */
  async getRecentTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const tags = await tagRepository.getRecentTags(userId, limit);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tag statistics
   */
  async getTagStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const stats = await tagRepository.getTagStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search tags
   */
  async searchTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { q } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      if (!q) {
        throw new AppError('Search query is required', 400);
      }

      const tags = await tagRepository.searchTags(userId, q as string, limit);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tag suggestions
   */
  async getSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const { content, existingTags } = req.body;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      const suggestions = await tagRepository.getSuggestions(
        userId, 
        content || '', 
        existingTags || [], 
        limit
      );

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rename a tag
   */
  async renameTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const dto: RenameTagDto = req.body;

      // Validate old tag exists
      const allTags = await tagRepository.getAllTags(userId);
      if (!allTags.includes(dto.oldTag)) {
        throw new AppError('Tag not found', 404);
      }

      // Validate new tag name
      const validation = tagRepository.validateTagName(dto.newTag);
      if (!validation.valid) {
        throw new AppError(validation.error!, 400);
      }

      const affectedEntries = await tagRepository.renameTag(userId, dto);

      res.json({
        success: true,
        message: `Tag renamed successfully`,
        data: {
          oldTag: dto.oldTag,
          newTag: dto.newTag,
          affectedEntries
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Merge tags
   */
  async mergeTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const dto: MergeTagsDto = req.body;

      // Validate all tags exist
      const allTags = await tagRepository.getAllTags(userId);
      const missingTags = dto.sourceTags.filter(tag => !allTags.includes(tag));
      if (missingTags.length > 0) {
        throw new AppError(`Tags not found: ${missingTags.join(', ')}`, 404);
      }

      // Validate target tag
      const validation = tagRepository.validateTagName(dto.targetTag);
      if (!validation.valid) {
        throw new AppError(validation.error!, 400);
      }

      const affectedEntries = await tagRepository.mergeTags(userId, dto);

      res.json({
        success: true,
        message: `Tags merged successfully`,
        data: {
          sourceTags: dto.sourceTags,
          targetTag: dto.targetTag,
          affectedEntries
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a tag
   */
  async deleteTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tag } = req.params;
      const userId = req.user!.id;

      // Validate tag exists
      const allTags = await tagRepository.getAllTags(userId);
      if (!allTags.includes(tag)) {
        throw new AppError('Tag not found', 404);
      }

      const affectedEntries = await tagRepository.deleteTag(userId, tag);

      res.json({
        success: true,
        message: `Tag deleted successfully`,
        data: {
          tag,
          affectedEntries
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get entries by tag
   */
  async getEntriesByTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tag } = req.params;
      const userId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // Validate tag exists
      const allTags = await tagRepository.getAllTags(userId);
      if (!allTags.includes(tag)) {
        throw new AppError('Tag not found', 404);
      }

      const { entryIds, total } = await tagRepository.getEntriesByTag(userId, tag, page, limit);

      // Fetch full entry details
      const entries = await Promise.all(
        entryIds.map(id => entryRepository.findById(id, userId))
      );

      res.json({
        success: true,
        data: entries.filter(entry => entry !== null),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate tag names
   */
  async validateTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        throw new AppError('Tags must be an array', 400);
      }

      const results = tags.map(tag => ({
        tag,
        ...tagRepository.validateTagName(tag)
      }));

      const allValid = results.every(r => r.valid);

      res.json({
        success: true,
        data: {
          allValid,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const tagController = new TagController();
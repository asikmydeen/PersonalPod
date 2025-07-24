import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { searchService, SearchOptions } from '../services/search.service';
import { entryRepository } from '../repositories/entry.repository';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class SearchController {
  /**
   * Search entries with advanced filtering
   */
  async searchEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const {
        q,
        type,
        status,
        tags,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
        highlight = true,
        fuzzy = true,
      } = req.query;

      if (!q) {
        throw new AppError('Search query is required', 400);
      }

      const options: SearchOptions = {
        query: q as string,
        userId,
        type: type as string,
        status: status as string,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        highlight: highlight === 'true' || highlight === true,
        fuzzy: fuzzy === 'true' || fuzzy === true,
      };

      const result = await searchService.searchEntries(options);

      res.json({
        success: true,
        data: result.entries,
        meta: {
          total: result.total,
          page: options.page,
          limit: options.limit,
          totalPages: Math.ceil(result.total / options.limit!),
          took: result.took,
        },
        aggregations: result.aggregations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { prefix } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      if (!prefix) {
        throw new AppError('Prefix is required', 400);
      }

      const suggestions = await searchService.getSuggestions(
        prefix as string,
        userId,
        limit
      );

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Find similar entries
   */
  async findSimilar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      // Verify entry belongs to user
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      const result = await searchService.findSimilarEntries(entryId, userId, limit);

      res.json({
        success: true,
        data: result.entries,
        meta: {
          total: result.total,
          took: result.took,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reindex all user entries
   */
  async reindexEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // Get all user entries
      const allEntriesResult = await entryRepository.list({
        userId,
        limit: 10000, // Max limit for reindexing
        page: 1,
      });

      // Reindex in search service
      await searchService.reindexUserEntries(userId, allEntriesResult.entries);

      res.json({
        success: true,
        message: `Successfully reindexed ${allEntriesResult.total} entries`,
        data: {
          totalEntries: allEntriesResult.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get search stats
   */
  async getSearchStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // Perform an aggregation-only search
      const result = await searchService.searchEntries({
        query: '*',
        userId,
        limit: 0, // We only want aggregations
      });

      res.json({
        success: true,
        data: {
          aggregations: result.aggregations,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check search service health
   */
  async healthCheck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isHealthy = await searchService.healthCheck();

      res.json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          service: 'opensearch',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const searchController = new SearchController();
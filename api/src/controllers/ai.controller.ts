import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { aiService } from '../services/ai.service';
import { entryRepository } from '../repositories/entry.repository';
import { categoryRepository } from '../repositories/category.repository';
import { AppError } from '../middleware/errorHandler';
import { SmartCategorizationRequest } from '../models/ai';
import { logger } from '../utils/logger';

export class AIController {
  /**
   * Analyze entry content
   */
  async analyzeEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const userId = req.user!.id;

      // Get entry
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      // Check if entry has content to analyze
      if (!entry.content && !entry.title) {
        throw new AppError('Entry has no content to analyze', 400);
      }

      // Perform analysis
      const analysis = await aiService.analyzeContent(entry);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get smart categorization suggestions
   */
  async smartCategorization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const { entryId, title, content } = req.body;

      // Get user's categories
      const userCategories = await categoryRepository.list(userId);

      const request: SmartCategorizationRequest = {
        entryId,
        title,
        content,
        userCategories: userCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
        })),
      };

      const response = await aiService.smartCategorization(request);

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get content insights
   */
  async getInsights(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const period = req.query.period as any || 'month';

      if (!['day', 'week', 'month', 'year'].includes(period)) {
        throw new AppError('Invalid period. Must be one of: day, week, month, year', 400);
      }

      const insights = await aiService.getContentInsights(userId, period);

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get similar entries
   */
  async getSimilarEntries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      // Verify entry belongs to user
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      const recommendations = await aiService.findSimilarEntries(entryId, userId, limit);

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate entry summary
   */
  async generateSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const userId = req.user!.id;
      const maxLength = req.query.maxLength ? parseInt(req.query.maxLength as string) : 150;

      // Get entry
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      if (!entry.content) {
        throw new AppError('Entry has no content to summarize', 400);
      }

      const summary = await aiService.generateSummary(entry.content, maxLength);

      res.json({
        success: true,
        data: {
          entryId,
          summary,
          originalLength: entry.content.length,
          summaryLength: summary.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch analyze entries
   */
  async batchAnalyze(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const { entryIds } = req.body;

      // Verify all entries belong to user
      const analyses = [];
      const errors: any[] = [];

      for (const entryId of entryIds) {
        try {
          const entry = await entryRepository.findById(entryId, userId);
          if (!entry) {
            errors.push({ entryId, error: 'Entry not found' });
            continue;
          }

          if (!entry.content && !entry.title) {
            errors.push({ entryId, error: 'No content to analyze' });
            continue;
          }

          const analysis = await aiService.analyzeContent(entry);
          analyses.push(analysis);
        } catch (error: any) {
          errors.push({ entryId, error: error.message });
        }
      }

      res.json({
        success: true,
        data: {
          analyses,
          errors,
          totalProcessed: analyses.length,
          totalErrors: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sentiment trends
   */
  async getSentimentTrends(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      // Get entries for the period
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const entries = await entryRepository.list({
        userId,
        page: 1,
        limit: 1000,
      });

      // Group by date and calculate average sentiment
      const sentimentByDate = new Map<string, {
        positive: number;
        negative: number;
        neutral: number;
        count: number;
      }>();

      // This would typically load from cached analysis results
      entries.entries.forEach(entry => {
        if (entry.createdAt >= startDate && entry.createdAt <= endDate) {
          const dateKey = entry.createdAt.toISOString().split('T')[0];
          
          if (!sentimentByDate.has(dateKey)) {
            sentimentByDate.set(dateKey, {
              positive: 0,
              negative: 0,
              neutral: 0,
              count: 0,
            });
          }
          
          const data = sentimentByDate.get(dateKey)!;
          data.count++;
          // In production, these values would come from stored analysis
          data.positive += 0.33;
          data.negative += 0.33;
          data.neutral += 0.34;
        }
      });

      // Calculate averages
      const trends = Array.from(sentimentByDate.entries()).map(([date, data]) => ({
        date,
        sentiment: {
          positive: data.positive / data.count,
          negative: data.negative / data.count,
          neutral: data.neutral / data.count,
        },
        entryCount: data.count,
      })).sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        success: true,
        data: {
          trends,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            days,
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const aiController = new AIController();
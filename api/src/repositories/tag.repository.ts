import { db } from '../services/database.service';
import { Tag, TagStats, TagSuggestion, RenameTagDto, MergeTagsDto } from '../models/tag';
import { logger } from '../utils/logger';

export class TagRepository {
  private entriesTableName = 'entries';

  /**
   * Get all tags for a user
   */
  async getAllTags(userId: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT unnest(tags) as tag
      FROM ${this.entriesTableName}
      WHERE user_id = $1 AND status != 'deleted'
      ORDER BY tag
    `;
    
    const results = await db.query<{ tag: string }>(query, [userId]);
    return results.map(row => row.tag);
  }

  /**
   * Get popular tags with usage count
   */
  async getPopularTags(userId: string, limit: number = 20): Promise<Tag[]> {
    const query = `
      SELECT tag, COUNT(*) as count
      FROM ${this.entriesTableName}, unnest(tags) as tag
      WHERE user_id = $1 AND status != 'deleted'
      GROUP BY tag
      ORDER BY count DESC, tag
      LIMIT $2
    `;
    
    const results = await db.query<{ tag: string; count: string }>(query, [userId, limit]);
    return results.map(row => ({
      name: row.tag,
      count: parseInt(row.count)
    }));
  }

  /**
   * Get recent tags
   */
  async getRecentTags(userId: string, limit: number = 10): Promise<Tag[]> {
    const query = `
      WITH recent_entries AS (
        SELECT DISTINCT ON (unnest(tags)) 
          unnest(tags) as tag, 
          MAX(created_at) as last_used
        FROM ${this.entriesTableName}
        WHERE user_id = $1 AND status != 'deleted'
        GROUP BY tag
        ORDER BY tag, last_used DESC
      )
      SELECT tag, 
        (SELECT COUNT(*) FROM ${this.entriesTableName} e 
         WHERE e.user_id = $1 AND $2 = ANY(e.tags) AND e.status != 'deleted') as count,
        last_used
      FROM recent_entries
      ORDER BY last_used DESC
      LIMIT $3
    `;
    
    const results = await db.query<{ tag: string; count: string; last_used: Date }>(
      query.replace('$2', 'recent_entries.tag'), 
      [userId, limit]
    );
    
    return results.map(row => ({
      name: row.tag,
      count: parseInt(row.count),
      lastUsed: row.last_used
    }));
  }

  /**
   * Get tag statistics
   */
  async getTagStats(userId: string): Promise<TagStats> {
    // Get total tag usage count
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM ${this.entriesTableName}, unnest(tags)
      WHERE user_id = $1 AND status != 'deleted'
    `;
    const totalResult = await db.queryOne<{ total: string }>(totalQuery, [userId]);
    const totalTags = parseInt(totalResult?.total || '0');

    // Get unique tags count
    const uniqueQuery = `
      SELECT COUNT(DISTINCT tag) as unique_count
      FROM ${this.entriesTableName}, unnest(tags) as tag
      WHERE user_id = $1 AND status != 'deleted'
    `;
    const uniqueResult = await db.queryOne<{ unique_count: string }>(uniqueQuery, [userId]);
    const uniqueTags = parseInt(uniqueResult?.unique_count || '0');

    // Get most used and recent tags
    const [mostUsedTags, recentTags] = await Promise.all([
      this.getPopularTags(userId, 10),
      this.getRecentTags(userId, 10)
    ]);

    return {
      totalTags,
      uniqueTags,
      mostUsedTags,
      recentTags
    };
  }

  /**
   * Search tags
   */
  async searchTags(userId: string, searchTerm: string, limit: number = 20): Promise<Tag[]> {
    const query = `
      SELECT tag, COUNT(*) as count
      FROM ${this.entriesTableName}, unnest(tags) as tag
      WHERE user_id = $1 
        AND status != 'deleted'
        AND tag ILIKE $2
      GROUP BY tag
      ORDER BY 
        CASE WHEN tag ILIKE $3 THEN 0 ELSE 1 END, -- Exact matches first
        count DESC, 
        tag
      LIMIT $4
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const exactPattern = searchTerm;
    
    const results = await db.query<{ tag: string; count: string }>(
      query, 
      [userId, searchPattern, exactPattern, limit]
    );
    
    return results.map(row => ({
      name: row.tag,
      count: parseInt(row.count)
    }));
  }

  /**
   * Get tag suggestions based on content and history
   */
  async getSuggestions(
    userId: string, 
    content: string, 
    existingTags: string[] = [], 
    limit: number = 5
  ): Promise<TagSuggestion[]> {
    const suggestions: TagSuggestion[] = [];
    
    // 1. Get suggestions from content analysis (using PostgreSQL full-text search)
    const contentQuery = `
      SELECT DISTINCT tag, COUNT(*) as score
      FROM ${this.entriesTableName}, unnest(tags) as tag
      WHERE user_id = $1 
        AND status != 'deleted'
        AND to_tsvector('english', content) @@ plainto_tsquery('english', tag)
        AND tag != ALL($2)
      GROUP BY tag
      ORDER BY score DESC
      LIMIT $3
    `;
    
    const contentResults = await db.query<{ tag: string; score: string }>(
      contentQuery, 
      [userId, existingTags, limit]
    );
    
    contentResults.forEach(row => {
      suggestions.push({
        tag: row.tag,
        score: parseInt(row.score),
        source: 'content'
      });
    });

    // 2. Get suggestions from frequently used together tags
    if (existingTags.length > 0) {
      const cooccurrenceQuery = `
        SELECT tag, COUNT(*) as score
        FROM ${this.entriesTableName}, unnest(tags) as tag
        WHERE user_id = $1 
          AND status != 'deleted'
          AND tags && $2
          AND tag != ALL($2)
        GROUP BY tag
        ORDER BY score DESC
        LIMIT $3
      `;
      
      const cooccurrenceResults = await db.query<{ tag: string; score: string }>(
        cooccurrenceQuery, 
        [userId, existingTags, limit]
      );
      
      cooccurrenceResults.forEach(row => {
        const existing = suggestions.find(s => s.tag === row.tag);
        if (existing) {
          existing.score += parseInt(row.score);
        } else {
          suggestions.push({
            tag: row.tag,
            score: parseInt(row.score),
            source: 'similar'
          });
        }
      });
    }

    // 3. Add popular tags if not enough suggestions
    if (suggestions.length < limit) {
      const popularQuery = `
        SELECT tag, COUNT(*) as score
        FROM ${this.entriesTableName}, unnest(tags) as tag
        WHERE user_id = $1 
          AND status != 'deleted'
          AND tag != ALL($2)
        GROUP BY tag
        ORDER BY score DESC
        LIMIT $3
      `;
      
      const popularResults = await db.query<{ tag: string; score: string }>(
        popularQuery, 
        [userId, existingTags.concat(suggestions.map(s => s.tag)), limit - suggestions.length]
      );
      
      popularResults.forEach(row => {
        suggestions.push({
          tag: row.tag,
          score: parseInt(row.score),
          source: 'history'
        });
      });
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Rename a tag across all entries
   */
  async renameTag(userId: string, data: RenameTagDto): Promise<number> {
    const { oldTag, newTag } = data;
    
    // Update all entries that have the old tag
    const query = `
      UPDATE ${this.entriesTableName}
      SET tags = array_replace(tags, $2, $3),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 
        AND $2 = ANY(tags)
        AND status != 'deleted'
    `;
    
    const result = await db.query(query, [userId, oldTag, newTag]);
    const affectedRows = result.length;
    
    logger.info(`Tag renamed from "${oldTag}" to "${newTag}" for user ${userId}, affected ${affectedRows} entries`);
    return affectedRows;
  }

  /**
   * Merge multiple tags into one
   */
  async mergeTags(userId: string, data: MergeTagsDto): Promise<number> {
    const { sourceTags, targetTag } = data;
    
    // For each source tag, replace it with the target tag
    let totalAffected = 0;
    
    for (const sourceTag of sourceTags) {
      if (sourceTag !== targetTag) {
        // First, remove duplicates that might be created
        const dedupeQuery = `
          UPDATE ${this.entriesTableName}
          SET tags = array(SELECT DISTINCT unnest(array_replace(tags, $2, $3))),
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 
            AND $2 = ANY(tags)
            AND status != 'deleted'
        `;
        
        const result = await db.query(dedupeQuery, [userId, sourceTag, targetTag]);
        totalAffected += result.length;
      }
    }
    
    logger.info(`Merged ${sourceTags.length} tags into "${targetTag}" for user ${userId}, affected ${totalAffected} entries`);
    return totalAffected;
  }

  /**
   * Delete a tag from all entries
   */
  async deleteTag(userId: string, tag: string): Promise<number> {
    const query = `
      UPDATE ${this.entriesTableName}
      SET tags = array_remove(tags, $2),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 
        AND $2 = ANY(tags)
        AND status != 'deleted'
    `;
    
    const result = await db.query(query, [userId, tag]);
    const affectedRows = result.length;
    
    logger.info(`Tag "${tag}" deleted for user ${userId}, affected ${affectedRows} entries`);
    return affectedRows;
  }

  /**
   * Get entries by tag
   */
  async getEntriesByTag(userId: string, tag: string, page: number = 1, limit: number = 20): Promise<{
    entryIds: string[];
    total: number;
  }> {
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.entriesTableName}
      WHERE user_id = $1 
        AND $2 = ANY(tags)
        AND status != 'deleted'
    `;
    const countResult = await db.queryOne<{ total: string }>(countQuery, [userId, tag]);
    const total = parseInt(countResult?.total || '0');

    // Get paginated entry IDs
    const offset = (page - 1) * limit;
    const query = `
      SELECT id
      FROM ${this.entriesTableName}
      WHERE user_id = $1 
        AND $2 = ANY(tags)
        AND status != 'deleted'
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const results = await db.query<{ id: string }>(query, [userId, tag, limit, offset]);
    const entryIds = results.map(row => row.id);

    return { entryIds, total };
  }

  /**
   * Validate tag name
   */
  validateTagName(tag: string): { valid: boolean; error?: string } {
    if (!tag || tag.trim().length === 0) {
      return { valid: false, error: 'Tag cannot be empty' };
    }
    
    if (tag.length > 50) {
      return { valid: false, error: 'Tag cannot exceed 50 characters' };
    }
    
    // Check for invalid characters (optional - adjust based on requirements)
    const invalidChars = /[<>\"]/;
    if (invalidChars.test(tag)) {
      return { valid: false, error: 'Tag contains invalid characters' };
    }
    
    return { valid: true };
  }

  /**
   * Normalize tag (trim, lowercase, etc.)
   */
  normalizeTag(tag: string): string {
    return tag.trim().toLowerCase();
  }
}

// Export singleton instance
export const tagRepository = new TagRepository();
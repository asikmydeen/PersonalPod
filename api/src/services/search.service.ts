import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import * as AWS from 'aws-sdk';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { Entry, EntryListParams } from '../models/entry';

export interface SearchOptions {
  query: string;
  userId: string;
  type?: string;
  status?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  highlight?: boolean;
  fuzzy?: boolean;
}

export interface SearchResult {
  entries: SearchHit[];
  total: number;
  took: number;
  aggregations?: any;
}

export interface SearchHit {
  id: string;
  score: number;
  entry: Partial<Entry>;
  highlights?: {
    title?: string[];
    content?: string[];
  };
}

export interface SearchSuggestion {
  text: string;
  score: number;
  highlighted?: string;
}

export class SearchService {
  private client: Client;
  private indexName: string = 'entries';

  constructor() {
    const opensearchEndpoint = process.env.OPENSEARCH_ENDPOINT || '';
    
    if (!opensearchEndpoint) {
      logger.warn('OpenSearch endpoint not configured');
      return;
    }

    // Create OpenSearch client with AWS signature
    this.client = new Client({
      ...AwsSigv4Signer({
        region: config.aws.region,
        getCredentials: () => {
          return new Promise((resolve) => {
            AWS.config.getCredentials((err, credentials) => {
              if (err) {
                logger.error('Error getting AWS credentials:', err);
              }
              resolve(credentials || new AWS.Credentials({
                accessKeyId: '',
                secretAccessKey: '',
              }));
            });
          });
        },
      }),
      node: `https://${opensearchEndpoint}`,
    });
  }

  /**
   * Index an entry in OpenSearch
   */
  async indexEntry(entry: Entry): Promise<void> {
    if (!this.client) {
      logger.warn('OpenSearch client not initialized, skipping indexing');
      return;
    }

    try {
      const document = {
        id: entry.id,
        userId: entry.userId,
        type: entry.type,
        title: entry.title,
        content: entry.content || '',
        tags: entry.tags,
        status: entry.status,
        parentId: entry.parentId,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        suggest: {
          input: [entry.title, ...entry.tags].filter(Boolean),
          weight: entry.status === 'active' ? 10 : 1,
        },
      };

      await this.client.index({
        index: this.indexName,
        id: entry.id,
        body: document,
        refresh: true,
      });

      logger.info(`Entry ${entry.id} indexed successfully`);
    } catch (error) {
      logger.error('Error indexing entry:', error);
      throw new AppError('Failed to index entry', 500);
    }
  }

  /**
   * Update an entry in OpenSearch
   */
  async updateEntry(entry: Entry): Promise<void> {
    // For updates, we can just re-index the entire document
    await this.indexEntry(entry);
  }

  /**
   * Delete an entry from OpenSearch
   */
  async deleteEntry(entryId: string): Promise<void> {
    if (!this.client) {
      logger.warn('OpenSearch client not initialized, skipping deletion');
      return;
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: entryId,
        refresh: true,
      });

      logger.info(`Entry ${entryId} deleted from index`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn(`Entry ${entryId} not found in index`);
        return;
      }
      logger.error('Error deleting entry from index:', error);
      throw new AppError('Failed to delete entry from index', 500);
    }
  }

  /**
   * Search entries
   */
  async searchEntries(options: SearchOptions): Promise<SearchResult> {
    if (!this.client) {
      throw new AppError('Search service not available', 503);
    }

    const {
      query,
      userId,
      type,
      status,
      tags,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      highlight = true,
      fuzzy = true,
    } = options;

    const from = (page - 1) * limit;

    try {
      // Build query
      const must: any[] = [
        { term: { userId } },
      ];

      if (type) {
        must.push({ term: { type } });
      }

      if (status) {
        must.push({ term: { status } });
      }

      if (tags && tags.length > 0) {
        must.push({ terms: { tags } });
      }

      if (dateFrom || dateTo) {
        const range: any = {};
        if (dateFrom) range.gte = dateFrom.toISOString();
        if (dateTo) range.lte = dateTo.toISOString();
        must.push({ range: { createdAt: range } });
      }

      // Build search query
      const searchQuery = fuzzy
        ? {
            multi_match: {
              query,
              fields: ['title^3', 'content', 'tags^2'],
              fuzziness: 'AUTO',
              prefix_length: 2,
              max_expansions: 50,
            },
          }
        : {
            multi_match: {
              query,
              fields: ['title^3', 'content', 'tags^2'],
              type: 'phrase_prefix',
            },
          };

      must.push(searchQuery);

      // Build request body
      const body: any = {
        query: {
          bool: {
            must,
          },
        },
        from,
        size: limit,
        sort: [
          '_score',
          { createdAt: { order: 'desc' } },
        ],
      };

      // Add highlighting
      if (highlight) {
        body.highlight = {
          fields: {
            title: {
              fragment_size: 150,
              number_of_fragments: 1,
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
            },
            content: {
              fragment_size: 150,
              number_of_fragments: 3,
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
            },
          },
        };
      }

      // Add aggregations
      body.aggs = {
        types: {
          terms: { field: 'type' },
        },
        tags: {
          terms: { field: 'tags', size: 20 },
        },
      };

      // Execute search
      const response = await this.client.search({
        index: this.indexName,
        body,
      });

      // Format results
      const hits = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        entry: hit._source,
        highlights: hit.highlight,
      }));

      return {
        entries: hits,
        total: response.body.hits.total.value,
        took: response.body.took,
        aggregations: response.body.aggregations,
      };
    } catch (error) {
      logger.error('Error searching entries:', error);
      throw new AppError('Search failed', 500);
    }
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(prefix: string, userId: string, limit: number = 5): Promise<SearchSuggestion[]> {
    if (!this.client) {
      return [];
    }

    try {
      const body = {
        suggest: {
          'title-suggest': {
            prefix,
            completion: {
              field: 'suggest',
              size: limit,
              contexts: {
                userId: [userId],
              },
              fuzzy: {
                fuzziness: 'AUTO',
              },
            },
          },
        },
      };

      const response = await this.client.search({
        index: this.indexName,
        body,
      });

      const suggestions = response.body.suggest['title-suggest'][0].options.map((option: any) => ({
        text: option.text,
        score: option._score,
        highlighted: option.highlighted,
      }));

      return suggestions;
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Perform more like this search
   */
  async findSimilarEntries(entryId: string, userId: string, limit: number = 10): Promise<SearchResult> {
    if (!this.client) {
      throw new AppError('Search service not available', 503);
    }

    try {
      const body = {
        query: {
          bool: {
            must: [
              { term: { userId } },
              {
                more_like_this: {
                  fields: ['title', 'content', 'tags'],
                  like: [
                    {
                      _index: this.indexName,
                      _id: entryId,
                    },
                  ],
                  min_term_freq: 1,
                  max_query_terms: 25,
                  min_doc_freq: 1,
                },
              },
            ],
            must_not: [
              { term: { _id: entryId } },
            ],
          },
        },
        size: limit,
      };

      const response = await this.client.search({
        index: this.indexName,
        body,
      });

      const hits = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        entry: hit._source,
      }));

      return {
        entries: hits,
        total: response.body.hits.total.value,
        took: response.body.took,
      };
    } catch (error) {
      logger.error('Error finding similar entries:', error);
      throw new AppError('Failed to find similar entries', 500);
    }
  }

  /**
   * Reindex all entries for a user
   */
  async reindexUserEntries(userId: string, entries: Entry[]): Promise<void> {
    if (!this.client) {
      logger.warn('OpenSearch client not initialized, skipping reindexing');
      return;
    }

    try {
      // Delete all existing entries for user
      await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            term: { userId },
          },
        },
      });

      // Bulk index all entries
      const body = entries.flatMap((entry) => [
        { index: { _index: this.indexName, _id: entry.id } },
        {
          id: entry.id,
          userId: entry.userId,
          type: entry.type,
          title: entry.title,
          content: entry.content || '',
          tags: entry.tags,
          status: entry.status,
          parentId: entry.parentId,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          suggest: {
            input: [entry.title, ...entry.tags].filter(Boolean),
            weight: entry.status === 'active' ? 10 : 1,
          },
        },
      ]);

      if (body.length > 0) {
        const response = await this.client.bulk({
          body,
          refresh: true,
        });

        if (response.body.errors) {
          logger.error('Bulk indexing had errors:', response.body.items);
        }
      }

      logger.info(`Reindexed ${entries.length} entries for user ${userId}`);
    } catch (error) {
      logger.error('Error reindexing user entries:', error);
      throw new AppError('Failed to reindex entries', 500);
    }
  }

  /**
   * Check if search service is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const response = await this.client.cluster.health();
      return response.body.status === 'green' || response.body.status === 'yellow';
    } catch (error) {
      logger.error('Search service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();
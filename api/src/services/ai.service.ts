import * as AWS from 'aws-sdk';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  ContentAnalysis,
  SentimentAnalysis,
  Entity,
  KeyPhrase,
  CategorySuggestion,
  SmartCategorizationRequest,
  SmartCategorizationResponse,
  ContentInsights,
  Topic,
  ComplexityScore,
  ContentRecommendation,
  SimilarityScore
} from '../models/ai';
import { Entry } from '../models/entry';
import { Category } from '../models/category';
import { searchService } from './search.service';
import { entryRepository } from '../repositories/entry.repository';

export class AIService {
  private comprehend: AWS.Comprehend;
  private sqs: AWS.SQS;
  private aiJobQueueUrl: string;

  constructor() {
    this.comprehend = new AWS.Comprehend({
      region: config.aws.region,
    });
    this.sqs = new AWS.SQS({
      region: config.aws.region,
    });
    this.aiJobQueueUrl = process.env.JOB_QUEUE_URL || '';
  }

  /**
   * Analyze entry content using AWS Comprehend
   */
  async analyzeContent(entry: Entry): Promise<ContentAnalysis> {
    const text = `${entry.title}\n\n${entry.content || ''}`;
    
    if (!text.trim()) {
      throw new AppError('No content to analyze', 400);
    }

    try {
      // Run all analyses in parallel
      const [sentiment, entities, keyPhrases, language] = await Promise.all([
        this.analyzeSentiment(text),
        this.detectEntities(text),
        this.detectKeyPhrases(text),
        this.detectLanguage(text),
      ]);

      // Extract topics from key phrases
      const topics = this.extractTopics(keyPhrases);

      // Generate category suggestions based on analysis
      const categories = await this.suggestCategories(entry, entities, keyPhrases, topics);

      // Generate tag suggestions
      const tags = this.generateTags(entities, keyPhrases, topics);

      // Calculate reading time and complexity
      const readingTime = this.calculateReadingTime(text);
      const complexity = this.calculateComplexity(text);

      const analysis: ContentAnalysis = {
        entryId: entry.id,
        userId: entry.userId,
        sentiment,
        entities,
        keyPhrases,
        categories,
        tags,
        language,
        topics,
        readingTime,
        complexity,
        analyzedAt: new Date(),
      };

      // Queue for indexing with enhanced metadata
      await this.queueForEnhancedIndexing(entry, analysis);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing content:', error);
      throw new AppError('Failed to analyze content', 500);
    }
  }

  /**
   * Analyze sentiment using AWS Comprehend
   */
  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    const params = {
      Text: text,
      LanguageCode: 'en', // Auto-detect in production
    };

    const result = await this.comprehend.detectSentiment(params).promise();

    // Detect dominant emotion based on sentiment scores
    const emotions = this.inferEmotions(result);

    return {
      sentiment: result.Sentiment as any,
      scores: {
        positive: result.SentimentScore?.Positive || 0,
        negative: result.SentimentScore?.Negative || 0,
        neutral: result.SentimentScore?.Neutral || 0,
        mixed: result.SentimentScore?.Mixed || 0,
      },
      dominantEmotion: emotions.dominant,
      emotionScores: emotions.scores,
    };
  }

  /**
   * Detect entities in text
   */
  private async detectEntities(text: string): Promise<Entity[]> {
    const params = {
      Text: text,
      LanguageCode: 'en',
    };

    const result = await this.comprehend.detectEntities(params).promise();

    return (result.Entities || []).map(entity => ({
      text: entity.Text || '',
      type: entity.Type as any,
      score: entity.Score || 0,
      beginOffset: entity.BeginOffset || 0,
      endOffset: entity.EndOffset || 0,
    }));
  }

  /**
   * Detect key phrases in text
   */
  private async detectKeyPhrases(text: string): Promise<KeyPhrase[]> {
    const params = {
      Text: text,
      LanguageCode: 'en',
    };

    const result = await this.comprehend.detectKeyPhrases(params).promise();

    return (result.KeyPhrases || []).map(phrase => ({
      text: phrase.Text || '',
      score: phrase.Score || 0,
      beginOffset: phrase.BeginOffset || 0,
      endOffset: phrase.EndOffset || 0,
    }));
  }

  /**
   * Detect language of text
   */
  private async detectLanguage(text: string): Promise<string> {
    const params = {
      Text: text.substring(0, 5000), // Comprehend limit
    };

    const result = await this.comprehend.detectDominantLanguage(params).promise();
    const dominantLanguage = result.Languages?.[0];

    return dominantLanguage?.LanguageCode || 'en';
  }

  /**
   * Infer emotions from sentiment scores
   */
  private inferEmotions(sentimentResult: AWS.Comprehend.DetectSentimentResponse): {
    dominant?: string;
    scores: Record<string, number>;
  } {
    const scores: Record<string, number> = {};
    
    // Map sentiment to emotions
    if (sentimentResult.SentimentScore) {
      const { Positive, Negative, Neutral, Mixed } = sentimentResult.SentimentScore;
      
      // Joy correlation with positive sentiment
      scores.joy = Positive || 0;
      
      // Sadness and anger correlation with negative sentiment
      scores.sadness = (Negative || 0) * 0.6;
      scores.anger = (Negative || 0) * 0.4;
      
      // Fear correlation with mixed sentiment
      scores.fear = (Mixed || 0) * 0.5;
      
      // Neutral correlates with calm
      scores.calm = Neutral || 0;
    }

    // Find dominant emotion
    const dominant = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    return { dominant: dominant as any, scores };
  }

  /**
   * Extract topics from key phrases
   */
  private extractTopics(keyPhrases: KeyPhrase[]): Topic[] {
    // Group similar key phrases into topics
    const topicMap = new Map<string, Topic>();

    keyPhrases.forEach(phrase => {
      const normalizedText = phrase.text.toLowerCase();
      const existingTopic = Array.from(topicMap.values())
        .find(topic => this.arePhrasesRelated(normalizedText, topic.name));

      if (existingTopic) {
        existingTopic.score += phrase.score;
        existingTopic.relatedTerms.push(phrase.text);
      } else {
        topicMap.set(normalizedText, {
          name: phrase.text,
          score: phrase.score,
          relatedTerms: [],
        });
      }
    });

    return Array.from(topicMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Check if two phrases are related
   */
  private arePhrasesRelated(phrase1: string, phrase2: string): boolean {
    const words1 = new Set(phrase1.split(/\s+/));
    const words2 = new Set(phrase2.split(/\s+/));
    
    // Check for common words
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return intersection.size / union.size > 0.3;
  }

  /**
   * Suggest categories based on content analysis
   */
  private async suggestCategories(
    entry: Entry,
    entities: Entity[],
    keyPhrases: KeyPhrase[],
    topics: Topic[]
  ): Promise<CategorySuggestion[]> {
    const suggestions: CategorySuggestion[] = [];

    // Category rules based on entities
    const entityRules: Record<string, string[]> = {
      PERSON: ['People', 'Relationships', 'Social'],
      LOCATION: ['Travel', 'Places', 'Geography'],
      ORGANIZATION: ['Work', 'Business', 'Professional'],
      DATE: ['Events', 'Timeline', 'History'],
      EVENT: ['Events', 'Experiences', 'Memories'],
    };

    // Analyze entities for category suggestions
    entities.forEach(entity => {
      const potentialCategories = entityRules[entity.type] || [];
      potentialCategories.forEach(categoryName => {
        const existing = suggestions.find(s => s.name === categoryName);
        if (existing) {
          existing.confidence += entity.score * 0.2;
        } else {
          suggestions.push({
            name: categoryName,
            confidence: entity.score * 0.2,
            reason: `Contains ${entity.type.toLowerCase()}: ${entity.text}`,
          });
        }
      });
    });

    // Analyze topics for category suggestions
    const topicCategories: Record<string, string[]> = {
      health: ['Health', 'Wellness', 'Fitness'],
      work: ['Work', 'Career', 'Professional'],
      family: ['Family', 'Relationships', 'Personal'],
      travel: ['Travel', 'Adventures', 'Experiences'],
      finance: ['Finance', 'Money', 'Budget'],
      education: ['Learning', 'Education', 'Growth'],
      hobby: ['Hobbies', 'Interests', 'Leisure'],
    };

    topics.forEach(topic => {
      const topicLower = topic.name.toLowerCase();
      Object.entries(topicCategories).forEach(([keyword, categories]) => {
        if (topicLower.includes(keyword)) {
          categories.forEach(categoryName => {
            const existing = suggestions.find(s => s.name === categoryName);
            if (existing) {
              existing.confidence += topic.score * 0.3;
            } else {
              suggestions.push({
                name: categoryName,
                confidence: topic.score * 0.3,
                reason: `Related to topic: ${topic.name}`,
              });
            }
          });
        }
      });
    });

    // Sort by confidence and return top suggestions
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .filter(s => s.confidence > 0.3);
  }

  /**
   * Generate tags from analysis
   */
  private generateTags(
    entities: Entity[],
    keyPhrases: KeyPhrase[],
    topics: Topic[]
  ): string[] {
    const tags = new Set<string>();

    // Add high-confidence entities as tags
    entities
      .filter(e => e.score > 0.8 && e.type !== 'OTHER')
      .forEach(e => tags.add(e.text.toLowerCase()));

    // Add short key phrases as tags
    keyPhrases
      .filter(kp => kp.score > 0.8 && kp.text.split(' ').length <= 3)
      .forEach(kp => tags.add(kp.text.toLowerCase()));

    // Add topic names as tags
    topics
      .filter(t => t.score > 0.7)
      .forEach(t => tags.add(t.name.toLowerCase()));

    return Array.from(tags).slice(0, 10);
  }

  /**
   * Calculate reading time in minutes
   */
  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Calculate text complexity
   */
  private calculateComplexity(text: string): ComplexityScore {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);

    // Flesch Reading Ease score
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    const avgSyllablesPerWord = syllables / Math.max(words.length, 1);
    const readabilityScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

    // Grade level (Flesch-Kincaid)
    const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

    // Vocabulary complexity
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyRichness = uniqueWords.size / words.length;
    
    let vocabularyComplexity: 'simple' | 'moderate' | 'complex';
    if (vocabularyRichness < 0.4) vocabularyComplexity = 'simple';
    else if (vocabularyRichness < 0.6) vocabularyComplexity = 'moderate';
    else vocabularyComplexity = 'complex';

    return {
      readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
      gradeLevel: Math.max(1, Math.min(20, gradeLevel)),
      avgSentenceLength,
      vocabularyComplexity,
    };
  }

  /**
   * Count syllables in a word (approximation)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = /[aeiou]/.test(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) {
      count--;
    }
    
    // Ensure at least one syllable
    return Math.max(1, count);
  }

  /**
   * Smart categorization based on content
   */
  async smartCategorization(request: SmartCategorizationRequest): Promise<SmartCategorizationResponse> {
    const analysis = await this.analyzeContent({
      id: request.entryId,
      userId: '',
      title: request.title,
      content: request.content,
      tags: request.existingTags || [],
    } as Entry);

    // Match with user's existing categories
    const categorySuggestions = analysis.categories;
    
    if (request.userCategories && request.userCategories.length > 0) {
      // Enhanced matching with user categories
      for (const userCategory of request.userCategories) {
        const similarity = this.calculateCategorySimilarity(
          userCategory,
          analysis.entities,
          analysis.keyPhrases,
          analysis.topics
        );
        
        if (similarity > 0.3) {
          const existing = categorySuggestions.find(s => s.categoryId === userCategory.id);
          if (existing) {
            existing.confidence = Math.max(existing.confidence, similarity);
          } else {
            categorySuggestions.push({
              categoryId: userCategory.id,
              name: userCategory.name,
              confidence: similarity,
              reason: 'Content matches category description',
            });
          }
        }
      }
    }

    // Sort and filter suggestions
    const finalSuggestions = categorySuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return {
      suggestedCategories: finalSuggestions,
      suggestedTags: analysis.tags,
      confidence: finalSuggestions[0]?.confidence || 0,
    };
  }

  /**
   * Calculate similarity between content and category
   */
  private calculateCategorySimilarity(
    category: { name: string; description?: string },
    entities: Entity[],
    keyPhrases: KeyPhrase[],
    topics: Topic[]
  ): number {
    let similarity = 0;
    const categoryText = `${category.name} ${category.description || ''}`.toLowerCase();

    // Check entities
    entities.forEach(entity => {
      if (categoryText.includes(entity.text.toLowerCase())) {
        similarity += entity.score * 0.3;
      }
    });

    // Check key phrases
    keyPhrases.forEach(phrase => {
      if (categoryText.includes(phrase.text.toLowerCase()) || 
          phrase.text.toLowerCase().includes(category.name.toLowerCase())) {
        similarity += phrase.score * 0.4;
      }
    });

    // Check topics
    topics.forEach(topic => {
      if (categoryText.includes(topic.name.toLowerCase())) {
        similarity += topic.score * 0.3;
      }
    });

    return Math.min(1, similarity);
  }

  /**
   * Get content insights for a user
   */
  async getContentInsights(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<ContentInsights> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Get all entries in the period
    const entries = await entryRepository.list({
      userId,
      page: 1,
      limit: 10000,
    });

    const periodEntries = entries.entries.filter(
      e => e.createdAt >= startDate && e.createdAt <= endDate
    );

    // Aggregate sentiment scores
    const sentimentTotals = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };

    const emotionCounts = new Map<string, number>();
    const topicCounts = new Map<string, Topic>();
    const entityFrequency = new Map<string, { entity: Entity; count: number }>();
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Map<string, number>();
    let totalWords = 0;

    // Process each entry
    for (const entry of periodEntries) {
      // This would typically load from a cache or database
      // For now, we'll skip the actual analysis
      const hour = entry.createdAt.getHours();
      hourCounts[hour]++;
      
      const dayName = entry.createdAt.toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
      
      totalWords += (entry.content || '').split(/\s+/).length;
    }

    // Calculate averages
    const avgSentiment: SentimentAnalysis = {
      sentiment: 'NEUTRAL',
      scores: {
        positive: sentimentTotals.positive / Math.max(periodEntries.length, 1),
        negative: sentimentTotals.negative / Math.max(periodEntries.length, 1),
        neutral: sentimentTotals.neutral / Math.max(periodEntries.length, 1),
        mixed: sentimentTotals.mixed / Math.max(periodEntries.length, 1),
      },
    };

    // Generate recommendations
    const recommendations = this.generateInsightRecommendations(
      avgSentiment,
      Array.from(emotionCounts.entries()),
      periodEntries.length
    );

    return {
      userId,
      period,
      startDate,
      endDate,
      totalEntries: periodEntries.length,
      averageSentiment: avgSentiment,
      topEmotions: Array.from(emotionCounts.entries())
        .map(([emotion, count]) => ({
          emotion,
          count,
          percentage: (count / periodEntries.length) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topTopics: Array.from(topicCounts.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
      topEntities: Array.from(entityFrequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      writingPatterns: {
        mostActiveHours: hourCounts.map((count, hour) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        mostActiveDays: Array.from(dayCounts.entries())
          .map(([day, count]) => ({ day, count }))
          .sort((a, b) => b.count - a.count),
        averageEntryLength: totalWords / Math.max(periodEntries.length, 1),
        totalWords,
      },
      recommendations,
    };
  }

  /**
   * Generate recommendations based on insights
   */
  private generateInsightRecommendations(
    avgSentiment: SentimentAnalysis,
    emotionData: Array<[string, number]>,
    totalEntries: number
  ): string[] {
    const recommendations: string[] = [];

    // Sentiment-based recommendations
    if (avgSentiment.scores.negative > 0.6) {
      recommendations.push('Consider incorporating more positive reflection exercises');
      recommendations.push('Try gratitude journaling to balance your entries');
    }

    if (avgSentiment.scores.positive > 0.8) {
      recommendations.push('Great positive energy! Consider documenting what contributes to this');
    }

    // Frequency-based recommendations
    if (totalEntries < 7) {
      recommendations.push('Try to write more frequently to capture more moments');
    } else if (totalEntries > 50) {
      recommendations.push('Excellent journaling habit! Consider reviewing past entries for insights');
    }

    // Emotion-based recommendations
    const dominantEmotion = emotionData[0]?.[0];
    if (dominantEmotion === 'anger' || dominantEmotion === 'fear') {
      recommendations.push('Consider exploring stress-reduction techniques');
    }

    return recommendations;
  }

  /**
   * Find similar entries using content analysis
   */
  async findSimilarEntries(entryId: string, userId: string, limit: number = 5): Promise<ContentRecommendation[]> {
    // Use the search service to find similar entries
    const searchResult = await searchService.findSimilarEntries(entryId, userId, limit);
    
    const recommendations: ContentRecommendation[] = searchResult.entries.map(hit => ({
      entryId: hit.id,
      score: hit.score,
      reason: 'Similar content and topics',
      commonElements: [], // Would be populated with actual common elements
    }));

    return recommendations;
  }

  /**
   * Queue entry for enhanced indexing with AI metadata
   */
  private async queueForEnhancedIndexing(entry: Entry, analysis: ContentAnalysis): Promise<void> {
    const enhancedEntry = {
      ...entry,
      aiMetadata: {
        sentiment: analysis.sentiment.sentiment,
        sentimentScores: analysis.sentiment.scores,
        entities: analysis.entities.map(e => ({ text: e.text, type: e.type })),
        topics: analysis.topics.map(t => t.name),
        suggestedTags: analysis.tags,
        readingTime: analysis.readingTime,
        complexity: analysis.complexity.vocabularyComplexity,
      },
    };

    await this.sqs.sendMessage({
      QueueUrl: process.env.SEARCH_INDEX_QUEUE_URL || '',
      MessageBody: JSON.stringify({
        action: 'index',
        entry: enhancedEntry,
      }),
    }).promise();
  }

  /**
   * Generate content summary using key phrases and entities
   */
  async generateSummary(text: string, maxLength: number = 150): Promise<string> {
    const [entities, keyPhrases] = await Promise.all([
      this.detectEntities(text),
      this.detectKeyPhrases(text),
    ]);

    // Extract most important sentences based on entity and key phrase density
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceScores = sentences.map(sentence => {
      let score = 0;
      
      entities.forEach(entity => {
        if (sentence.includes(entity.text)) {
          score += entity.score;
        }
      });
      
      keyPhrases.forEach(phrase => {
        if (sentence.includes(phrase.text)) {
          score += phrase.score;
        }
      });
      
      return { sentence: sentence.trim(), score };
    });

    // Sort by score and build summary
    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.sentence);

    let summary = topSentences.join('. ');
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }
}

// Export singleton instance
export const aiService = new AIService();
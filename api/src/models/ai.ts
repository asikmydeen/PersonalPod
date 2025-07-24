export interface ContentAnalysis {
  entryId: string;
  userId: string;
  sentiment: SentimentAnalysis;
  entities: Entity[];
  keyPhrases: KeyPhrase[];
  categories: CategorySuggestion[];
  tags: string[];
  language: string;
  topics: Topic[];
  summary?: string;
  readingTime: number;
  complexity: ComplexityScore;
  analyzedAt: Date;
}

export interface SentimentAnalysis {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  scores: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  dominantEmotion?: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust';
  emotionScores?: Record<string, number>;
}

export interface Entity {
  text: string;
  type: 'PERSON' | 'LOCATION' | 'ORGANIZATION' | 'DATE' | 'QUANTITY' | 'EVENT' | 'TITLE' | 'OTHER';
  score: number;
  beginOffset: number;
  endOffset: number;
}

export interface KeyPhrase {
  text: string;
  score: number;
  beginOffset: number;
  endOffset: number;
}

export interface CategorySuggestion {
  categoryId?: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface Topic {
  name: string;
  score: number;
  relatedTerms: string[];
}

export interface ComplexityScore {
  readabilityScore: number; // 0-100
  gradeLevel: number;
  avgSentenceLength: number;
  vocabularyComplexity: 'simple' | 'moderate' | 'complex';
}

export interface SmartCategorizationRequest {
  entryId: string;
  title: string;
  content: string;
  existingTags?: string[];
  userCategories?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export interface SmartCategorizationResponse {
  suggestedCategories: CategorySuggestion[];
  suggestedTags: string[];
  confidence: number;
}

export interface ContentInsights {
  userId: string;
  period: 'day' | 'week' | 'month' | 'year';
  startDate: Date;
  endDate: Date;
  totalEntries: number;
  averageSentiment: SentimentAnalysis;
  topEmotions: Array<{
    emotion: string;
    count: number;
    percentage: number;
  }>;
  topTopics: Topic[];
  topEntities: Array<{
    entity: Entity;
    frequency: number;
  }>;
  writingPatterns: {
    mostActiveHours: Array<{ hour: number; count: number }>;
    mostActiveDays: Array<{ day: string; count: number }>;
    averageEntryLength: number;
    totalWords: number;
  };
  recommendations: string[];
}

export interface SimilarityScore {
  entryId1: string;
  entryId2: string;
  score: number;
  commonTopics: string[];
  commonEntities: string[];
  commonKeyPhrases: string[];
}

export interface ContentRecommendation {
  entryId: string;
  score: number;
  reason: string;
  commonElements: string[];
}

export interface AIProcessingJob {
  jobId: string;
  entryId: string;
  userId: string;
  jobType: 'analysis' | 'categorization' | 'summary' | 'insights';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
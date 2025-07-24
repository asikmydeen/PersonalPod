export interface Tag {
  name: string;
  count: number;
  lastUsed?: Date;
}

export interface TagStats {
  totalTags: number;
  uniqueTags: number;
  mostUsedTags: Tag[];
  recentTags: Tag[];
}

export interface TagSuggestion {
  tag: string;
  score: number;
  source: 'history' | 'content' | 'similar';
}

export interface CreateTagDto {
  tags: string[];
}

export interface RenameTagDto {
  oldTag: string;
  newTag: string;
}

export interface MergeTagsDto {
  sourceTags: string[];
  targetTag: string;
}
export interface Category {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  path: string; // Materialized path for efficient tree queries
  level: number;
  displayOrder: number;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  displayOrder?: number;
  metadata?: Record<string, any>;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

export interface CategoryTreeOptions {
  includeInactive?: boolean;
  maxDepth?: number;
}

export interface MoveCategoryDto {
  categoryId: string;
  newParentId?: string;
  newDisplayOrder?: number;
}
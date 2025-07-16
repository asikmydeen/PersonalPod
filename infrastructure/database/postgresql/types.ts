/**
 * TypeScript Types for PersonalPod PostgreSQL Schema
 * 
 * These interfaces match the database schema and provide type safety
 * for database operations in the application.
 */

// Enum types matching PostgreSQL enums
export enum EntryType {
  NOTE = 'note',
  PASSWORD = 'password',
  DOCUMENT = 'document',
  BOOKMARK = 'bookmark',
  TASK = 'task',
  CONTACT = 'contact'
}

export enum EntryStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
  DRAFT = 'draft'
}

export enum SharePermission {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

export enum ActivityAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SHARE = 'share',
  UNSHARE = 'unshare',
  VIEW = 'view',
  EXPORT = 'export'
}

// Database table interfaces
export interface User {
  id: string;
  cognito_user_id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: string;
  sort_order: number;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Entry {
  id: string;
  user_id: string;
  category_id?: string;
  type: EntryType;
  status: EntryStatus;
  title: string;
  content?: string;
  content_encrypted?: Buffer;
  content_type?: string;
  metadata: Record<string, any>;
  is_favorite: boolean;
  is_encrypted: boolean;
  sort_order: number;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  color?: string;
  usage_count: number;
  created_at: Date;
}

export interface EntryTag {
  entry_id: string;
  tag_id: string;
  created_at: Date;
}

export interface Attachment {
  id: string;
  entry_id: string;
  user_id: string;
  file_name: string;
  file_size: bigint;
  mime_type?: string;
  s3_key: string;
  s3_bucket: string;
  thumbnail_s3_key?: string;
  checksum?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface SearchMetadata {
  id: string;
  entry_id: string;
  search_vector: any; // tsvector type
  keywords?: string[];
  language: string;
  last_indexed_at: Date;
}

export interface UserPreference {
  id: string;
  user_id: string;
  preference_key: string;
  preference_value: any; // JSONB
  created_at: Date;
  updated_at: Date;
}

export interface Sharing {
  id: string;
  entry_id: string;
  owner_id: string;
  shared_with_user_id?: string;
  shared_with_email?: string;
  permission: SharePermission;
  share_token?: string;
  expires_at?: Date;
  accessed_at?: Date;
  access_count: number;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  entry_id?: string;
  action: ActivityAction;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

// Metadata type definitions for specific entry types
export interface NoteMetadata {
  word_count?: number;
  reading_time?: number;
  last_edited_device?: string;
}

export interface PasswordMetadata {
  username?: string;
  url?: string;
  notes?: string;
  last_password_change?: Date;
  password_strength?: number;
}

export interface DocumentMetadata {
  document_type?: string;
  version?: string;
  last_reviewed?: Date;
  file_hash?: string;
}

export interface BookmarkMetadata {
  url: string;
  tags?: string[];
  description?: string;
  favicon_url?: string;
  archived?: boolean;
}

export interface TaskMetadata {
  due_date?: Date;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  completed_at?: Date;
  reminder?: Date;
  subtasks?: Array<{
    title: string;
    completed: boolean;
  }>;
}

export interface ContactMetadata {
  phone?: string;
  email?: string;
  address?: string;
  company?: string;
  birthday?: Date;
  notes?: string;
  social_profiles?: Record<string, string>;
}

// Join query result types
export interface EntryWithRelations extends Entry {
  category?: Category;
  tags?: Tag[];
  attachments?: Attachment[];
  shared_with?: Sharing[];
}

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

export interface UserWithPreferences extends User {
  preferences?: Record<string, any>;
}

// Query filter types
export interface EntryFilters {
  user_id: string;
  type?: EntryType;
  status?: EntryStatus;
  category_id?: string;
  tag_ids?: string[];
  is_favorite?: boolean;
  search?: string;
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'updated_at' | 'title';
  order_direction?: 'ASC' | 'DESC';
}

export interface SharingFilters {
  owner_id?: string;
  shared_with_user_id?: string;
  entry_id?: string;
  permission?: SharePermission;
  is_public?: boolean;
  active_only?: boolean;
}

// Database response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface SearchResult {
  entry_id: string;
  title: string;
  excerpt: string;
  highlights: Array<{
    field: 'title' | 'content';
    text: string;
    positions: number[];
  }>;
  score: number;
}
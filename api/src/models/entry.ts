export type EntryType = 'note' | 'password' | 'document' | 'bookmark' | 'task' | 'contact';
export type EntryStatus = 'active' | 'archived' | 'deleted' | 'draft';

export interface Entry {
  id: string;
  userId: string;
  type: EntryType;
  title: string;
  content?: string;
  encryptedContent?: string;
  isEncrypted: boolean;
  isLocked: boolean;
  status: EntryStatus;
  tags: string[];
  metadata: Record<string, any>;
  version: number;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEntryDto {
  type: EntryType;
  title: string;
  content?: string;
  isEncrypted?: boolean;
  isLocked?: boolean;
  status?: EntryStatus;
  tags?: string[];
  metadata?: Record<string, any>;
  parentId?: string;
}

export interface UpdateEntryDto {
  title?: string;
  content?: string;
  isEncrypted?: boolean;
  isLocked?: boolean;
  status?: EntryStatus;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EntryAttachment {
  id: string;
  entryId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface EntryVersion {
  id: string;
  entryId: string;
  version: number;
  title: string;
  content?: string;
  encryptedContent?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  createdBy: string;
}

export interface EntryListParams {
  userId: string;
  type?: EntryType;
  status?: EntryStatus;
  tags?: string[];
  search?: string;
  parentId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface EntryListResponse {
  entries: Entry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EntryWithAttachments extends Entry {
  attachments: EntryAttachment[];
}

export interface EntryWithVersions extends Entry {
  versions: EntryVersion[];
}
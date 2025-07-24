export interface FileUpload {
  id: string;
  userId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  metadata: FileMetadata;
  uploadedAt: Date;
  expiresAt?: Date;
}

export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  encoding?: string;
  checksum?: string;
  virusScanStatus?: 'pending' | 'clean' | 'infected' | 'error';
  virusScanDate?: Date;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: any;
}

export interface CreateFileUploadDto {
  fileName: string;
  mimeType: string;
  size: number;
  metadata?: Partial<FileMetadata>;
}

export interface FileUploadResponse {
  uploadId: string;
  uploadUrl: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface ProcessFileDto {
  uploadId: string;
  storageKey: string;
}

export interface FileSearchParams {
  userId: string;
  mimeType?: string;
  minSize?: number;
  maxSize?: number;
  uploadedAfter?: Date;
  uploadedBefore?: Date;
  page?: number;
  limit?: number;
}

export interface FileProcessingJob {
  fileId: string;
  userId: string;
  storageKey: string;
  mimeType: string;
  jobType: 'thumbnail' | 'virus-scan' | 'metadata-extraction' | 'ocr';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/xml',
  
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
];

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB
export const THUMBNAIL_SIZES = {
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 }
};
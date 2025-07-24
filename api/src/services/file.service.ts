import { v4 as uuidv4 } from 'uuid';
import * as AWS from 'aws-sdk';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  FileUpload,
  CreateFileUploadDto,
  FileUploadResponse,
  ProcessFileDto,
  FileMetadata,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE
} from '../models/file';

export class FileService {
  private s3: AWS.S3;
  private sqs: AWS.SQS;
  private bucketName: string;
  private fileProcessingQueueUrl: string;

  constructor() {
    this.s3 = new AWS.S3({
      region: config.aws.region,
    });
    this.sqs = new AWS.SQS({
      region: config.aws.region,
    });
    this.bucketName = process.env.BUCKET_NAME || '';
    this.fileProcessingQueueUrl = process.env.FILE_QUEUE_URL || '';
  }

  /**
   * Generate presigned URL for file upload
   */
  async generateUploadUrl(userId: string, dto: CreateFileUploadDto): Promise<FileUploadResponse> {
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new AppError('File type not allowed', 400);
    }

    // Validate file size
    if (dto.size > MAX_FILE_SIZE) {
      throw new AppError(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
    }

    // Additional size validation based on type
    if (dto.mimeType.startsWith('image/') && dto.size > MAX_IMAGE_SIZE) {
      throw new AppError(`Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`, 400);
    }

    if (dto.mimeType.startsWith('application/') && dto.size > MAX_DOCUMENT_SIZE) {
      throw new AppError(`Document size exceeds maximum allowed size of ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`, 400);
    }

    const uploadId = uuidv4();
    const fileExtension = this.getFileExtension(dto.fileName);
    const storageKey = `uploads/${userId}/${uploadId}${fileExtension}`;

    // Generate presigned POST URL
    const params = {
      Bucket: this.bucketName,
      Fields: {
        key: storageKey,
        'Content-Type': dto.mimeType,
        'x-amz-meta-user-id': userId,
        'x-amz-meta-upload-id': uploadId,
        'x-amz-meta-original-name': dto.fileName,
      },
      Expires: 3600, // 1 hour
      Conditions: [
        ['content-length-range', 0, dto.size + 1024], // Allow slight overhead
        ['starts-with', '$Content-Type', dto.mimeType],
      ],
    };

    try {
      const presignedPost = await this.s3.createPresignedPost(params);

      // Store upload metadata in database (implement in repository)
      // This would typically be done in a file repository

      return {
        uploadId,
        uploadUrl: presignedPost.url,
        fields: presignedPost.fields,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
    } catch (error) {
      logger.error('Error generating upload URL:', error);
      throw new AppError('Failed to generate upload URL', 500);
    }
  }

  /**
   * Process uploaded file
   */
  async processUploadedFile(dto: ProcessFileDto): Promise<void> {
    const { uploadId, storageKey } = dto;

    try {
      // Get file metadata from S3
      const headObject = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: storageKey,
      }).promise();

      const userId = headObject.Metadata?.['user-id'];
      const originalName = headObject.Metadata?.['original-name'] || 'unknown';
      const mimeType = headObject.ContentType || 'application/octet-stream';
      const size = headObject.ContentLength || 0;

      // Calculate checksum
      const objectData = await this.s3.getObject({
        Bucket: this.bucketName,
        Key: storageKey,
      }).promise();

      const checksum = createHash('sha256')
        .update(objectData.Body as Buffer)
        .digest('hex');

      // Queue processing jobs based on file type
      const jobs = [];

      // Virus scan for all files
      jobs.push({
        jobType: 'virus-scan',
        fileId: uploadId,
        userId,
        storageKey,
        mimeType,
      });

      // Thumbnail generation for images
      if (mimeType.startsWith('image/')) {
        jobs.push({
          jobType: 'thumbnail',
          fileId: uploadId,
          userId,
          storageKey,
          mimeType,
        });

        // Metadata extraction for images
        jobs.push({
          jobType: 'metadata-extraction',
          fileId: uploadId,
          userId,
          storageKey,
          mimeType,
        });
      }

      // OCR for documents
      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        jobs.push({
          jobType: 'ocr',
          fileId: uploadId,
          userId,
          storageKey,
          mimeType,
        });
      }

      // Send jobs to processing queue
      for (const job of jobs) {
        await this.sqs.sendMessage({
          QueueUrl: this.fileProcessingQueueUrl,
          MessageBody: JSON.stringify(job),
          MessageAttributes: {
            jobType: {
              DataType: 'String',
              StringValue: job.jobType,
            },
          },
        }).promise();
      }

      logger.info(`File processing jobs queued for upload ${uploadId}`);
    } catch (error) {
      logger.error('Error processing uploaded file:', error);
      throw new AppError('Failed to process uploaded file', 500);
    }
  }

  /**
   * Generate signed URL for file download
   */
  async generateDownloadUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
    try {
      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucketName,
        Key: storageKey,
        Expires: expiresIn,
      });

      return url;
    } catch (error) {
      logger.error('Error generating download URL:', error);
      throw new AppError('Failed to generate download URL', 500);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: storageKey,
      }).promise();

      logger.info(`File deleted: ${storageKey}`);
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw new AppError('Failed to delete file', 500);
    }
  }

  /**
   * Copy file to new location
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      await this.s3.copyObject({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      }).promise();

      logger.info(`File copied from ${sourceKey} to ${destinationKey}`);
    } catch (error) {
      logger.error('Error copying file:', error);
      throw new AppError('Failed to copy file', 500);
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(storageKey: string): Promise<FileMetadata> {
    try {
      const headObject = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: storageKey,
      }).promise();

      return {
        size: headObject.ContentLength,
        mimeType: headObject.ContentType,
        lastModified: headObject.LastModified,
        etag: headObject.ETag,
        metadata: headObject.Metadata,
      } as FileMetadata;
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      throw new AppError('Failed to get file metadata', 500);
    }
  }

  /**
   * Validate file before processing
   */
  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
    }

    // Check mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError('File type not allowed', 400);
    }

    // Additional validation based on file type
    if (file.mimetype.startsWith('image/')) {
      if (file.size > MAX_IMAGE_SIZE) {
        throw new AppError(`Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`, 400);
      }
    }

    if (file.mimetype.startsWith('application/')) {
      if (file.size > MAX_DOCUMENT_SIZE) {
        throw new AppError(`Document size exceeds maximum allowed size of ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`, 400);
      }
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot);
  }

  /**
   * Generate thumbnail key
   */
  generateThumbnailKey(originalKey: string, size: 'small' | 'medium' | 'large'): string {
    const parts = originalKey.split('/');
    const filename = parts.pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const extension = this.getFileExtension(filename);
    
    parts.push('thumbnails', `${nameWithoutExt}_${size}${extension}`);
    return parts.join('/');
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: storageKey,
      }).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const fileService = new FileService();
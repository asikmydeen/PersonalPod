import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { fileService } from '../services/file.service';
import { entryRepository } from '../repositories/entry.repository';
import { AppError } from '../middleware/errorHandler';
import { CreateFileUploadDto, ProcessFileDto } from '../models/file';
import { logger } from '../utils/logger';

export class FileController {
  /**
   * Generate presigned URL for file upload
   */
  async generateUploadUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const dto: CreateFileUploadDto = req.body;

      const uploadResponse = await fileService.generateUploadUrl(userId, dto);

      res.json({
        success: true,
        data: uploadResponse
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm file upload and trigger processing
   */
  async confirmUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 400);
      }

      const userId = req.user!.id;
      const { uploadId, storageKey } = req.body;

      // Verify the file exists and belongs to the user
      const metadata = await fileService.getFileMetadata(storageKey);
      if (metadata.metadata?.['user-id'] !== userId) {
        throw new AppError('Unauthorized access to file', 403);
      }

      // Process the uploaded file
      const dto: ProcessFileDto = { uploadId, storageKey };
      await fileService.processUploadedFile(dto);

      res.json({
        success: true,
        message: 'File upload confirmed and processing started'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.id;
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string) : 3600;

      // Get attachment details from database
      const attachments = await entryRepository.getAttachments(attachmentId);
      if (attachments.length === 0) {
        throw new AppError('Attachment not found', 404);
      }

      const attachment = attachments[0];
      
      // Verify the attachment belongs to user's entry
      const entry = await entryRepository.findById(attachment.entryId, userId);
      if (!entry) {
        throw new AppError('Unauthorized access to file', 403);
      }

      // Generate download URL
      const downloadUrl = await fileService.generateDownloadUrl(attachment.storageKey, expiresIn);

      res.json({
        success: true,
        data: {
          downloadUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.fileSize
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.id;

      // Get attachment details from database
      const attachments = await entryRepository.getAttachments(attachmentId);
      if (attachments.length === 0) {
        throw new AppError('Attachment not found', 404);
      }

      const attachment = attachments[0];
      
      // Verify the attachment belongs to user's entry
      const entry = await entryRepository.findById(attachment.entryId, userId);
      if (!entry) {
        throw new AppError('Unauthorized access to file', 403);
      }

      // Delete from S3
      await fileService.deleteFile(attachment.storageKey);

      // Delete thumbnails if it's an image
      if (attachment.mimeType.startsWith('image/')) {
        const thumbnailKeys = ['small', 'medium', 'large'].map(size => 
          fileService.generateThumbnailKey(attachment.storageKey, size as any)
        );
        
        await Promise.all(
          thumbnailKeys.map(key => 
            fileService.deleteFile(key).catch(() => {
              // Ignore errors for missing thumbnails
            })
          )
        );
      }

      // Remove from database
      await entryRepository.removeAttachment(attachmentId, userId);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload file to entry (multipart form data)
   */
  async uploadToEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entryId } = req.params;
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        throw new AppError('No file provided', 400);
      }

      // Verify entry belongs to user
      const entry = await entryRepository.findById(entryId, userId);
      if (!entry) {
        throw new AppError('Entry not found', 404);
      }

      // Validate file
      fileService.validateFile(file);

      // Generate storage key
      const uploadId = uuidv4();
      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
      const storageKey = `uploads/${userId}/${uploadId}${fileExtension}`;

      // Upload to S3
      await fileService.s3.putObject({
        Bucket: fileService.bucketName,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          'user-id': userId,
          'upload-id': uploadId,
          'original-name': file.originalname,
          'entry-id': entryId,
        },
      }).promise();

      // Add to database
      const attachment = await entryRepository.addAttachment(entryId, userId, {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey,
        metadata: {
          uploadId,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Queue for processing
      await fileService.processUploadedFile({
        uploadId,
        storageKey,
      });

      res.json({
        success: true,
        data: attachment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get attachment metadata
   */
  async getAttachmentMetadata(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.id;

      // Get attachment details from database
      const attachments = await entryRepository.getAttachments(attachmentId);
      if (attachments.length === 0) {
        throw new AppError('Attachment not found', 404);
      }

      const attachment = attachments[0];
      
      // Verify the attachment belongs to user's entry
      const entry = await entryRepository.findById(attachment.entryId, userId);
      if (!entry) {
        throw new AppError('Unauthorized access to file', 403);
      }

      // Get additional metadata from S3
      const s3Metadata = await fileService.getFileMetadata(attachment.storageKey);

      res.json({
        success: true,
        data: {
          ...attachment,
          s3Metadata
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get thumbnail URL for image
   */
  async getThumbnailUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.id;
      const size = (req.query.size as string) || 'medium';
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string) : 3600;

      if (!['small', 'medium', 'large'].includes(size)) {
        throw new AppError('Invalid thumbnail size', 400);
      }

      // Get attachment details from database
      const attachments = await entryRepository.getAttachments(attachmentId);
      if (attachments.length === 0) {
        throw new AppError('Attachment not found', 404);
      }

      const attachment = attachments[0];
      
      // Verify the attachment belongs to user's entry
      const entry = await entryRepository.findById(attachment.entryId, userId);
      if (!entry) {
        throw new AppError('Unauthorized access to file', 403);
      }

      // Check if it's an image
      if (!attachment.mimeType.startsWith('image/')) {
        throw new AppError('Thumbnails are only available for images', 400);
      }

      // Generate thumbnail key
      const thumbnailKey = fileService.generateThumbnailKey(attachment.storageKey, size as any);

      // Check if thumbnail exists
      const thumbnailExists = await fileService.fileExists(thumbnailKey);
      if (!thumbnailExists) {
        throw new AppError('Thumbnail not yet generated', 404);
      }

      // Generate download URL
      const thumbnailUrl = await fileService.generateDownloadUrl(thumbnailKey, expiresIn);

      res.json({
        success: true,
        data: {
          thumbnailUrl,
          size,
          expiresAt: new Date(Date.now() + expiresIn * 1000)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

// Required import
import { v4 as uuidv4 } from 'uuid';

// Export singleton instance
export const fileController = new FileController();
import { body, param, query } from 'express-validator';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../models/file';

export const fileValidators = {
  generateUploadUrl: [
    body('fileName')
      .trim()
      .notEmpty()
      .withMessage('File name is required')
      .isLength({ max: 255 })
      .withMessage('File name must not exceed 255 characters'),
    body('mimeType')
      .notEmpty()
      .withMessage('MIME type is required')
      .isIn(ALLOWED_MIME_TYPES)
      .withMessage('File type not allowed'),
    body('size')
      .isInt({ min: 1, max: MAX_FILE_SIZE })
      .withMessage(`File size must be between 1 byte and ${MAX_FILE_SIZE / 1024 / 1024}MB`),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],

  confirmUpload: [
    body('uploadId')
      .isUUID()
      .withMessage('Upload ID must be a valid UUID'),
    body('storageKey')
      .notEmpty()
      .withMessage('Storage key is required')
      .matches(/^uploads\/[a-f0-9-]+\/[a-f0-9-]+\.[a-zA-Z0-9]+$/)
      .withMessage('Invalid storage key format')
  ],

  getDownloadUrl: [
    param('attachmentId')
      .isUUID()
      .withMessage('Attachment ID must be a valid UUID'),
    query('expiresIn')
      .optional()
      .isInt({ min: 60, max: 86400 })
      .withMessage('Expires in must be between 60 and 86400 seconds')
  ],

  deleteFile: [
    param('attachmentId')
      .isUUID()
      .withMessage('Attachment ID must be a valid UUID')
  ],

  uploadToEntry: [
    param('entryId')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  getAttachmentMetadata: [
    param('attachmentId')
      .isUUID()
      .withMessage('Attachment ID must be a valid UUID')
  ],

  getThumbnailUrl: [
    param('attachmentId')
      .isUUID()
      .withMessage('Attachment ID must be a valid UUID'),
    query('size')
      .optional()
      .isIn(['small', 'medium', 'large'])
      .withMessage('Size must be one of: small, medium, large'),
    query('expiresIn')
      .optional()
      .isInt({ min: 60, max: 86400 })
      .withMessage('Expires in must be between 60 and 86400 seconds')
  ]
};
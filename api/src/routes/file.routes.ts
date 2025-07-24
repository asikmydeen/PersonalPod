import { Router } from 'express';
import multer from 'multer';
import { fileController } from '../controllers/file.controller';
import { authenticate } from '../middleware/auth';
import { fileValidators } from '../validators/file.validator';
import { MAX_FILE_SIZE } from '../models/file';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// All file routes require authentication
router.use(authenticate);

// File upload operations
router.post('/upload-url', fileValidators.generateUploadUrl, fileController.generateUploadUrl);
router.post('/confirm-upload', fileValidators.confirmUpload, fileController.confirmUpload);

// File operations
router.get('/:attachmentId/download-url', fileValidators.getDownloadUrl, fileController.getDownloadUrl);
router.delete('/:attachmentId', fileValidators.deleteFile, fileController.deleteFile);
router.get('/:attachmentId/metadata', fileValidators.getAttachmentMetadata, fileController.getAttachmentMetadata);
router.get('/:attachmentId/thumbnail', fileValidators.getThumbnailUrl, fileController.getThumbnailUrl);

// Direct upload to entry (multipart form data)
router.post('/entries/:entryId/upload', 
  fileValidators.uploadToEntry,
  upload.single('file'),
  fileController.uploadToEntry
);

export default router;
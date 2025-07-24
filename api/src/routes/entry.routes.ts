import { Router } from 'express';
import { entryController } from '../controllers/entry.controller';
import { authenticate } from '../middleware/auth';
import { entryValidators } from '../validators/entry.validator';

const router = Router();

// All entry routes require authentication
router.use(authenticate);

// CRUD operations
router.post('/', entryValidators.create, entryController.create);
router.get('/', entryValidators.list, entryController.list);
router.get('/search', entryValidators.search, entryController.search);
router.get('/tags/popular', entryValidators.getPopularTags, entryController.getPopularTags);
router.post('/tags/suggest', entryValidators.suggestTags, entryController.suggestTags);
router.get('/:id', entryValidators.getById, entryController.getById);
router.put('/:id', entryValidators.update, entryController.update);
router.delete('/:id', entryValidators.delete, entryController.delete);
router.post('/:id/lock', entryValidators.toggleLock, entryController.toggleLock);
router.get('/:id/attachments', entryValidators.getAttachments, entryController.getAttachments);
router.get('/:id/versions', entryValidators.getVersions, entryController.getVersions);

export default router;
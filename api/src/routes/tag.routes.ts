import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth';
import { tagValidators } from '../validators/tag.validator';

const router = Router();

// All tag routes require authentication
router.use(authenticate);

// Tag management
router.get('/', tagController.getAllTags);
router.get('/popular', tagValidators.getPopularTags, tagController.getPopularTags);
router.get('/recent', tagValidators.getRecentTags, tagController.getRecentTags);
router.get('/stats', tagController.getTagStats);
router.get('/search', tagValidators.searchTags, tagController.searchTags);
router.post('/suggest', tagValidators.getSuggestions, tagController.getSuggestions);
router.post('/validate', tagValidators.validateTags, tagController.validateTags);

// Tag operations
router.put('/rename', tagValidators.renameTag, tagController.renameTag);
router.post('/merge', tagValidators.mergeTags, tagController.mergeTags);
router.delete('/:tag', tagValidators.deleteTag, tagController.deleteTag);
router.get('/:tag/entries', tagValidators.getEntriesByTag, tagController.getEntriesByTag);

export default router;
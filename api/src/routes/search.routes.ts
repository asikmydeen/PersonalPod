import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { authenticate } from '../middleware/auth';
import { searchValidators } from '../validators/search.validator';

const router = Router();

// All search routes require authentication
router.use(authenticate);

// Search operations
router.get('/', searchValidators.searchEntries, searchController.searchEntries);
router.get('/suggestions', searchValidators.getSuggestions, searchController.getSuggestions);
router.get('/similar/:entryId', searchValidators.findSimilar, searchController.findSimilar);
router.post('/reindex', searchController.reindexEntries);
router.get('/stats', searchController.getSearchStats);
router.get('/health', searchController.healthCheck);

export default router;
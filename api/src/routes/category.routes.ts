import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate } from '../middleware/auth';
import { categoryValidators } from '../validators/category.validator';

const router = Router();

// All category routes require authentication
router.use(authenticate);

// Category CRUD operations
router.post('/', categoryValidators.create, categoryController.create);
router.get('/', categoryValidators.list, categoryController.list);
router.get('/tree', categoryValidators.getTree, categoryController.getTree);
router.get('/:id', categoryValidators.getById, categoryController.getById);
router.get('/:id/subtree', categoryValidators.getSubtree, categoryController.getSubtree);
router.put('/:id', categoryValidators.update, categoryController.update);
router.post('/:id/move', categoryValidators.move, categoryController.move);
router.delete('/:id', categoryValidators.delete, categoryController.delete);

// Category-Entry relationships
router.post('/:id/entries', categoryValidators.addEntry, categoryController.addEntry);
router.delete('/:id/entries/:entryId', categoryValidators.removeEntry, categoryController.removeEntry);
router.get('/:id/entries', categoryValidators.getEntries, categoryController.getEntries);

// Entry-Category relationships (reverse)
router.get('/entries/:entryId', categoryValidators.getEntryCategories, categoryController.getEntryCategories);
router.put('/entries/:entryId', categoryValidators.setEntryCategories, categoryController.setEntryCategories);

export default router;
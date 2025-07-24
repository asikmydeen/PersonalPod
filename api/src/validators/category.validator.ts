import { body, param, query } from 'express-validator';

export const categoryValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Category name is required')
      .isLength({ max: 100 })
      .withMessage('Category name must not exceed 100 characters'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code (e.g., #FF0000)'),
    body('icon')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Icon must be a string with max 50 characters'),
    body('parentId')
      .optional()
      .isUUID()
      .withMessage('Parent ID must be a valid UUID'),
    body('displayOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Display order must be a non-negative integer'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Category name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Category name must not exceed 100 characters'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code (e.g., #FF0000)'),
    body('icon')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Icon must be a string with max 50 characters'),
    body('parentId')
      .optional()
      .isUUID()
      .withMessage('Parent ID must be a valid UUID'),
    body('displayOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Display order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],

  getById: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID')
  ],

  delete: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID')
  ],

  list: [
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean')
  ],

  getTree: [
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean'),
    query('maxDepth')
      .optional()
      .isInt({ min: 0 })
      .withMessage('maxDepth must be a non-negative integer')
  ],

  getSubtree: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean'),
    query('maxDepth')
      .optional()
      .isInt({ min: 0 })
      .withMessage('maxDepth must be a non-negative integer')
  ],

  move: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('newParentId')
      .optional()
      .isUUID()
      .withMessage('New parent ID must be a valid UUID'),
    body('newDisplayOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('New display order must be a non-negative integer')
  ],

  addEntry: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('entryId')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  removeEntry: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    param('entryId')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  getEntries: [
    param('id')
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    query('includeDescendants')
      .optional()
      .isBoolean()
      .withMessage('includeDescendants must be a boolean'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  getEntryCategories: [
    param('entryId')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  setEntryCategories: [
    param('entryId')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID'),
    body('categoryIds')
      .isArray()
      .withMessage('Category IDs must be an array'),
    body('categoryIds.*')
      .isUUID()
      .withMessage('Each category ID must be a valid UUID')
  ]
};
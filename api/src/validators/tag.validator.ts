import { body, param, query } from 'express-validator';

export const tagValidators = {
  getPopularTags: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  getRecentTags: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],

  searchTags: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isString()
      .trim()
      .withMessage('Search query must be a string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  getSuggestions: [
    body('content')
      .optional()
      .isString()
      .withMessage('Content must be a string'),
    body('existingTags')
      .optional()
      .isArray()
      .withMessage('Existing tags must be an array'),
    body('existingTags.*')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Each tag must be a non-empty string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20')
  ],

  renameTag: [
    body('oldTag')
      .trim()
      .notEmpty()
      .withMessage('Old tag is required')
      .isLength({ max: 50 })
      .withMessage('Tag must not exceed 50 characters'),
    body('newTag')
      .trim()
      .notEmpty()
      .withMessage('New tag is required')
      .isLength({ max: 50 })
      .withMessage('Tag must not exceed 50 characters')
      .custom((value, { req }) => value !== req.body.oldTag)
      .withMessage('New tag must be different from old tag')
  ],

  mergeTags: [
    body('sourceTags')
      .isArray({ min: 1 })
      .withMessage('Source tags must be a non-empty array'),
    body('sourceTags.*')
      .trim()
      .notEmpty()
      .withMessage('Each source tag must be a non-empty string')
      .isLength({ max: 50 })
      .withMessage('Each tag must not exceed 50 characters'),
    body('targetTag')
      .trim()
      .notEmpty()
      .withMessage('Target tag is required')
      .isLength({ max: 50 })
      .withMessage('Tag must not exceed 50 characters')
  ],

  deleteTag: [
    param('tag')
      .trim()
      .notEmpty()
      .withMessage('Tag is required')
      .isLength({ max: 50 })
      .withMessage('Tag must not exceed 50 characters')
  ],

  getEntriesByTag: [
    param('tag')
      .trim()
      .notEmpty()
      .withMessage('Tag is required')
      .isLength({ max: 50 })
      .withMessage('Tag must not exceed 50 characters'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  validateTags: [
    body('tags')
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .isString()
      .withMessage('Each tag must be a string')
  ]
};
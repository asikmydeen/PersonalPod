import { query, param } from 'express-validator';

export const searchValidators = {
  searchEntries: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isString()
      .trim()
      .withMessage('Search query must be a string'),
    query('type')
      .optional()
      .isIn(['note', 'password', 'document', 'bookmark', 'task', 'contact'])
      .withMessage('Invalid entry type'),
    query('status')
      .optional()
      .isIn(['active', 'archived', 'deleted', 'draft'])
      .withMessage('Invalid entry status'),
    query('tags')
      .optional(),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid ISO 8601 date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid ISO 8601 date'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('highlight')
      .optional()
      .isBoolean()
      .withMessage('Highlight must be a boolean'),
    query('fuzzy')
      .optional()
      .isBoolean()
      .withMessage('Fuzzy must be a boolean'),
  ],

  getSuggestions: [
    query('prefix')
      .notEmpty()
      .withMessage('Prefix is required')
      .isString()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Prefix must be at least 2 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20'),
  ],

  findSimilar: [
    param('entryId')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
};
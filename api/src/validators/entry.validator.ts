import { body, param, query } from 'express-validator';
import { EntryType, EntryStatus } from '../models/entry';

const entryTypes: EntryType[] = ['note', 'password', 'document', 'bookmark', 'task', 'contact'];
const entryStatuses: EntryStatus[] = ['active', 'archived', 'deleted', 'draft'];

export const entryValidators = {
  create: [
    body('type')
      .isIn(entryTypes)
      .withMessage(`Type must be one of: ${entryTypes.join(', ')}`),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 255 })
      .withMessage('Title must not exceed 255 characters'),
    body('content')
      .optional()
      .isString()
      .withMessage('Content must be a string'),
    body('isEncrypted')
      .optional()
      .isBoolean()
      .withMessage('isEncrypted must be a boolean'),
    body('isLocked')
      .optional()
      .isBoolean()
      .withMessage('isLocked must be a boolean'),
    body('status')
      .optional()
      .isIn(entryStatuses)
      .withMessage(`Status must be one of: ${entryStatuses.join(', ')}`),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Each tag must be a non-empty string'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
    body('parentId')
      .optional()
      .isUUID()
      .withMessage('Parent ID must be a valid UUID')
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ max: 255 })
      .withMessage('Title must not exceed 255 characters'),
    body('content')
      .optional()
      .isString()
      .withMessage('Content must be a string'),
    body('isEncrypted')
      .optional()
      .isBoolean()
      .withMessage('isEncrypted must be a boolean'),
    body('isLocked')
      .optional()
      .isBoolean()
      .withMessage('isLocked must be a boolean'),
    body('status')
      .optional()
      .isIn(entryStatuses)
      .withMessage(`Status must be one of: ${entryStatuses.join(', ')}`),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Each tag must be a non-empty string'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],

  getById: [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID'),
    query('include')
      .optional()
      .isString()
      .withMessage('Include must be a string')
  ],

  delete: [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  toggleLock: [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID'),
    body('isLocked')
      .isBoolean()
      .withMessage('isLocked must be a boolean')
  ],

  list: [
    query('type')
      .optional()
      .isIn(entryTypes)
      .withMessage(`Type must be one of: ${entryTypes.join(', ')}`),
    query('status')
      .optional()
      .isIn(entryStatuses)
      .withMessage(`Status must be one of: ${entryStatuses.join(', ')}`),
    query('tags')
      .optional(),
    query('search')
      .optional()
      .isString()
      .trim()
      .withMessage('Search must be a string'),
    query('parentId')
      .optional()
      .isUUID()
      .withMessage('Parent ID must be a valid UUID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'title'])
      .withMessage('Sort by must be one of: createdAt, updatedAt, title'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc')
  ],

  search: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isString()
      .trim()
      .withMessage('Search query must be a string'),
    query('type')
      .optional()
      .isIn(entryTypes)
      .withMessage(`Type must be one of: ${entryTypes.join(', ')}`),
    query('status')
      .optional()
      .isIn(entryStatuses)
      .withMessage(`Status must be one of: ${entryStatuses.join(', ')}`),
    query('tags')
      .optional(),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  getAttachments: [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  getVersions: [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],

  getPopularTags: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  suggestTags: [
    body('content')
      .notEmpty()
      .withMessage('Content is required')
      .isString()
      .withMessage('Content must be a string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20')
  ]
};
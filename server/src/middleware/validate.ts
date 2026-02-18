import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function handleValidationErrors(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(', ');
    throw new AppError(messages, 400);
  }
  next();
}

export const registerRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .escape(),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .escape(),
  body('role')
    .isIn(['ADMIN', 'LECTURER', 'STUDENT'])
    .withMessage('Role must be ADMIN, LECTURER, or STUDENT'),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  body('phone')
    .optional()
    .trim()
    .escape(),
  handleValidationErrors,
];

export const loginRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

export const profileUpdateRules = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty')
    .escape(),
  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty')
    .escape(),
  body('phone')
    .optional()
    .trim()
    .escape(),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  handleValidationErrors,
];

const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const TIME_REGEX = /^\d{2}:\d{2}$/;

export const timetableCreateRules = [
  body('dayOfWeek')
    .isIn(VALID_DAYS)
    .withMessage(`Day must be one of: ${VALID_DAYS.join(', ')}`),
  body('startTime')
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:mm format'),
  body('endTime')
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:mm format'),
  body('courseId')
    .isUUID()
    .withMessage('Course ID must be a valid UUID'),
  body('lecturerId')
    .isUUID()
    .withMessage('Lecturer ID must be a valid UUID'),
  body('hallId')
    .isUUID()
    .withMessage('Hall ID must be a valid UUID'),
  body('groupId')
    .isUUID()
    .withMessage('Group ID must be a valid UUID'),
  body('semester')
    .optional()
    .isInt({ min: 1, max: 2 })
    .withMessage('Semester must be 1 or 2'),
  body('year')
    .optional()
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100'),
  handleValidationErrors,
];

export const timetableUpdateRules = [
  body('dayOfWeek')
    .optional()
    .isIn(VALID_DAYS)
    .withMessage(`Day must be one of: ${VALID_DAYS.join(', ')}`),
  body('startTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:mm format'),
  body('endTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:mm format'),
  body('courseId')
    .optional()
    .isUUID()
    .withMessage('Course ID must be a valid UUID'),
  body('lecturerId')
    .optional()
    .isUUID()
    .withMessage('Lecturer ID must be a valid UUID'),
  body('hallId')
    .optional()
    .isUUID()
    .withMessage('Hall ID must be a valid UUID'),
  body('groupId')
    .optional()
    .isUUID()
    .withMessage('Group ID must be a valid UUID'),
  body('semester')
    .optional()
    .isInt({ min: 1, max: 2 })
    .withMessage('Semester must be 1 or 2'),
  body('year')
    .optional()
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100'),
  handleValidationErrors,
];

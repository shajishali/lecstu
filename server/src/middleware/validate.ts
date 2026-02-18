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

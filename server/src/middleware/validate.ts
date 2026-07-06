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

const emailNormalize = { gmail_remove_dots: false, gmail_convert_googlemaildotcom: false };

export const registerRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  body('verificationCode')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Email verification code must be 6 digits'),
  body('recoveryEmail')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Personal recovery email is required'),
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
    .normalizeEmail(emailNormalize)
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
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  body('recoveryEmail')
    .optional({ values: 'null' })
    .trim()
    .custom((val) => val === '' || val === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val)))
    .withMessage('Valid recovery email is required'),
  body('departmentId')
    .optional({ values: 'null' })
    .custom((val) => !val || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))
    .withMessage('Department ID must be a valid UUID'),
  body('groupId')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Group ID must be a valid UUID'),
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

export const appointmentCreateRules = [
  body('lecturerId')
    .isUUID()
    .withMessage('Lecturer ID must be a valid UUID'),
  body('dateTime')
    .notEmpty()
    .withMessage('Date and time is required')
    .custom((v) => {
      const d = new Date(v);
      if (isNaN(d.getTime())) return false;
      return true;
    })
    .withMessage('Invalid date time format'),
  body('duration')
    .optional()
    .isInt({ min: 15, max: 120 })
    .withMessage('Duration must be between 15 and 120 minutes'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be at most 500 characters')
    .escape(),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be at most 1000 characters')
    .escape(),
  handleValidationErrors,
];

export const appointmentRescheduleRules = [
  body('dateTime')
    .notEmpty()
    .withMessage('Date and time is required')
    .custom((v) => {
      const d = new Date(v);
      if (isNaN(d.getTime())) return false;
      return true;
    })
    .withMessage('Invalid date time format'),
  body('duration')
    .optional()
    .isInt({ min: 15, max: 120 })
    .withMessage('Duration must be between 15 and 120 minutes'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be at most 500 characters')
    .escape(),
  handleValidationErrors,
];

export const cancellationRequestRules = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Cancellation reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be 10-500 characters')
    .escape(),
  handleValidationErrors,
];

export const appointmentRejectRules = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be at most 500 characters')
    .escape(),
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

const passwordRules = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
];

export const adminCreateUserRules = [
  registerRules[0], // email
  ...registerRules.slice(2, -1), // skip public registration verificationCode
  body('programCode')
    .if(body('role').equals('STUDENT'))
    .trim()
    .notEmpty()
    .withMessage('Program is required for students'),
  body('studyYear')
    .if(body('role').equals('STUDENT'))
    .trim()
    .notEmpty()
    .withMessage('Study year is required for students'),
  body('designation').optional().trim().escape(),
  body('timetableCode').optional().trim().escape(),
  handleValidationErrors,
];

export const adminUpdateUserRules = [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty').escape(),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty').escape(),
  body('phone').optional().trim().escape(),
  body('departmentId').optional({ nullable: true }).isUUID().withMessage('Department ID must be a valid UUID'),
  body('designation').optional().trim().escape(),
  body('timetableCode').optional().trim().escape(),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('programCode').optional().trim().escape(),
  body('studyYear').optional().trim().escape(),
  body('pathwayCode').optional().trim().escape(),
  handleValidationErrors,
];

export const adminResetPasswordRules = [...passwordRules, handleValidationErrors];

export const adminEmailSettingsRules = [
  body('smtpHost').trim().notEmpty().withMessage('SMTP host is required'),
  body('smtpPort').isInt({ min: 1, max: 65535 }).withMessage('SMTP port must be between 1 and 65535'),
  body('smtpUser').trim().isEmail().normalizeEmail(emailNormalize).withMessage('Valid sender email is required'),
  body('smtpPass').optional().trim(),
  body('mailFrom').trim().notEmpty().withMessage('From display name is required'),
  body('smtpDisabled').optional().isBoolean().withMessage('smtpDisabled must be boolean'),
  body('smtpSecure').optional().isBoolean().withMessage('smtpSecure must be boolean'),
  handleValidationErrors,
];

const newPasswordRules = body('newPassword')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain a number');

export const passwordChangeRules = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  newPasswordRules,
  handleValidationErrors,
];

export const profilePasswordRequestCodeRules = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  handleValidationErrors,
];

export const profilePasswordChangeWithCodeRules = [
  body('verificationCode')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Verification code must be 6 digits'),
  newPasswordRules,
  handleValidationErrors,
];

export const forgotPasswordRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  handleValidationErrors,
];

export const verifyResetCodeRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be 6 digits'),
  handleValidationErrors,
];

export const resetPasswordRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be 6 digits'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
  handleValidationErrors,
];

export const sendRegistrationCodeRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  body('firstName').optional().trim().escape(),
  body('recoveryEmail')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Personal recovery email is required'),
  handleValidationErrors,
];

export const verifyRegistrationCodeRules = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(emailNormalize)
    .withMessage('Valid email is required'),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Verification code must be 6 digits'),
  handleValidationErrors,
];

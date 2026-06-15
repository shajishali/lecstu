import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { validateStudentEnrollmentInput } from '../services/studentEnrollmentService';

function applyEnrollmentValidation(req: Request): void {
  const { programCode, studyYear, pathwayCode } = req.body;
  if (!programCode || !studyYear) {
    throw new AppError('Degree program and study year are required.', 400);
  }

  const validated = validateStudentEnrollmentInput(
    String(programCode),
    String(studyYear),
    pathwayCode ? String(pathwayCode) : null,
  );

  req.body.programCode = validated.programCode;
  req.body.studyYear = validated.studyYear;
  req.body.pathwayCode = validated.pathwayCode ?? null;
}

/** Registration: required when role is STUDENT */
export function validateStudentRegistration(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    if (req.body.role !== 'STUDENT') {
      return next();
    }
    applyEnrollmentValidation(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** Profile: annual re-enrollment (program / year / pathway) */
export function validateEnrollmentUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    applyEnrollmentValidation(req);
    next();
  } catch (err) {
    next(err);
  }
}

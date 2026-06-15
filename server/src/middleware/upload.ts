import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { AppError } from './errorHandler';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (config.upload.allowedMimeTypes.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, and WebP images are allowed', 400));
  }
}

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('avatar');

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files are allowed', 400));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

const TIMETABLE_MIMES = new Set([
  'text/csv',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const uploadTimetableFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const name = file.originalname?.toLowerCase() ?? '';
    const ok =
      TIMETABLE_MIMES.has(file.mimetype) ||
      name.endsWith('.csv') ||
      name.endsWith('.pdf') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls');
    if (ok) cb(null, true);
    else cb(new AppError('Only CSV, Excel (.xlsx/.xls), and PDF files are allowed', 400));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

export const uploadFloorPlan = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('floorplan');

export const uploadFloorPlanBulk = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 30 },
}).array('floorplans', 30);

const audioMimeTypes = [
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/webm;codecs=opus', // Browser MediaRecorder often sends this for voice
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
];

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (audioMimeTypes.includes(file.mimetype) || file.originalname?.match(/\.(wav|webm|mp3|ogg|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new AppError('Only WAV, WebM, MP3, OGG, M4A audio files are allowed', 400));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for audio
}).single('audio');

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

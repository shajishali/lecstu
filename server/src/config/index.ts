import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  /** IP-only HTTP hosting (no SSL yet): set ALLOW_HTTP_AUTH=true in .env */
  allowHttpAuth: process.env.ALLOW_HTTP_AUTH === 'true',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    uploadDir: path.resolve(__dirname, '../../uploads'),
  },

  asr: {
    // On Linux/Mac, 'python3' is often the only available command
    pythonPath: process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3'),
    asrScriptPath: path.resolve(__dirname, '../../../ai-services/asr/run_transcribe.py'),
    asrServiceUrl: process.env.ASR_SERVICE_URL || 'http://localhost:8001',
    useHttpService: process.env.ASR_USE_HTTP === 'true',
  },

  chatbot: {
    apiKey: process.env.CHATBOT_API_KEY || 'lecstu-chatbot-dev-key',
  },

  floorplanVision: {
    serviceUrl: process.env.FLOORPLAN_VISION_URL || 'http://localhost:8003',
    enabled: process.env.FLOORPLAN_VISION_ENABLED !== 'false',
  },

  indoorNavigation: {
    serviceUrl: process.env.INDOOR_NAVIGATION_URL || 'http://localhost:8004',
    enabled: process.env.INDOOR_NAVIGATION_ENABLED !== 'false',
  },

  translation: {
    pythonPath: process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3'),
    scriptPath: path.resolve(__dirname, '../../../ai-services/translation/run_translate.py'),
  },

  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    mailFrom: process.env.MAIL_FROM || 'LECSTU <lecstu.system@gmail.com>',
    /** When true, emails are logged to the server console instead of sent via SMTP. */
    smtpDisabled: process.env.SMTP_DISABLED === 'true',
  },
} as const;

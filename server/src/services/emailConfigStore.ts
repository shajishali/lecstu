import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface EmailRuntimeConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  mailFrom: string;
  smtpDisabled: boolean;
}

export interface EmailAdminSettings extends EmailRuntimeConfig {
  hasAppPassword: boolean;
}

const SETTINGS_PATH = path.resolve(__dirname, '../../data/email-settings.json');

function loadFromEnv(): EmailRuntimeConfig {
  const { email } = config;
  return {
    smtpHost: email.smtpHost,
    smtpPort: email.smtpPort,
    smtpSecure: email.smtpSecure,
    smtpUser: email.smtpUser,
    smtpPass: email.smtpPass,
    mailFrom: email.mailFrom,
    smtpDisabled: email.smtpDisabled,
  };
}

function readPersistedOverrides(): Partial<EmailRuntimeConfig> | null {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null;
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<EmailRuntimeConfig>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readRuntimeConfig(): EmailRuntimeConfig {
  const base = loadFromEnv();
  const overrides = readPersistedOverrides();
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    smtpPass: overrides.smtpPass || base.smtpPass,
  };
}

function ensureDataDir(): void {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Always reads latest admin JSON + .env (no server restart needed after settings change). */
export function getEmailRuntimeConfig(): EmailRuntimeConfig {
  return readRuntimeConfig();
}

export function getEmailAdminSettings(): EmailAdminSettings {
  const runtime = getEmailRuntimeConfig();
  return {
    ...runtime,
    hasAppPassword: Boolean(runtime.smtpPass),
  };
}

export function updateEmailRuntimeConfig(
  patch: Partial<EmailRuntimeConfig>,
): EmailRuntimeConfig {
  const current = readRuntimeConfig();
  const next: EmailRuntimeConfig = {
    ...current,
    ...patch,
  };

  if (patch.smtpPort !== undefined) {
    next.smtpPort = Number(patch.smtpPort) || 587;
  }

  if (patch.smtpPass === undefined || patch.smtpPass === '') {
    next.smtpPass = current.smtpPass;
  }

  ensureDataDir();
  fs.writeFileSync(
    SETTINGS_PATH,
    JSON.stringify(
      {
        smtpHost: next.smtpHost,
        smtpPort: next.smtpPort,
        smtpSecure: next.smtpSecure,
        smtpUser: next.smtpUser,
        smtpPass: next.smtpPass,
        mailFrom: next.mailFrom,
        smtpDisabled: next.smtpDisabled,
      },
      null,
      2,
    ),
    'utf8',
  );

  return next;
}

import fs from 'fs';
import path from 'path';

export interface PublicSiteSettings {
  loginBackgroundUrl: string;
  loginBackgroundFit: 'cover' | 'contain' | 'fill';
  loginBackgroundPositionX: number;
  loginBackgroundPositionY: number;
  loginBackgroundScale: number;
  loginBackgroundDesktopFit: 'cover' | 'contain' | 'fill';
  loginBackgroundDesktopPositionX: number;
  loginBackgroundDesktopPositionY: number;
  loginBackgroundDesktopScale: number;
  loginBackgroundMobileFit: 'cover' | 'contain' | 'fill';
  loginBackgroundMobilePositionX: number;
  loginBackgroundMobilePositionY: number;
  loginBackgroundMobileScale: number;
}

const DEFAULT_LOGIN_BACKGROUND_URL = '/home-bg.png';
const DEFAULT_LOGIN_BACKGROUND_FIT: PublicSiteSettings['loginBackgroundFit'] = 'contain';
const DEFAULT_LOGIN_BACKGROUND_POSITION = 50;
const DEFAULT_LOGIN_BACKGROUND_SCALE = 100;
const SETTINGS_PATH = path.resolve(__dirname, '../../data/site-settings.json');

function ensureDataDir(): void {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitizeLoginBackgroundUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LOGIN_BACKGROUND_URL;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_LOGIN_BACKGROUND_URL;
  if (trimmed.startsWith('/uploads/') || trimmed === DEFAULT_LOGIN_BACKGROUND_URL) {
    return trimmed;
  }
  return DEFAULT_LOGIN_BACKGROUND_URL;
}

function sanitizeFit(value: unknown): PublicSiteSettings['loginBackgroundFit'] {
  return value === 'contain' || value === 'fill' || value === 'cover'
    ? value
    : DEFAULT_LOGIN_BACKGROUND_FIT;
}

function sanitizePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGIN_BACKGROUND_POSITION;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function sanitizeScale(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGIN_BACKGROUND_SCALE;
  return Math.min(200, Math.max(50, Math.round(n)));
}

function readPersistedSettings(): Partial<PublicSiteSettings> | null {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null;
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PublicSiteSettings>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function getPublicSiteSettings(): PublicSiteSettings {
  const persisted = readPersistedSettings();
  const fit = sanitizeFit(persisted?.loginBackgroundFit);
  const positionX = sanitizePercent(persisted?.loginBackgroundPositionX);
  const positionY = sanitizePercent(persisted?.loginBackgroundPositionY);
  const scale = sanitizeScale(persisted?.loginBackgroundScale);
  return {
    loginBackgroundUrl: sanitizeLoginBackgroundUrl(persisted?.loginBackgroundUrl),
    loginBackgroundFit: fit,
    loginBackgroundPositionX: positionX,
    loginBackgroundPositionY: positionY,
    loginBackgroundScale: scale,
    loginBackgroundDesktopFit: sanitizeFit(persisted?.loginBackgroundDesktopFit ?? fit),
    loginBackgroundDesktopPositionX: sanitizePercent(persisted?.loginBackgroundDesktopPositionX ?? positionX),
    loginBackgroundDesktopPositionY: sanitizePercent(persisted?.loginBackgroundDesktopPositionY ?? positionY),
    loginBackgroundDesktopScale: sanitizeScale(persisted?.loginBackgroundDesktopScale ?? scale),
    loginBackgroundMobileFit: sanitizeFit(persisted?.loginBackgroundMobileFit ?? fit),
    loginBackgroundMobilePositionX: sanitizePercent(persisted?.loginBackgroundMobilePositionX ?? positionX),
    loginBackgroundMobilePositionY: sanitizePercent(persisted?.loginBackgroundMobilePositionY ?? positionY),
    loginBackgroundMobileScale: sanitizeScale(persisted?.loginBackgroundMobileScale ?? scale),
  };
}

export function updatePublicSiteSettings(patch: Partial<PublicSiteSettings>): PublicSiteSettings {
  const current = getPublicSiteSettings();
  const next: PublicSiteSettings = {
    ...current,
    ...(patch.loginBackgroundUrl !== undefined
      ? { loginBackgroundUrl: sanitizeLoginBackgroundUrl(patch.loginBackgroundUrl) }
      : {}),
    ...(patch.loginBackgroundFit !== undefined
      ? { loginBackgroundFit: sanitizeFit(patch.loginBackgroundFit) }
      : {}),
    ...(patch.loginBackgroundPositionX !== undefined
      ? { loginBackgroundPositionX: sanitizePercent(patch.loginBackgroundPositionX) }
      : {}),
    ...(patch.loginBackgroundPositionY !== undefined
      ? { loginBackgroundPositionY: sanitizePercent(patch.loginBackgroundPositionY) }
      : {}),
    ...(patch.loginBackgroundScale !== undefined
      ? { loginBackgroundScale: sanitizeScale(patch.loginBackgroundScale) }
      : {}),
    ...(patch.loginBackgroundDesktopFit !== undefined
      ? { loginBackgroundDesktopFit: sanitizeFit(patch.loginBackgroundDesktopFit) }
      : {}),
    ...(patch.loginBackgroundDesktopPositionX !== undefined
      ? { loginBackgroundDesktopPositionX: sanitizePercent(patch.loginBackgroundDesktopPositionX) }
      : {}),
    ...(patch.loginBackgroundDesktopPositionY !== undefined
      ? { loginBackgroundDesktopPositionY: sanitizePercent(patch.loginBackgroundDesktopPositionY) }
      : {}),
    ...(patch.loginBackgroundDesktopScale !== undefined
      ? { loginBackgroundDesktopScale: sanitizeScale(patch.loginBackgroundDesktopScale) }
      : {}),
    ...(patch.loginBackgroundMobileFit !== undefined
      ? { loginBackgroundMobileFit: sanitizeFit(patch.loginBackgroundMobileFit) }
      : {}),
    ...(patch.loginBackgroundMobilePositionX !== undefined
      ? { loginBackgroundMobilePositionX: sanitizePercent(patch.loginBackgroundMobilePositionX) }
      : {}),
    ...(patch.loginBackgroundMobilePositionY !== undefined
      ? { loginBackgroundMobilePositionY: sanitizePercent(patch.loginBackgroundMobilePositionY) }
      : {}),
    ...(patch.loginBackgroundMobileScale !== undefined
      ? { loginBackgroundMobileScale: sanitizeScale(patch.loginBackgroundMobileScale) }
      : {}),
  };

  ensureDataDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function resetPublicSiteSettings(): PublicSiteSettings {
  const next: PublicSiteSettings = {
    loginBackgroundUrl: DEFAULT_LOGIN_BACKGROUND_URL,
    loginBackgroundFit: DEFAULT_LOGIN_BACKGROUND_FIT,
    loginBackgroundPositionX: DEFAULT_LOGIN_BACKGROUND_POSITION,
    loginBackgroundPositionY: DEFAULT_LOGIN_BACKGROUND_POSITION,
    loginBackgroundScale: DEFAULT_LOGIN_BACKGROUND_SCALE,
    loginBackgroundDesktopFit: DEFAULT_LOGIN_BACKGROUND_FIT,
    loginBackgroundDesktopPositionX: DEFAULT_LOGIN_BACKGROUND_POSITION,
    loginBackgroundDesktopPositionY: DEFAULT_LOGIN_BACKGROUND_POSITION,
    loginBackgroundDesktopScale: DEFAULT_LOGIN_BACKGROUND_SCALE,
    loginBackgroundMobileFit: DEFAULT_LOGIN_BACKGROUND_FIT,
    loginBackgroundMobilePositionX: DEFAULT_LOGIN_BACKGROUND_POSITION,
    loginBackgroundMobilePositionY: DEFAULT_LOGIN_BACKGROUND_POSITION,
    loginBackgroundMobileScale: DEFAULT_LOGIN_BACKGROUND_SCALE,
  };

  ensureDataDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

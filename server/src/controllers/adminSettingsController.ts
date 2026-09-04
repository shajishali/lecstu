import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import prisma from '../config/database';
import { getFacultySetupStatus } from '../services/facultyBuildingSeed';
import { isNavigationEngineHealthy } from '../services/floorNavigationEngineService';
import { isVisionServiceHealthy } from '../services/floorPlanVisionService';
import { getEmailServiceStatus, sendTestEmail, saveEmailAdminSettings } from '../services/emailService';
import { AppError } from '../middleware/errorHandler';
import {
  getPublicSiteSettings,
  resetPublicSiteSettings,
  updatePublicSiteSettings,
} from '../services/siteSettingsStore';

const APPOINTMENT_MIN_NOTICE_HOURS = 24;

async function checkAsrAvailable(): Promise<boolean> {
  if (config.asr.useHttpService) {
    try {
      const r = await axios.get(`${config.asr.asrServiceUrl}/health`, { timeout: 3000 });
      return r.status === 200 && (r.data?.status === 'ok' || r.data?.available === true);
    } catch {
      return false;
    }
  }
  return true;
}

export async function getAdminSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const [asrHealthy, indoorHealthy, visionHealthy, facultySetup] = await Promise.all([
      checkAsrAvailable(),
      isNavigationEngineHealthy(),
      isVisionServiceHealthy(),
      getFacultySetupStatus(prisma),
    ]);

    const emailStatus = getEmailServiceStatus();
    const appearance = getPublicSiteSettings();

    res.json({
      success: true,
      data: {
        appearance,
        platform: {
          name: 'LECSTU',
          subtitle: 'Academic Platform',
          environment: config.nodeEnv,
          clientUrl: config.clientUrl,
          uploadMaxMb: config.upload.maxFileSize / (1024 * 1024),
          jwtAccessExpiry: config.jwt.accessExpiry,
          appointmentMinNoticeHours: APPOINTMENT_MIN_NOTICE_HOURS,
        },
        services: {
          api: { label: 'API Server', healthy: true, url: `http://localhost:${config.port}` },
          asr: {
            label: 'Speech Recognition (ASR)',
            healthy: asrHealthy,
            url: config.asr.asrServiceUrl,
            enabled: true,
          },
          indoorNavigation: {
            label: 'Indoor Navigation Engine',
            healthy: indoorHealthy,
            url: config.indoorNavigation.serviceUrl,
            enabled: config.indoorNavigation.enabled,
          },
          floorplanVision: {
            label: 'Floor Plan Vision',
            healthy: visionHealthy,
            url: config.floorplanVision.serviceUrl,
            enabled: config.floorplanVision.enabled,
          },
          email: {
            ...emailStatus,
            healthy: emailStatus.passwordResetReady,
          },
        },
        facultySetup: {
          ready: facultySetup.ready,
          allBuildingsExist: facultySetup.allBuildingsExist,
          phase: facultySetup.phase,
          activeFloors: facultySetup.activeFloors,
          totalExpectedFloors: facultySetup.totalExpectedFloors,
          totalUploaded: facultySetup.totalUploaded,
          phase11Target: facultySetup.phase11Target,
          phase11Uploaded: facultySetup.phase11Uploaded,
          phase11Published: facultySetup.phase11Published,
          buildings: facultySetup.buildings.map((b) => ({
            code: b.code,
            name: b.name,
            exists: b.exists,
            uploadedCount: b.uploadedCount,
            floors: b.floors,
            phase11PublishedCount: b.phase11PublishedCount,
            phase11MissingFloors: b.phase11MissingFloors,
          })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPublicSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: {
        appearance: getPublicSiteSettings(),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLoginBackground(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('No background image provided', 400);

    const previous = getPublicSiteSettings().loginBackgroundUrl;
    const imageUrl = `/uploads/auth-backgrounds/${req.file.filename}`;
    const appearance = updatePublicSiteSettings({ loginBackgroundUrl: imageUrl });

    if (previous.startsWith('/uploads/auth-backgrounds/') && previous !== imageUrl) {
      const oldPath = path.join(config.upload.uploadDir, previous.replace(/^\/uploads\/?/i, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    res.json({
      success: true,
      message: 'Login background image updated',
      data: { appearance },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLoginBackgroundAppearance(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      loginBackgroundFit,
      loginBackgroundPositionX,
      loginBackgroundPositionY,
      loginBackgroundScale,
      loginBackgroundDesktopFit,
      loginBackgroundDesktopPositionX,
      loginBackgroundDesktopPositionY,
      loginBackgroundDesktopScale,
      loginBackgroundMobileFit,
      loginBackgroundMobilePositionX,
      loginBackgroundMobilePositionY,
      loginBackgroundMobileScale,
    } = req.body;

    const appearance = updatePublicSiteSettings({
      loginBackgroundFit,
      loginBackgroundPositionX,
      loginBackgroundPositionY,
      loginBackgroundScale,
      loginBackgroundDesktopFit,
      loginBackgroundDesktopPositionX,
      loginBackgroundDesktopPositionY,
      loginBackgroundDesktopScale,
      loginBackgroundMobileFit,
      loginBackgroundMobilePositionX,
      loginBackgroundMobilePositionY,
      loginBackgroundMobileScale,
    });

    res.json({
      success: true,
      message: 'Login background display saved',
      data: { appearance },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteLoginBackground(_req: Request, res: Response, next: NextFunction) {
  try {
    const previous = getPublicSiteSettings().loginBackgroundUrl;
    const appearance = resetPublicSiteSettings();

    if (previous.startsWith('/uploads/auth-backgrounds/')) {
      const oldPath = path.join(config.upload.uploadDir, previous.replace(/^\/uploads\/?/i, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    res.json({
      success: true,
      message: 'Login background reset to default',
      data: { appearance },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminEmailSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, mailFrom, smtpDisabled, smtpSecure } = req.body;

    const email = saveEmailAdminSettings({
      smtpHost: String(smtpHost).trim(),
      smtpPort: Number(smtpPort),
      smtpUser: String(smtpUser).trim().toLowerCase(),
      ...(smtpPass ? { smtpPass: String(smtpPass).trim() } : {}),
      mailFrom: String(mailFrom).trim(),
      smtpDisabled: Boolean(smtpDisabled),
      ...(smtpSecure !== undefined ? { smtpSecure: Boolean(smtpSecure) } : {}),
    });

    res.json({
      success: true,
      message: 'Email settings saved',
      data: { email: { ...email, healthy: email.passwordResetReady } },
    });
  } catch (err) {
    next(err);
  }
}

export async function sendAdminTestEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const adminEmail = req.user?.email;
    if (!adminEmail) throw new AppError('Admin email not found', 400);

    const status = getEmailServiceStatus();
    if (!status.passwordResetReady) {
      throw new AppError(
        'Email service is not ready. Set SMTP_* in server/.env or SMTP_DISABLED=true for console mode.',
        503,
      );
    }

    const result = await sendTestEmail(adminEmail);
    res.json({
      success: true,
      message:
        result.mode === 'smtp'
          ? `Test email sent to ${adminEmail}`
          : `SMTP disabled - test email logged to server console (check API terminal)`,
      data: { mode: result.mode, delivered: result.delivered, to: adminEmail },
    });
  } catch (err) {
    next(err);
  }
}

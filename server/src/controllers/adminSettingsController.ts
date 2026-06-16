import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { config } from '../config';
import prisma from '../config/database';
import { getFacultySetupStatus } from '../services/facultyBuildingSeed';
import { isNavigationEngineHealthy } from '../services/floorNavigationEngineService';
import { isVisionServiceHealthy } from '../services/floorPlanVisionService';

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

    res.json({
      success: true,
      data: {
        platform: {
          name: 'LECSTU',
          subtitle: 'AI-Integrated Academic Platform',
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

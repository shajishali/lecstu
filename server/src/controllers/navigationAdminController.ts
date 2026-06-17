import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { config } from '../config';
import { getFacultySetupStatus } from '../services/facultyBuildingSeed';
import { isNavigationEngineHealthy } from '../services/floorNavigationEngineService';
import { isVisionServiceHealthy } from '../services/floorPlanVisionService';
import { validateFloorNavGraph } from '../services/navGraphValidationService';
import { PHASE_11_ACTIVE_FLOORS } from '../constants/facultyBuildings';

/** GET /admin/navigation/health — AI services + per-floor graph connectivity */
export async function getNavigationHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const [visionHealthy, navHealthy, setup] = await Promise.all([
      isVisionServiceHealthy(),
      isNavigationEngineHealthy(),
      getFacultySetupStatus(prisma),
    ]);

    const buildings = await prisma.mapBuilding.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        floors: true,
        floorPlans: {
          select: { floor: true, publishStatus: true, imagePath: true, locationsLockedAt: true },
          orderBy: { floor: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    const graphFloors: Array<{
      buildingCode: string;
      buildingName: string;
      floor: number;
      publishStatus: string;
      hasImage: boolean;
      locationsLocked: boolean;
      healthy: boolean;
      nodeCount: number;
      edgeCount: number;
      isConnected: boolean;
      issues: string[];
    }> = [];

    for (const b of buildings) {
      const plans = b.floorPlans.filter((p) => p.floor < b.floors);
      for (const plan of plans) {
        if (!plan.imagePath) continue;
        const v = await validateFloorNavGraph(b.id, plan.floor);
        graphFloors.push({
          buildingCode: b.code,
          buildingName: b.name,
          floor: plan.floor,
          publishStatus: plan.publishStatus,
          hasImage: true,
          locationsLocked: !!plan.locationsLockedAt,
          healthy: v.healthy,
          nodeCount: v.nodeCount,
          edgeCount: v.edgeCount,
          isConnected: v.isConnected,
          issues: v.issues.slice(0, 3),
        });
      }
    }

    const healthyGraphs = graphFloors.filter((g) => g.healthy).length;
    const phase11Graphs = graphFloors.filter((g) =>
      (PHASE_11_ACTIVE_FLOORS as readonly number[]).includes(g.floor)
    );

    res.json({
      success: true,
      data: {
        services: {
          vision: {
            label: 'Floor Plan Vision',
            port: 8003,
            healthy: visionHealthy,
            url: config.floorplanVision.serviceUrl,
            enabled: config.floorplanVision.enabled,
          },
          navigation: {
            label: 'Indoor Navigation Engine',
            port: 8004,
            healthy: navHealthy,
            url: config.indoorNavigation.serviceUrl,
            enabled: config.indoorNavigation.enabled,
          },
        },
        setup,
        graphs: {
          total: graphFloors.length,
          healthy: healthyGraphs,
          phase11Total: phase11Graphs.length,
          phase11Healthy: phase11Graphs.filter((g) => g.healthy).length,
          floors: graphFloors,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

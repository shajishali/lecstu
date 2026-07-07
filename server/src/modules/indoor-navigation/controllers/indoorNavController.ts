import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../middleware/errorHandler';
import { listNavNodes } from '../repositories/nav-graph.repository';
import {
  createQrCode,
  deleteQrCode,
  listQrCodes,
} from '../repositories/qr-code.repository';
import { resolvePosition } from '../positioning/position-service';
import {
  completeSession,
  createOrUpdateSession,
  getActiveSession,
  getSessionById,
  updateSessionStepIndex,
} from '../services/navigation-session.service';
import { executeUnifiedNavigationQuery } from '../../../services/unifiedNavigationQueryService';
import { computeRouteRequest } from '../services/route.service';
import { resolveStepIndexForPathNode } from '../utils/activeNavigation';

/** GET /indoor-nav/buildings-with-guides - buildings that have a built navigation guide */
export async function getBuildingsWithGuides(_req: Request, res: Response, next: NextFunction) {
  try {
    const { listBuildingsWithGuides } = await import('../../../services/floorNavigationStoryService');
    const data = await listBuildingsWithGuides();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /indoor-nav/places?buildingId= - story guide places for student picker */
export async function getGuidePlaces(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    const floorRaw = req.query.floor;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const floor =
      floorRaw !== undefined && floorRaw !== ''
        ? parseInt(String(floorRaw), 10)
        : undefined;
    const { listGuidePlaces } = await import('../../../services/floorNavigationStoryService');
    let data = await listGuidePlaces(buildingId);
    if (floor !== undefined && !Number.isNaN(floor)) {
      data = data.filter((p: { floor: number }) => p.floor === floor);
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** POST /indoor-nav/story - plain-language directions from admin notes */
export async function postStoryGuide(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, destination, from, floor, message } = req.body ?? {};
    let dest = (destination as string)?.trim();
    const fromQ = (from as string)?.trim();
    const floorNum = floor !== undefined ? parseInt(String(floor), 10) : undefined;

    if (!buildingId) throw new AppError('buildingId is required', 400);

    if (!dest && message) {
      const { parseSourceDestinationQuery } = await import('../../../services/mapSearchService');
      const parsed = parseSourceDestinationQuery(String(message));
      dest = parsed.destinationQuery || String(message).trim();
    }
    if (!dest) throw new AppError('destination or message is required', 400);

    const { getStoryDirections } = await import('../../../services/floorNavigationStoryService');
    const data = await getStoryDirections({
      buildingId,
      destinationQuery: dest,
      fromQuery: fromQ || undefined,
      floor: floorNum,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /indoor-nav/nodes?buildingId=&floor= */
export async function getNodes(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    const floorRaw = req.query.floor;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const floor = floorRaw !== undefined && floorRaw !== '' ? parseInt(String(floorRaw), 10) : undefined;
    const data = await listNavNodes(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /indoor-nav/floorplans - alias for map buildings with floor plans */
export async function getFloorplans(_req: Request, res: Response, next: NextFunction) {
  try {
    const { listMapBuildings } = await import('../../../controllers/mapController');
    return listMapBuildings(_req, res, next);
  } catch (err) {
    next(err);
  }
}

/** POST /indoor-nav/route - compute route (+ optional session) */
export async function postRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      buildingId,
      fromBuildingId,
      toBuildingId,
      toHallId,
      toMarkerId,
      toOfficeId,
      fromNodeId,
      fromMarkerId,
      fromOfficeId,
      q,
      sourceQ,
      floor,
      fromFloor,
      sessionId,
      saveSession,
      useActivePosition,
    } = req.body ?? {};

    if (!toHallId && !toMarkerId && !toOfficeId && !q?.trim()) {
      throw new AppError('Provide toHallId, toMarkerId, toOfficeId, or q (destination)', 400);
    }

    const destBuildingId = toBuildingId || buildingId;
    let effectiveFromNodeId = fromNodeId as string | undefined;

    if (sessionId && req.user?.userId) {
      const session = await getSessionById(sessionId, req.user.userId);
      if (session?.currentNodeId) effectiveFromNodeId = session.currentNodeId;
    } else if (
      useActivePosition &&
      req.user?.userId &&
      destBuildingId &&
      !fromMarkerId &&
      !effectiveFromNodeId
    ) {
      const active = await getActiveSession(req.user.userId, destBuildingId);
      if (active?.currentNodeId) effectiveFromNodeId = active.currentNodeId;
    } else if (req.user?.userId && destBuildingId && !fromMarkerId && !fromBuildingId) {
      const active = await getActiveSession(req.user.userId, destBuildingId);
      if (active?.currentNodeId) effectiveFromNodeId = active.currentNodeId;
    }

    const { formatted, fromNodeId: resolvedFrom } = await computeRouteRequest({
      buildingId: destBuildingId,
      fromBuildingId,
      toBuildingId,
      toHallId,
      toMarkerId,
      toOfficeId,
      fromMarkerId,
      fromOfficeId,
      fromNodeId: effectiveFromNodeId,
      q: q?.trim(),
      sourceQ: sourceQ?.trim(),
      floor: floor !== undefined ? parseInt(String(floor), 10) : undefined,
      fromFloor: fromFloor !== undefined ? parseInt(String(fromFloor), 10) : undefined,
      forAdmin: req.user?.role === 'ADMIN',
    });

    if (saveSession && req.user?.userId && formatted.found && destBuildingId) {
      const session = await createOrUpdateSession({
        userId: req.user.userId,
        buildingId: destBuildingId,
        currentNodeId: resolvedFrom ?? formatted.startNodeId,
        currentFloor: formatted.startFloor,
        destinationNodeId: formatted.goalNodeId,
        routePayload: formatted,
        stepIndex: 0,
      });
      (formatted as Record<string, unknown>).sessionId = session.id;
    }

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

/** GET /indoor-nav/route/:sessionId */
export async function getRouteBySession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Authentication required', 401);
    const session = await getSessionById(String(req.params.sessionId), userId);
    if (!session) throw new AppError('Navigation session not found', 404);
    res.json({
      success: true,
      data: {
        session,
        route: session.routePayload,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /indoor-nav/navigation - NL query (shared pipeline with /navigation/query) */
export async function postNavigation(req: Request, res: Response, next: NextFunction) {
  try {
    const message = (req.body?.message as string)?.trim();
    const buildingId = req.body?.buildingId as string | undefined;
    if (!message) throw new AppError('message is required', 400);

    const data = await executeUnifiedNavigationQuery({
      message,
      buildingId,
      fromNodeId: req.body?.fromNodeId,
      userId: req.user?.userId,
      userRole: req.user?.role,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** POST /indoor-nav/position/qr - update position from QR scan; optional reroute */
export async function postQrPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Authentication required', 401);

    const code = (req.body?.code as string)?.trim();
    if (!code) throw new AppError('code is required', 400);
    const reroute = req.body?.reroute !== false;

    const position = await resolvePosition('QR_CODE', code);
    if (!position) throw new AppError('Unknown or inactive QR code', 404);

    const prisma = (await import('../../../config/database')).default;
    const node = await prisma.navNode.findUnique({
      where: { id: position.nodeId },
      select: { buildingId: true },
    });
    if (!node) throw new AppError('Navigation node not found', 404);

    const prior = await getActiveSession(userId, node.buildingId);
    const priorPayload = prior?.routePayload as Record<string, unknown> | null;
    const destinationNodeId = prior?.destinationNodeId ?? null;

    let reroutedRoute: Awaited<ReturnType<typeof computeRouteRequest>>['formatted'] | null = null;
    let stepIndex = prior?.stepIndex ?? 0;

    const hasDestination =
      destinationNodeId ||
      priorPayload?.destinationLabel ||
      (priorPayload?.marker as { id?: string } | undefined)?.id;

    if (reroute && hasDestination) {
      const marker = priorPayload?.marker as { id?: string; floor?: number } | undefined;
      const { formatted } = await computeRouteRequest({
        buildingId: node.buildingId,
        fromNodeId: position.nodeId,
        toMarkerId: marker?.id,
        q: (priorPayload?.destinationLabel as string) || undefined,
        floor: marker?.floor,
        forAdmin: req.user?.role === 'ADMIN',
      });
      if (formatted.found) {
        reroutedRoute = formatted;
        const steps = (formatted.steps || []).map((s) =>
          typeof s === 'string' ? { instruction: s, floor: 0 } : s
        );
        stepIndex = resolveStepIndexForPathNode(
          steps,
          formatted.pathNodeIds || [],
          position.nodeId,
          position.floor
        );
      }
    } else if (priorPayload?.steps) {
      const steps = (priorPayload.steps as Array<{ instruction: string; floor: number }>) || [];
      stepIndex = resolveStepIndexForPathNode(
        steps,
        (priorPayload.pathNodeIds as string[]) || [],
        position.nodeId,
        position.floor
      );
    }

    const session = await createOrUpdateSession({
      userId,
      buildingId: node.buildingId,
      currentNodeId: position.nodeId,
      currentFloor: position.floor,
      destinationNodeId: destinationNodeId || reroutedRoute?.goalNodeId || undefined,
      positionSource: 'QR_CODE',
      routePayload: reroutedRoute ?? priorPayload ?? undefined,
      stepIndex,
    });

    res.json({
      success: true,
      data: {
        position,
        session,
        route: reroutedRoute,
        stepIndex,
        message: reroutedRoute
          ? `You are at ${position.label} - route updated from here`
          : `You are at ${position.label}`,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /indoor-nav/session/:id/step - sync step index during active navigation */
export async function patchSessionStep(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Authentication required', 401);

    const stepIndex = parseInt(String(req.body?.stepIndex ?? ''), 10);
    if (Number.isNaN(stepIndex) || stepIndex < 0) {
      throw new AppError('stepIndex must be a non-negative integer', 400);
    }

    const session = await updateSessionStepIndex(String(req.params.id), userId, stepIndex);
    if (!session) throw new AppError('Navigation session not found', 404);

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

/** GET /indoor-nav/session/active */
export async function getActiveNavigationSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Authentication required', 401);
    const buildingId = req.query.buildingId as string | undefined;
    const session = await getActiveSession(userId, buildingId);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

/** POST /indoor-nav/session/:id/complete */
export async function postCompleteSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Authentication required', 401);
    await completeSession(String(req.params.id), userId);
    res.json({ success: true, message: 'Session completed' });
  } catch (err) {
    next(err);
  }
}

/** Admin: GET /indoor-nav/qr?buildingId= */
export async function getQrCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const data = await listQrCodes(buildingId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** Admin: POST /indoor-nav/qr */
export async function postQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, navNodeId, label, code } = req.body ?? {};
    if (!buildingId || !navNodeId) throw new AppError('buildingId and navNodeId are required', 400);
    const data = await createQrCode({ buildingId, navNodeId, label, code });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** Admin: DELETE /indoor-nav/qr/:id */
export async function deleteQrCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteQrCode(String(req.params.id));
    res.json({ success: true, message: 'QR code deleted' });
  } catch (err) {
    next(err);
  }
}

/** Legacy aliases: POST /indoor-nav/nodes and POST /indoor-nav/edges delegate to admin nav-graph */
export async function postNodeAlias(req: Request, res: Response, next: NextFunction) {
  const { createNavNodeHandler } = await import('../../../controllers/navGraphController');
  return createNavNodeHandler(req, res, next);
}

export async function postEdgeAlias(req: Request, res: Response, next: NextFunction) {
  const { createNavEdgeHandler } = await import('../../../controllers/navGraphController');
  return createNavEdgeHandler(req, res, next);
}

export async function postFloorplanAlias(req: Request, res: Response, next: NextFunction) {
  next(new AppError('Use POST /admin/buildings/:id/floorplan with building ID in path', 400));
}

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { detectNavigationIntent } from '../services/navigationIntentService';
import { generateAiDirections, isNavigationEngineHealthy } from '../services/floorNavigationEngineService';
import { searchMapEntities, pickBestMapSearchResult, parseSourceDestinationQuery } from '../services/mapSearchService';
import { computeRouteRequest } from '../modules/indoor-navigation/services/route.service';

export async function postDetectIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const message = (req.body?.message as string) || '';
    if (!message.trim()) throw new AppError('message is required', 400);
    const result = await detectNavigationIntent(message.trim());
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getEngineHealth(_req: Request, res: Response) {
  const healthy = await isNavigationEngineHealthy();
  res.json({
    success: true,
    data: {
      engine: 'indoor-navigation-engine',
      healthy,
      url: process.env.INDOOR_NAVIGATION_URL || 'http://localhost:8004',
    },
  });
}

export async function postNavigationQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const message = (req.body?.message as string)?.trim();
    const buildingId = req.body?.buildingId as string | undefined;
    const fromNodeId = req.body?.fromNodeId as string | undefined;

    if (!message) throw new AppError('message is required', 400);

    const intent = await detectNavigationIntent(message);

    if (!intent.isNavigation) {
      res.json({
        success: true,
        data: {
          routed: false,
          intent,
          message: 'Not a navigation query — handled by general chatbot.',
        },
      });
      return;
    }

    if (intent.intent === 'guide_to_next_class') {
      res.json({
        success: true,
        data: {
          routed: true,
          intent,
          action: 'guide_to_next_class',
          message: 'Use chatbot action action_guide_to_next_class or GET /map/indoor-route/today',
        },
      });
      return;
    }

    const parsed = parseSourceDestinationQuery(message);
    const query = parsed.destinationQuery || intent.destinationQuery || message;
    const sourceQ = parsed.sourceQuery;

    const { resolveBuildingIdFromHint } = await import('../services/mapSearchService');
    const { getStoryDirections } = await import('../services/floorNavigationStoryService');

    const hintedBuildingId = parsed.buildingHint
      ? await resolveBuildingIdFromHint(parsed.buildingHint)
      : null;

    if (hintedBuildingId && query) {
      try {
        const hintedStory = await getStoryDirections({
          buildingId: hintedBuildingId,
          destinationQuery: query,
          fromQuery: sourceQ ?? undefined,
        });
        if (hintedStory.found) {
          const deepLink = `/navigate?buildingId=${hintedBuildingId}&q=${encodeURIComponent(hintedStory.destinationLabel || query)}`;
          res.json({
            success: true,
            data: {
              routed: true,
              intent,
              sourceQuery: sourceQ,
              destinationQuery: query,
              found: true,
              building: hintedStory.building,
              destinationLabel: hintedStory.destinationLabel,
              steps: hintedStory.steps.map((instruction) => ({ instruction, floor: hintedStory.floor ?? 0 })),
              polyline: hintedStory.polyline,
              deepLink,
            },
          });
          return;
        }
      } catch (storyErr) {
        if (!(storyErr instanceof AppError && storyErr.statusCode === 404)) throw storyErr;
      }
    }

    const searchResults = await searchMapEntities(message);
    const room = pickBestMapSearchResult(query, searchResults);

    if (!room?.buildingId) {
      res.json({
        success: true,
        data: {
          routed: true,
          intent,
          found: false,
          message: `Could not find **${query}** on the indoor map. Check the room name on the floor plan (Admin → Room map editor) or try a more specific name like "ELECTRICAL ROOM".`,
          steps: [],
          segments: [],
          deepLink: null,
          confidence: intent.confidence,
        },
      });
      return;
    }

    if (buildingId && room.buildingId !== buildingId) {
      throw new AppError('Room not found in the specified building', 404);
    }

    let storyBuildingId = hintedBuildingId || room.buildingId;

    let story;
    try {
      story = await getStoryDirections({
        buildingId: storyBuildingId,
        destinationQuery: query,
        fromQuery: sourceQ ?? undefined,
        floor: room.floor,
      });
    } catch (storyErr) {
      if (storyErr instanceof AppError && storyErr.statusCode === 404) {
        res.json({
          success: true,
          data: {
            routed: true,
            intent,
            found: false,
            message: storyErr.message,
            steps: [],
            segments: [],
            deepLink: null,
            confidence: intent.confidence,
          },
        });
        return;
      }
      throw storyErr;
    }

    if (story.found) {
      const deepLink = `/navigate?buildingId=${storyBuildingId}&q=${encodeURIComponent(story.destinationLabel || room.label)}`;
      res.json({
        success: true,
        data: {
          routed: true,
          intent,
          sourceQuery: sourceQ,
          destinationQuery: query,
          found: true,
          building: story.building,
          destinationLabel: story.destinationLabel,
          steps: story.steps.map((instruction) => ({ instruction, floor: story.floor ?? 0 })),
          polyline: story.polyline,
          deepLink,
          roomLabel: room.label,
        },
      });
      return;
    }

    if (story.suggestedBuildingId) {
      const deepLink = `/navigate?buildingId=${story.suggestedBuildingId}&q=${encodeURIComponent(story.destinationLabel || query)}`;
      res.json({
        success: true,
        data: {
          routed: true,
          intent,
          found: false,
          message: story.message,
          suggestedBuildingId: story.suggestedBuildingId,
          suggestedBuildingName: story.suggestedBuildingName,
          deepLink,
          steps: [],
          segments: [],
          confidence: intent.confidence,
        },
      });
      return;
    }

    const { formatted } = await computeRouteRequest({
      buildingId: room.buildingId,
      toMarkerId: room.markerId,
      toHallId: room.hallId,
      q: query,
      sourceQ: sourceQ ?? undefined,
      floor: room.floor,
      fromNodeId,
    });

    res.json({
      success: true,
      data: {
        routed: true,
        intent,
        sourceQuery: sourceQ,
        destinationQuery: query,
        ...formatted,
        roomLabel: room.label,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function postGenerateDirections(req: Request, res: Response, next: NextFunction) {
  try {
    const { destinationLabel, buildingName, polyline, pathNodes } = req.body ?? {};
    if (!polyline?.length && !pathNodes?.length) {
      throw new AppError('polyline or pathNodes required', 400);
    }

    const ai = await generateAiDirections({
      destinationLabel: destinationLabel || 'destination',
      buildingName,
      polyline: polyline || [],
      pathNodes,
    });

    if (!ai) throw new AppError('Navigation engine unavailable', 503);
    res.json({ success: true, data: ai });
  } catch (err) {
    next(err);
  }
}

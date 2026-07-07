/**
 * Floor Navigation AI Engine client - HTTP bridge to Python microservice (port 8004).
 */
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { resolveUploadFilePath } from './floorPlanStorage';

const TIMEOUT_MS = 180_000;

export type EngineFloorAnalysis = {
  rooms: Array<{
    label: string;
    x: number;
    y: number;
    confidence?: number;
    type?: string;
    source?: string;
    legendNumber?: number;
    raw_text?: string;
  }>;
  legend_places?: Array<{
    label: string;
    x: number;
    y: number;
    confidence?: number;
    type?: string;
    source?: string;
    legendNumber?: number;
    raw_text?: string;
  }>;
  entrances: Array<{ label: string; x: number; y: number; type?: string; confidence?: number }>;
  doors: Array<{ label: string; x: number; y: number; confidence?: number }>;
  corridors: Array<{ label: string; x: number; y: number; type?: string; confidence?: number }>;
  nodes: Array<{ id: string; label: string; x: number; y: number; type: string; confidence?: number }>;
  edges: Array<{ from: string; to: string; weight: number; label?: string | null }>;
  stats: Record<string, number>;
  confidence: number;
  engine: string;
  ocr_engine?: string;
  drawableRegion?: { x0: number; y0: number; x1: number; y1: number };
};

export type EngineDirections = {
  steps: Array<{ instruction: string; floor: number; confidence?: number }>;
  confidence: number;
  engine: string;
  destination_validated?: boolean;
};

export async function isNavigationEngineHealthy(): Promise<boolean> {
  if (!config.indoorNavigation.enabled) return false;
  try {
    const res = await fetch(`${config.indoorNavigation.serviceUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function callNavigationEngine<T>(
  endpoint: string,
  body?: unknown,
  method: 'GET' | 'POST' = 'POST'
): Promise<T> {
  const url = `${config.indoorNavigation.serviceUrl}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const raw = await res.text();
    throw new AppError(
      `Navigation engine failed (${res.status}): ${raw.slice(0, 200)}`,
      res.status >= 500 ? 502 : res.status
    );
  }

  return (await res.json()) as T;
}

export async function processFloorMapWithEngine(imagePath: string): Promise<EngineFloorAnalysis> {
  const absolutePath = resolveUploadFilePath(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('Floor plan image file not found on disk', 404);
  }

  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase() || '.jpg';
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), path.basename(absolutePath));

  const res = await fetch(`${config.indoorNavigation.serviceUrl}/floor/process`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const raw = await res.text();
    const hint =
      res.status === 503 || res.status === 502
        ? 'Start Terminal 5: cd ai-services/indoor-navigation-engine → .\\run_engine.ps1'
        : 'Check the navigation engine terminal for errors.';
    throw new AppError(
      `Floor Navigation AI failed (${res.status}): ${raw.slice(0, 200)}. ${hint}`,
      res.status >= 500 ? 502 : res.status
    );
  }

  const json = (await res.json()) as { success?: boolean; data?: EngineFloorAnalysis };
  if (!json.success || !json.data) {
    throw new AppError('Navigation engine returned no floor data', 502);
  }
  return json.data;
}

export async function generateAiDirections(payload: {
  destinationLabel: string;
  buildingName?: string;
  polyline: Array<{ x: number; y: number; label?: string; nodeId?: string; floor?: number; type?: string }>;
  pathNodes?: Array<{ id?: string; label: string; x: number; y: number; type?: string }>;
}): Promise<EngineDirections | null> {
  if (!config.indoorNavigation.enabled) return null;

  try {
    const pathNodes =
      payload.pathNodes ??
      payload.polyline.map((p, i) => ({
        id: p.nodeId || `n${i}`,
        label: p.label || `Point ${i + 1}`,
        x: p.x,
        y: p.y,
        type: p.type || (i === payload.polyline.length - 1 ? 'ROOM' : 'CORRIDOR'),
      }));

    const result = await callNavigationEngine<{ success: boolean; data: EngineDirections }>(
      '/directions/generate',
      {
        destinationLabel: payload.destinationLabel,
        buildingName: payload.buildingName,
        polyline: payload.polyline,
        pathNodes,
      }
    );
    return result.data ?? null;
  } catch (err) {
    console.warn('[floorNavigationEngine] AI directions fallback:', err);
    return null;
  }
}

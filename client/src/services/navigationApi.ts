import api from './api';

export type NavigationIntent = {
  isNavigation: boolean;
  confidence: number;
  intent: string;
  destinationQuery: string | null;
  buildingHint: string | null;
  source: string;
};

export type NavigationRoute = {
  routed?: boolean;
  found?: boolean;
  message?: string;
  destinationLabel?: string;
  roomLabel?: string;
  building?: { id: string; name: string; code: string };
  steps: Array<{ instruction: string; floor: number }>;
  segments: Array<{ buildingId: string; floor: number; polyline: [number, number][] }>;
  polyline?: Array<{ x: number; y: number; floor: number; label?: string }>;
  deepLink?: string | null;
  confidence?: number;
  directionEngine?: string;
  storySupplement?: string[];
  intent?: NavigationIntent;
  classContext?: {
    courseName: string;
    lecturerName: string;
    hallName: string;
    when: string;
    isCurrent: boolean;
  };
};

export async function detectNavigationIntent(message: string): Promise<NavigationIntent> {
  const res = await api.post('/navigation/intent', { message });
  return res.data.data;
}

export async function queryNavigation(message: string, buildingId?: string): Promise<NavigationRoute> {
  const res = await api.post('/navigation/query', { message, buildingId });
  return res.data.data;
}

export async function getNavigationEngineHealth(): Promise<{ healthy: boolean }> {
  const res = await api.get('/navigation/health');
  return res.data.data;
}

/**
 * Navigation Intent Detector - routes chat messages to the Floor Navigation AI Engine.
 * Mirrors Python engine patterns for offline fallback.
 */
import { parseNavigationQuery, parseSourceDestinationQuery } from './mapSearchService';

export type NavigationIntentResult = {
  isNavigation: boolean;
  confidence: number;
  intent: 'guide_to_room' | 'guide_to_next_class' | 'ask_office_location' | 'general';
  destinationQuery: string | null;
  buildingHint: string | null;
  source: 'local' | 'engine';
};

const NAV_PATTERNS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bguide\s+me\s+to\b/i, weight: 0.95 },
  { re: /\btake\s+me\s+to\b/i, weight: 0.94 },
  { re: /\bwhere\s+is\s+(?:the\s+)?/i, weight: 0.92 },
  { re: /\bhow\s+do\s+i\s+(?:go|get|reach|find)\s+(?:to\s+)?/i, weight: 0.9 },
  { re: /\bdirections?\s+to\b/i, weight: 0.93 },
  { re: /\bnavigate\s+to\b/i, weight: 0.94 },
  { re: /\bshow\s+route\s+to\b/i, weight: 0.95 },
  { re: /\bwalk\s+me\s+to\b/i, weight: 0.93 },
  { re: /\bfrom\b.+\bto\b/i, weight: 0.93 },
  { re: /\b(?:want\s+to\s+)?go\s+from\b/i, weight: 0.94 },
  { re: /\bguide\s+me\s+from\b/i, weight: 0.96 },
  { re: /\b(?:cafeteria|meeting\s+room|ELV\s+room|student\s+affairs)\b/i, weight: 0.78 },
];

const NON_NAV_PATTERNS: Array<{ re: RegExp; weight: number }> = [
  { re: /\btimetable\b/i, weight: 0.85 },
  { re: /\bappointment\b/i, weight: 0.88 },
  { re: /\bhall\s+(?:available|availability|free)\b/i, weight: 0.88 },
  { re: /\btoday(?:'s)?\s+classes\b/i, weight: 0.8 },
  { re: /^(?:hi|hello|hey)\b/i, weight: 0.95 },
];

const NEXT_CLASS = /\b(?:next\s+(?:class|lecture)|guide\s+me\s+to\s+my\s+next)\b/i;
const OFFICE = /\b(?:office\s+(?:location|where)|where\s+is\s+(?:dr\.|prof\.))/i;

export function detectNavigationIntentLocal(message: string): NavigationIntentResult {
  const text = message.trim();
  if (!text) {
    return {
      isNavigation: false,
      confidence: 0,
      intent: 'general',
      destinationQuery: null,
      buildingHint: null,
      source: 'local',
    };
  }

  if (NEXT_CLASS.test(text)) {
    return {
      isNavigation: true,
      confidence: 0.88,
      intent: 'guide_to_next_class',
      destinationQuery: null,
      buildingHint: null,
      source: 'local',
    };
  }

  const fromTo = parseSourceDestinationQuery(text);
  if (
    (fromTo.sourceQuery && fromTo.destinationQuery) ||
    fromTo.sourceHint?.buildingCode ||
    fromTo.destinationHint?.buildingCode
  ) {
    return {
      isNavigation: true,
      confidence: 0.9,
      intent: 'guide_to_room',
      destinationQuery: fromTo.destinationQuery || fromTo.destinationHint?.label || null,
      buildingHint: fromTo.buildingHint || fromTo.destinationHint?.buildingCode || null,
      source: 'local',
    };
  }

  if (OFFICE.test(text)) {
    const parsed = parseNavigationQuery(text);
    return {
      isNavigation: true,
      confidence: 0.82,
      intent: 'ask_office_location',
      destinationQuery: parsed.roomTerms[0] || null,
      buildingHint: parsed.buildingHint,
      source: 'local',
    };
  }

  let navConf = 0;
  let nonNavConf = 0;
  for (const { re, weight } of NAV_PATTERNS) {
    if (re.test(text)) navConf = Math.max(navConf, weight);
  }
  for (const { re, weight } of NON_NAV_PATTERNS) {
    if (re.test(text)) nonNavConf = Math.max(nonNavConf, weight);
  }

  const parsed = parseNavigationQuery(text);
  const isNavigation = navConf >= 0.72 && navConf >= nonNavConf;

  return {
    isNavigation,
    confidence: navConf,
    intent: isNavigation ? 'guide_to_room' : 'general',
    destinationQuery: isNavigation ? parsed.roomTerms[0] || text : null,
    buildingHint: parsed.buildingHint,
    source: 'local',
  };
}

export async function detectNavigationIntent(message: string): Promise<NavigationIntentResult> {
  const local = detectNavigationIntentLocal(message);

  // Next-class intent is deterministic - do not let the remote engine override it.
  if (local.intent === 'guide_to_next_class' && local.isNavigation) {
    return local;
  }

  try {
    const { callNavigationEngine } = await import('./floorNavigationEngineService');
    const remote = await callNavigationEngine<{ data: {
      isNavigation: boolean;
      confidence: number;
      intent: string;
      destinationQuery: string | null;
      buildingHint: string | null;
    } }>('/intent/detect', { message });

    const d = remote.data;
    if (d && d.confidence >= local.confidence) {
      return {
        isNavigation: d.isNavigation,
        confidence: d.confidence,
        intent: (d.intent as NavigationIntentResult['intent']) || local.intent,
        destinationQuery: d.destinationQuery ?? local.destinationQuery,
        buildingHint: d.buildingHint ?? local.buildingHint,
        source: 'engine',
      };
    }
  } catch {
    /* engine optional - use local */
  }

  return local;
}

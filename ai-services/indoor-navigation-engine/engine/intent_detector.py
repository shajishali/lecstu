"""
Navigation Intent Detector — classifies user messages as navigation vs general chat.
Uses pattern matching with confidence scoring; no external ML required at runtime.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

NAVIGATION_PATTERNS: list[tuple[re.Pattern[str], float]] = [
    (re.compile(r"\bwhere\s+is\s+(?:the\s+)?", re.I), 0.92),
    (re.compile(r"\bguide\s+me\s+to\b", re.I), 0.95),
    (re.compile(r"\btake\s+me\s+to\b", re.I), 0.94),
    (re.compile(r"\bhow\s+do\s+i\s+(?:go|get|reach|find)\s+(?:to\s+)?", re.I), 0.90),
    (re.compile(r"\bhow\s+to\s+(?:go|get|reach|find)\s+(?:to\s+)?", re.I), 0.88),
    (re.compile(r"\bdirections?\s+to\b", re.I), 0.93),
    (re.compile(r"\bnavigate\s+to\b", re.I), 0.94),
    (re.compile(r"\bwalk\s+me\s+to\b", re.I), 0.93),
    (re.compile(r"\bshow\s+(?:me\s+)?(?:the\s+)?(?:route|way|path)\s+to\b", re.I), 0.94),
    (re.compile(r"\bshow\s+route\s+to\b", re.I), 0.95),
    (re.compile(r"\bfind\s+(?:the\s+)?(?:room|office|hall|lab|cafeteria|meeting)\b", re.I), 0.85),
    (re.compile(r"\bpath\s+to\b", re.I), 0.87),
    (re.compile(r"\bindoor\s+(?:directions|navigation|route)\b", re.I), 0.96),
    (re.compile(r"\bnext\s+class\b", re.I), 0.82),
    (re.compile(r"\bnext\s+lecture\b", re.I), 0.82),
    (re.compile(r"\boffice\s+(?:location|where)\b", re.I), 0.80),
    (re.compile(r"\bwhere\s+(?:can\s+i\s+find|do\s+i\s+find)\b", re.I), 0.86),
    (re.compile(r"\bget\s+me\s+to\b", re.I), 0.90),
    (re.compile(r"\b(?:cafeteria|meeting\s+room|ELV\s+room|student\s+affairs)\b", re.I), 0.75),
]

NON_NAVIGATION_PATTERNS: list[tuple[re.Pattern[str], float]] = [
    (re.compile(r"\btimetable\b", re.I), 0.85),
    (re.compile(r"\bschedule\b", re.I), 0.70),
    (re.compile(r"\bappointment\b", re.I), 0.88),
    (re.compile(r"\bbook\s+(?:an?\s+)?(?:appointment|meeting)\b", re.I), 0.90),
    (re.compile(r"\bhall\s+(?:available|availability|free)\b", re.I), 0.88),
    (re.compile(r"\blecturer\s+(?:available|availability)\b", re.I), 0.85),
    (re.compile(r"\bcancel\s+(?:my\s+)?appointment\b", re.I), 0.92),
    (re.compile(r"\btoday(?:'s)?\s+classes\b", re.I), 0.80),
    (re.compile(r"^(?:hi|hello|hey)\b", re.I), 0.95),
]

DESTINATION_STRIP = [
    re.compile(r"^guide\s+me\s+to\s+", re.I),
    re.compile(r"^take\s+me\s+to\s+", re.I),
    re.compile(r"^how\s+do\s+i\s+(?:go|get|reach|find)\s+(?:to\s+)?", re.I),
    re.compile(r"^how\s+to\s+(?:go|get|reach|find)\s+(?:to\s+)?", re.I),
    re.compile(r"^directions\s+to\s+", re.I),
    re.compile(r"^navigate\s+to\s+", re.I),
    re.compile(r"^walk\s+me\s+to\s+", re.I),
    re.compile(r"^show\s+(?:me\s+)?(?:the\s+)?(?:route|way|path)\s+to\s+", re.I),
    re.compile(r"^show\s+route\s+to\s+", re.I),
    re.compile(r"^where\s+is\s+(?:the\s+)?", re.I),
    re.compile(r"^find\s+(?:the\s+)?", re.I),
    re.compile(r"^get\s+me\s+to\s+", re.I),
    re.compile(r"^path\s+to\s+", re.I),
]


@dataclass
class IntentResult:
    is_navigation: bool
    confidence: float
    intent: str
    destination_query: str | None
    building_hint: str | None
    debug: dict[str, Any]


def extract_destination(text: str) -> tuple[str | None, str | None]:
    """Return (destination_query, building_hint) from natural language."""
    t = text.strip()
    building_hint: str | None = None

    in_building_matches = list(re.finditer(r"\bin\s+(?:the\s+)?(.+?)\s+building\b", t, re.I))
    if in_building_matches:
        building_hint = in_building_matches[-1].group(1).strip()
        building_hint = re.sub(r"\b(?:on\s+)?ground\s+floor\b", " ", building_hint, flags=re.I).strip()
        building_hint = re.sub(r"\bfloor\s+\d+\b", " ", building_hint, flags=re.I).strip()
        building_hint = re.sub(r"\bin\s+the\s+", " ", building_hint, flags=re.I).strip()
        building_hint = re.sub(r"^(?:in\s+)?(?:the\s+)?", "", building_hint, flags=re.I).strip()
        if not building_hint:
            building_hint = None
        t = re.sub(r"\bin\s+(?:the\s+)?.+?\s+building\b", " ", t, flags=re.I).strip()

    for pat in DESTINATION_STRIP:
        t = pat.sub("", t).strip()

    t = re.sub(r"\b(?:on\s+)?ground\s+floor\b", " ", t, flags=re.I).strip()
    t = re.sub(r"\bfloor\s+\d+\b", " ", t, flags=re.I).strip()
    t = re.sub(r"[?.!]+$", "", t).strip()
    t = re.sub(r"\s+", " ", t).strip()

    if len(t) < 2:
        return None, building_hint
    return t, building_hint


def detect_navigation_intent(message: str) -> IntentResult:
    text = (message or "").strip()
    if not text:
        return IntentResult(
            is_navigation=False,
            confidence=0.0,
            intent="general",
            destination_query=None,
            building_hint=None,
            debug={"reason": "empty"},
        )

    nav_confidence = 0.0
    non_nav_confidence = 0.0

    for pat, weight in NAVIGATION_PATTERNS:
        if pat.search(text):
            nav_confidence = max(nav_confidence, weight)

    for pat, weight in NON_NAVIGATION_PATTERNS:
        if pat.search(text):
            non_nav_confidence = max(non_nav_confidence, weight)

    destination_query, building_hint = extract_destination(text)
    is_navigation = nav_confidence >= 0.72 and nav_confidence >= non_nav_confidence

    return IntentResult(
        is_navigation=is_navigation,
        confidence=round(nav_confidence, 3),
        intent="guide_to_room" if is_navigation else "general",
        destination_query=destination_query,
        building_hint=building_hint,
        debug={
            "nav_confidence": nav_confidence,
            "non_nav_confidence": non_nav_confidence,
            "message_length": len(text),
        },
    )

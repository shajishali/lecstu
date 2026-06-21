"""
LECSTU Chatbot Custom Actions — Phase 8.2
Calls platform API for timetable, halls, lecturers, appointments, map.
Uses X-Chatbot-Api-Key + X-Chatbot-User-Id for authenticated API calls.
"""
import os
import re
import logging
from datetime import datetime, timedelta
from typing import Any, Text, Dict, List, Optional
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, FollowupAction

import requests

logger = logging.getLogger(__name__)

PLATFORM_API_URL = os.environ.get("LECSTU_API_URL", "http://localhost:5000/api")
CHATBOT_API_KEY = os.environ.get("CHATBOT_API_KEY", "lecstu-chatbot-dev-key")
API_TIMEOUT_SEC = 8

_LECTURER_LOOKUP_CACHE: Dict[str, Dict[str, Any]] = {}

DAY_ALIASES = {
    "today": None,  # resolved at runtime
    "tomorrow": None,
    "monday": "MONDAY",
    "tuesday": "TUESDAY",
    "wednesday": "WEDNESDAY",
    "thursday": "THURSDAY",
    "friday": "FRIDAY",
    "saturday": "SATURDAY",
    "sunday": "SUNDAY",
    "mon": "MONDAY",
    "tue": "TUESDAY",
    "wed": "WEDNESDAY",
    "thu": "THURSDAY",
    "fri": "FRIDAY",
    "sat": "SATURDAY",
    "sun": "SUNDAY",
}

_VALID_WEEKDAYS = frozenset(
    {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}
)

TIME_PATTERNS = [
    (r"(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?", lambda m: _parse_hm(m)),
    (r"(\d{1,2})\s*(am|pm)", lambda m: _parse_h_ampm(m)),
    (r"(\d{1,2})\s*(\d{2})\s*(am|pm)?", lambda m: _parse_hm(m)),
]


def _parse_hm(m) -> Optional[str]:
    try:
        h, m = int(m.group(1)), int(m.group(2)) if m.lastindex >= 2 else 0
        if m.lastindex >= 3 and m.group(3) == "pm" and h < 12:
            h += 12
        elif m.lastindex >= 3 and m.group(3) == "am" and h == 12:
            h = 0
        return f"{h:02d}:{m:02d}"
    except (IndexError, ValueError):
        return None


def _parse_h_ampm(m) -> Optional[str]:
    try:
        h = int(m.group(1))
        ampm = m.group(2).lower() if m.lastindex >= 2 else ""
        if ampm == "pm" and h < 12:
            h += 12
        elif ampm == "am" and h == 12:
            h = 0
        return f"{h:02d}:00"
    except (IndexError, ValueError):
        return None


def _normalize_day_input(day_raw: str) -> str:
    """Collapse typos/plurals like tomorrows, tomorrow's, todays."""
    d = day_raw.strip().lower().replace("'", "").replace("\u2019", "")
    if d.startswith("tomorrow"):
        return "tomorrow"
    if d.startswith("today"):
        return "today"
    return d


def _resolve_day(day_raw: Optional[str]) -> Optional[str]:
    if not day_raw:
        return None
    d = _normalize_day_input(day_raw)
    if d in ("today", "now"):
        return datetime.now().strftime("%A").upper()
    if d == "tomorrow":
        return (datetime.now() + timedelta(days=1)).strftime("%A").upper()
    alias = DAY_ALIASES.get(d)
    if alias:
        return alias
    if d.endswith("s"):
        alias = DAY_ALIASES.get(d[:-1])
        if alias:
            return alias
    upper = d.upper()
    if upper in _VALID_WEEKDAYS:
        return upper
    return None


def _day_from_message_text(text: str) -> Optional[str]:
    """Extract weekday from free text (handles 'the friday', 'tomorrows', etc.)."""
    t = (text or "").lower()
    if re.search(r"\btomorrow", t):
        return (datetime.now() + timedelta(days=1)).strftime("%A").upper()
    if re.search(r"\btoday", t):
        return datetime.now().strftime("%A").upper()
    for token, alias in DAY_ALIASES.items():
        if not alias or len(token) < 3:
            continue
        if re.search(rf"\b(?:the\s+)?{re.escape(token)}\b", t):
            return alias
    return None


def _requested_timetable_day(tracker: Tracker) -> Optional[str]:
    """Resolve weekday from NLU day slot or message text (handles tomorrows, etc.)."""
    day_slot = tracker.get_slot("day")
    if day_slot:
        resolved = _resolve_day(day_slot)
        if resolved:
            return resolved
    return _day_from_message_text(((tracker.latest_message or {}).get("text") or ""))


TIMETABLE_QUERY_RE = re.compile(
    r"\b(?:time\s*table|timetable|schedule|my\s+classes|lectures?\s+on)\b",
    re.I,
)
_WEEKDAY_NAMES = "monday|tuesday|wednesday|thursday|friday|saturday|sunday"


def _looks_like_timetable_query(text: str) -> bool:
    if not text or not text.strip():
        return False
    if TIMETABLE_QUERY_RE.search(text):
        return True
    t = text.lower()
    if re.search(rf"\bof\s+(?:the\s+)?(?:{_WEEKDAY_NAMES}|tomorrow|today)\b", t):
        return True
    if re.search(r"\btable\b", t) and _day_from_message_text(text):
        return True
    return "class" in t and bool(_day_from_message_text(text))


def _looks_messy_timetable_phrase(text: str) -> bool:
    """True when grammar is likely wrong — ask the student to confirm before answering."""
    t = text.lower()
    if re.search(rf"\bthe\s+(?:{_WEEKDAY_NAMES})\b", t):
        return True
    if re.search(rf"\bof\s+the\s+(?:{_WEEKDAY_NAMES})\b", t):
        return True
    if re.search(r"\btime\s+table\b", t):
        return True
    return False


def _is_affirmation(text: str) -> bool:
    t = text.strip().lower()
    if not t:
        return False
    if t in (
        "yes", "yeah", "yep", "yup", "correct", "right", "confirm", "confirmed",
        "ok", "okay", "sure", "exactly", "that's right", "thats right", "please", "y",
    ):
        return True
    return t.startswith("yes ") or t.startswith("yeah ")


def _is_denial(text: str) -> bool:
    t = text.strip().lower()
    if t in ("no", "nope", "nah", "wrong", "cancel", "not that", "incorrect"):
        return True
    return t.startswith("no ") or t.startswith("nope ")


def _maybe_prompt_timetable_confirm(
    dispatcher: CollectingDispatcher,
    day: str,
) -> List[Dict[Text, Any]]:
    dispatcher.utter_message(
        text=(
            f"Did you mean your timetable for **{day.title()}**? "
            "Reply **yes** to confirm or **no** to try again."
        )
    )
    return [
        SlotSet("pending_timetable_day", day),
        SlotSet("awaiting_timetable_confirm", True),
    ]


def _handle_awaiting_timetable_confirm(
    tracker: Tracker,
    dispatcher: CollectingDispatcher,
    text: str,
) -> Optional[List[Dict[Text, Any]]]:
    if not tracker.get_slot("awaiting_timetable_confirm"):
        return None

    pending = tracker.get_slot("pending_timetable_day")
    clear_events = [
        SlotSet("awaiting_timetable_confirm", False),
        SlotSet("pending_timetable_day", None),
    ]

    if _is_affirmation(text):
        day = pending or _day_from_message_text(text)
        return clear_events + [SlotSet("day", day or ""), FollowupAction("action_query_timetable")]

    if _is_denial(text):
        dispatcher.utter_message(
            text="No problem. Which day would you like? For example: Monday, tomorrow, or today."
        )
        return clear_events

    if _looks_like_timetable_query(text):
        # Student asked a new timetable question instead of yes/no — re-interpret below.
        return clear_events

    dispatcher.utter_message(text="Please reply **yes** or **no**.")
    return []


def _resolve_time(time_raw: Optional[str]) -> Optional[str]:
    if not time_raw:
        return None
    t = time_raw.strip().lower().replace(".", "")
    if t in ("noon", "12 noon"):
        return "12:00"
    if t in ("midnight", "12 midnight"):
        return "00:00"
    for pat, fn in TIME_PATTERNS:
        m = re.search(pat, t, re.I)
        if m:
            return fn(m)
    if re.match(r"^\d{1,2}:\d{2}$", t):
        return t
    return None


def _api_headers(user_id: str) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Chatbot-Api-Key": CHATBOT_API_KEY,
        "X-Chatbot-User-Id": user_id,
    }


def _translate_to_english(text: str, user_id: str) -> str:
    """Translate Tamil/Sinhala text to English via platform API. Returns original if translation fails."""
    if not text or not text.strip():
        return text
    # Only translate if text contains non-ASCII (Tamil/Sinhala)
    if all(ord(c) < 128 for c in text):
        return text
    # Detect source: Tamil \u0B80-\u0BFF, Sinhala \u0D80-\u0DFF
    src = "si" if any(0x0D80 <= ord(c) <= 0x0DFF for c in text) else "ta"
    try:
        r = requests.post(
            f"{PLATFORM_API_URL}/ai/translation/translate",
            json={"text": text, "src": src, "tgt": "en", "engine": "google"},
            headers=_api_headers(user_id),
            timeout=15,
        )
        if r.ok:
            data = r.json()
            translated = (data.get("data") or {}).get("translated_text", "").strip()
            if translated:
                return translated
    except Exception as e:
        logger.warning("Translation failed for lecturer name: %s", e)
    return text


def _get_user_id(tracker: Tracker) -> Optional[str]:
    """Extract user_id from metadata or sender (ChatWidget sends user.id as sender)."""
    # Try latest_message metadata first (Rasa 3.x)
    latest = tracker.latest_message or {}
    meta = latest.get("metadata") or {}
    uid = meta.get("user_id")
    if uid:
        return str(uid)
    # Fallback: scan events for user message with metadata
    events = tracker.current_state().get("events", [])
    for e in reversed(events):
        if e.get("event") == "user":
            meta = e.get("metadata") or e.get("input_metadata") or {}
            uid = meta.get("user_id")
            if uid:
                return str(uid)
    # Fallback: use sender_id (ChatWidget sends sender: user.id when logged in)
    sender = tracker.sender_id
    if sender and not str(sender).startswith("guest_"):
        return str(sender)
    return None


def _find_lecturer_by_name(lecturers: List[Dict], name: str) -> Optional[Dict]:
    """Fuzzy match lecturer by first/last name. Strips titles (Dr., Prof., madam, sir)."""
    if not name or not lecturers:
        return None
    name_lower = (
        name.lower()
        .replace("dr.", "")
        .replace("dr", "")
        .replace("prof.", "")
        .replace("prof", "")
        .replace("madam", "")
        .replace("sir", "")
        .strip()
    )
    parts = [p for p in name_lower.split() if len(p) > 1]
    if not parts:
        return None
    # Prefer matches where ALL parts appear (avoids wrong lecturer from stale slot)
    for lec in lecturers:
        fn = (lec.get("firstName") or "").lower()
        ln = (lec.get("lastName") or "").lower()
        full = f"{fn} {ln}"
        if all(p in full for p in parts):
            return lec
    # Fallback: any part match (for "tharaga madam" etc.)
    for lec in lecturers:
        fn = (lec.get("firstName") or "").lower()
        ln = (lec.get("lastName") or "").lower()
        full = f"{fn} {ln}"
        if any(p in full for p in parts) or name_lower in full:
            return lec
    return None


def _resolve_day_from_tracker(tracker: Tracker, day_slot: Optional[str]) -> Optional[str]:
    if day_slot:
        normalized = _normalize_day_input(day_slot)
        if normalized in ("today", "tomorrow"):
            return normalized
        resolved = _resolve_day(day_slot)
        if resolved:
            return resolved
    text = ((tracker.latest_message or {}).get("text") or "").lower()
    if re.search(r"\btoday", text):
        return "today"
    if re.search(r"\btomorrow", text):
        return "tomorrow"
    return None


def _lookup_lecturer(user_id: str, name: str) -> Optional[Dict]:
    """Find lecturer via search API (faster than loading the full directory)."""
    if not name:
        return None
    cache_key = f"{user_id}:{name.strip().lower()}"
    if cache_key in _LECTURER_LOOKUP_CACHE:
        return _LECTURER_LOOKUP_CACHE[cache_key]

    cleaned = (
        name.lower()
        .replace("dr.", "")
        .replace("dr", "")
        .replace("prof.", "")
        .replace("prof", "")
        .replace("madam", "")
        .replace("sir", "")
        .strip()
    )
    search_terms = [name.strip()]
    if cleaned and cleaned not in {t.lower() for t in search_terms}:
        search_terms.append(cleaned)
    tokens = [t for t in cleaned.split() if len(t) > 2]
    if tokens:
        search_terms.append(tokens[0])

    seen_queries: set[str] = set()
    for query in search_terms:
        key = query.lower()
        if not key or key in seen_queries:
            continue
        seen_queries.add(key)
        try:
            r = requests.get(
                f"{PLATFORM_API_URL}/lecturers",
                params={"search": query},
                headers=_api_headers(user_id),
                timeout=API_TIMEOUT_SEC,
            )
            r.raise_for_status()
            data = r.json()
            lecturers = data.get("data", []) if data.get("success") else []
            lec = _find_lecturer_by_name(lecturers, name)
            if lec:
                _LECTURER_LOOKUP_CACHE[cache_key] = lec
                return lec
        except requests.RequestException:
            logger.exception("Lecturer lookup failed for %s", query)

    return None


def _get_lecturer_name_from_tracker(tracker: Tracker) -> Optional[str]:
    """Prefer lecturer_name from the CURRENT user message to avoid stale slot from previous turn."""
    latest = tracker.latest_message or {}
    text = (latest.get("text") or "").strip()
    entities = latest.get("entities") or []
    for e in entities:
        if e.get("entity") == "lecturer_name":
            val = e.get("value")
            if val:
                v = str(val).strip()
                # Ignore title-only extractions (e.g. "sir", "madam") — try regex fallback instead
                if v.lower() in ("sir", "madam", "dr", "prof"):
                    break
                return v
    # Fallback: extract from raw text (e.g. "prof. Dhammika weerasinghe is available")
    # Also handle "X sir"/"X madam" — supports English and Tamil/Sinhala (e.g. "கேசவன் sir", "Kesavan sir")
    # Tamil: \u0B80-\u0BFF, Sinhala: \u0D80-\u0DFF
    _name = r"([A-Za-z\u0B80-\u0BFF\u0D80-\u0DFF][A-Za-z\s\.\-\u0B80-\u0BFF\u0D80-\u0DFF]*?)\s+(?:sir|madam)"
    if text:
        for pattern in [
            r"(?:today|tomorrow)\s+(?:dr\.?|prof\.?)\s+([A-Za-z][A-Za-z\s\.\-]+?)\s+(?:is\s+)?(?:available|free|\?|or)",
            r"(?:today|tomorrow)\s+(?:is\s+)?" + _name + r"\s+(?:is\s+)?(?:available|free|or)",
            _name + r"\s+(?:is\s+)?(?:available|free|or)",
            _name + r"\s+(?:is\s+)?(?:available|free)",
            _name,  # Last resort: any "X sir" or "X madam" in text
            r"(?:prof\.?|dr\.?)\s+([A-Za-z][A-Za-z\s\.\-]+?)\s+(?:is\s+)?(?:available|free)",
            r"(?:today|tomorrow)\s+(?:is\s+)?(?:prof\.?|dr\.?)\s+([A-Za-z][A-Za-z\s\.\-]+?)\s+(?:available|free|\?|or)",
            r"(?:prof\.?|dr\.?)\s+([A-Za-z][A-Za-z\s\.\-]+?)\s+or\s+not",
        ]:
            m = re.search(pattern, text, re.I)
            if m:
                return m.group(1).strip()
    slot_val = tracker.get_slot("lecturer_name")
    # Don't use slot if it's just a title (sir, madam) — would cause "could not find sir"
    if slot_val and str(slot_val).strip().lower() not in ("sir", "madam"):
        return str(slot_val).strip()
    return None


def _timetable_lines_from_grid(grid: Dict[str, Any], requested_day: Optional[str]) -> List[str]:
    """Build schedule lines from the FET grid snapshot (same source as My Timetable page)."""
    day_columns = grid.get("dayColumns") or []
    time_rows = grid.get("timeRows") or []
    cells = grid.get("cells") or []
    if not day_columns or not time_rows or not cells:
        return []

    default_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    lines: List[str] = []
    for di, col in enumerate(day_columns):
        day = (col.get("day") or "").upper()
        if requested_day and day != requested_day:
            continue
        if not requested_day and day not in default_days:
            continue
        day_label = (col.get("label") or day.title()).strip()
        for ti, tr in enumerate(time_rows):
            if ti >= len(cells):
                break
            row = cells[ti] or []
            if di >= len(row):
                continue
            cell = row[di] or {}
            if cell.get("isEmpty") or cell.get("mergeContinue") or cell.get("isBreak"):
                continue
            row_span = max(1, int(cell.get("rowSpan") or 1))
            end_ti = min(ti + row_span - 1, len(time_rows) - 1)
            end_tr = time_rows[end_ti] or {}
            start = (cell.get("slotStart") or tr.get("start") or "").strip()
            end = (cell.get("slotEnd") or end_tr.get("end") or tr.get("end") or "").strip()
            if not start or not end:
                continue
            display = cell.get("displayLines") or cell.get("lines") or []
            parts = [
                str(p).strip()
                for p in display
                if p and str(p).strip() and str(p).strip() not in ("—", "-")
            ]
            if not parts:
                raw = (cell.get("rawText") or "").strip()
                if raw:
                    parts = [ln.strip() for ln in raw.splitlines() if ln.strip()]
            summary = " · ".join(parts) if parts else "Class"
            lines.append(f"• {day_label} {start}-{end}: {summary}")
    return lines


def _timetable_lines_from_weekly(weekly: Dict[str, Any], requested_day: Optional[str]) -> List[str]:
    """Fallback: format master timetable slots when no FET grid is stored."""
    default_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    days_to_show = [requested_day] if requested_day else default_days
    lines: List[str] = []
    for day in days_to_show:
        slots = weekly.get(day, [])
        if not slots:
            continue
        day_label = day.capitalize()
        for s in slots:
            course = s.get("course", {})
            hall = s.get("hall", {})
            lec = s.get("lecturer", {})
            lec_name = f"{lec.get('firstName', '')} {lec.get('lastName', '')}".strip()
            lines.append(
                f"• {day_label} {s.get('startTime', '')}-{s.get('endTime', '')}: "
                f"{course.get('name', '')} at {hall.get('name', '')} ({lec_name})"
            )
    return lines


class ActionRecoverOrFallback(Action):
    """Recover timetable asks from fallback/out-of-scope; confirm when phrasing is unclear."""

    def name(self) -> Text:
        return "action_recover_or_fallback"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        text = ((tracker.latest_message or {}).get("text") or "").strip()
        confirm_handled = _handle_awaiting_timetable_confirm(tracker, dispatcher, text)
        if confirm_handled is not None:
            return confirm_handled

        if _looks_like_timetable_query(text):
            day = _day_from_message_text(text)
            if day:
                return _maybe_prompt_timetable_confirm(dispatcher, day)
            dispatcher.utter_message(
                text="Which day's timetable would you like? For example: Monday, tomorrow, or today."
            )
            return []

        intent = ((tracker.latest_message or {}).get("intent") or {}).get("name")
        if intent == "fallback":
            dispatcher.utter_message(
                text="I'm not sure I understood. Could you rephrase that? I can help with timetables, hall availability, appointments, and campus directions."
            )
        else:
            dispatcher.utter_message(
                text="I'm focused on academic help—timetables, halls, appointments, and campus info. Is there something in that area I can help with?"
            )
        return []


class ActionQueryTimetable(Action):
    """Call GET /api/timetable/my and format response. Filters by day when user asks for today/tomorrow/specific day."""

    def name(self) -> Text:
        return "action_query_timetable"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to the platform to view your timetable."
            )
            return []

        text = ((tracker.latest_message or {}).get("text") or "").strip()
        confirm_handled = _handle_awaiting_timetable_confirm(tracker, dispatcher, text)
        if confirm_handled is not None:
            return confirm_handled

        requested_day = _requested_timetable_day(tracker)
        intent = ((tracker.latest_message or {}).get("intent") or {}).get("name")

        if intent == "ask_timetable" and requested_day and _looks_messy_timetable_phrase(text):
            return _maybe_prompt_timetable_confirm(dispatcher, requested_day)

        if intent == "ask_timetable" and not requested_day and _looks_like_timetable_query(text):
            dispatcher.utter_message(
                text="Which day's timetable would you like? Try Monday, tomorrow, or today."
            )
            return []

        try:
            r = requests.get(
                f"{PLATFORM_API_URL}/timetable/my",
                headers=_api_headers(user_id),
                params={"_": int(datetime.now().timestamp())},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            if not data.get("success") or not data.get("data"):
                dispatcher.utter_message(text="I couldn't fetch your timetable. Please try the My Timetable page.")
                return []

            tt = data["data"]
            grid = tt.get("grid")
            weekly = tt.get("weekly", {})
            flat = tt.get("flat", [])

            lines = _timetable_lines_from_grid(grid, requested_day) if grid else []
            if not lines:
                lines = _timetable_lines_from_weekly(weekly, requested_day)

            if not lines and not flat and not (grid and grid.get("cells")):
                dispatcher.utter_message(text="You have no classes scheduled in your timetable.")
                return []

            if not lines:
                qual = f" for {requested_day.title()}" if requested_day else ""
                dispatcher.utter_message(text=f"You have no classes{qual}.")
                return []

            if requested_day:
                msg = f"Here's your timetable for {requested_day.title()}:\n\n" + "\n".join(lines)
            else:
                msg = "Here's your timetable:\n\n" + "\n".join(lines[:15])
                if len(lines) > 15:
                    msg += "\n\n... and more. Visit My Timetable for the full schedule."
            dispatcher.utter_message(text=msg)
        except requests.RequestException as e:
            logger.exception("Timetable API error")
            dispatcher.utter_message(
                text="I couldn't reach the timetable service. Please try the My Timetable page."
            )
        return []


class ActionCheckHallAvailability(Action):
    """Call GET /api/halls/available or /available-now."""

    def name(self) -> Text:
        return "action_check_hall_availability"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to check hall availability."
            )
            return []

        hall = tracker.get_slot("hall_name")
        time_slot = tracker.get_slot("time")
        day_slot = tracker.get_slot("day")

        day = _resolve_day(day_slot)
        start_time = _resolve_time(time_slot) if time_slot else None

        try:
            if not day and not hall and not time_slot:
                r = requests.get(
                    f"{PLATFORM_API_URL}/halls/available-now",
                    headers=_api_headers(user_id),
                    timeout=10,
                )
                r.raise_for_status()
                data = r.json()
                if not data.get("success"):
                    dispatcher.utter_message(text="Could not check hall availability.")
                    return []
                halls = data.get("data", [])
                if not halls:
                    dispatcher.utter_message(text="No halls are currently available.")
                else:
                    names = [h.get("hall", {}).get("name", "?") for h in halls[:10]]
                    msg = "Halls available right now: " + ", ".join(names)
                    if len(halls) > 10:
                        msg += f" (and {len(halls) - 10} more)."
                    dispatcher.utter_message(text=msg)
                return []

            day = day or datetime.now().strftime("%A").upper()
            params = {"day": day}
            if start_time:
                params["startTime"] = start_time
                end_h, end_m = map(int, start_time.split(":"))
                end_m += 60
                if end_m >= 60:
                    end_h += 1
                    end_m -= 60
                params["endTime"] = f"{end_h:02d}:{end_m:02d}"

            r = requests.get(
                f"{PLATFORM_API_URL}/halls/available",
                params=params,
                headers=_api_headers(user_id),
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                dispatcher.utter_message(text="Could not check hall availability.")
                return []

            results = data.get("data", [])
            if hall:
                hall_lower = hall.lower()
                results = [h for h in results if hall_lower in (h.get("hall", {}).get("name", "") or "").lower()]

            if not results:
                qual = f" matching '{hall}'" if hall else ""
                dispatcher.utter_message(
                    text=f"No halls are available{qual} for {day}"
                    + (f" at {start_time}" if start_time else "") + "."
                )
            else:
                names = [h.get("hall", {}).get("name", "?") for h in results[:8]]
                msg = f"Halls available for {day}"
                if start_time:
                    msg += f" at {start_time}"
                msg += ": " + ", ".join(names)
                if len(results) > 8:
                    msg += f" (and {len(results) - 8} more)."
                dispatcher.utter_message(text=msg)
        except requests.RequestException:
            logger.exception("Hall availability API error")
            dispatcher.utter_message(
                text="I couldn't reach the hall service. Please try the Hall Availability page."
            )
        return []


class ActionCheckLecturerAvailability(Action):
    """Call GET /api/lecturers and /api/lecturers/:id/availability."""

    def name(self) -> Text:
        return "action_check_lecturer_availability"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to check lecturer availability."
            )
            return []

        lecturer_name = _get_lecturer_name_from_tracker(tracker)
        day_slot = _resolve_day_from_tracker(tracker, tracker.get_slot("day"))

        if not lecturer_name:
            dispatcher.utter_message(
                text="Which lecturer's availability would you like to check? For example: 'Is Prof. Dhammika Weerasinghe free today?'"
            )
            return []

        # Translate Tamil/Sinhala names to English (lecturer DB uses English)
        if user_id and any(ord(c) >= 128 for c in lecturer_name):
            lecturer_name = _translate_to_english(lecturer_name, user_id)

        try:
            lec = _lookup_lecturer(user_id, lecturer_name)
            if not lec:
                dispatcher.utter_message(
                    text=f"I couldn't find a lecturer named '{lecturer_name}'. Check the Lecturers page for the correct name."
                )
                return []

            lec_id = lec.get("id")
            lec_full = f"{lec.get('firstName', '')} {lec.get('lastName', '')}".strip()

            day = _resolve_day(day_slot)
            if day:
                target = datetime.now()
                days_list = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
                if day_slot and "tomorrow" in (day_slot or "").lower():
                    target += timedelta(days=1)
                else:
                    try:
                        idx = days_list.index(day)
                        today_idx = target.weekday()
                        diff = (idx - today_idx) % 7
                        if diff == 0 and day_slot and "today" not in (day_slot or "").lower():
                            diff = 7
                        target += timedelta(days=diff)
                    except ValueError:
                        pass
                date_str = target.strftime("%Y-%m-%d")
                r2 = requests.get(
                    f"{PLATFORM_API_URL}/lecturers/{lec_id}/availability",
                    params={"date": date_str},
                    headers=_api_headers(user_id),
                    timeout=API_TIMEOUT_SEC,
                )
            else:
                r2 = requests.get(
                    f"{PLATFORM_API_URL}/lecturers/{lec_id}/availability",
                    headers=_api_headers(user_id),
                    timeout=API_TIMEOUT_SEC,
                )

            r2.raise_for_status()
            av = r2.json()
            if not av.get("success"):
                dispatcher.utter_message(text="Could not fetch lecturer availability.")
                return []

            av_data = av.get("data")
            free = []
            day_label = None
            if isinstance(av_data, dict) and "freeSlots" in av_data:
                free = av_data.get("freeSlots", [])
                day_label = av_data.get("day")  # e.g. "TUESDAY" for date-specific
            elif isinstance(av_data, list):
                for item in av_data:
                    if isinstance(item, dict) and "freeSlots" in item:
                        day_name = item.get("day", "")
                        for slot in item.get("freeSlots", []):
                            free.append({**slot, "_day": day_name})
            if free:
                def _short_day(d):
                    if not d:
                        return ""
                    return d[:3].capitalize() if len(d) >= 3 else d  # MONDAY -> Mon

                def _slot_text(s):
                    st = s.get("startTime") or s.get("start", "")
                    et = s.get("endTime") or s.get("end", "")
                    if st and et:
                        day = _short_day(s.get("_day", ""))
                        return f"{day} {st}-{et}".strip() if day else f"{st}-{et}"
                    return ""
                parts = [_slot_text(s) for s in free[:8] if _slot_text(s)]
                slots_str = ", ".join(parts) if parts else "various times"
                day_qual = f" on {_short_day(day_label) or day_label}" if day_label else ""
                dispatcher.utter_message(
                    text=f"{lec_full} has free slots{day_qual}: {slots_str}. Visit Book Appointment to schedule."
                )
            else:
                qual = f" on {day or 'this week'}" if day else ""
                dispatcher.utter_message(
                    text=f"{lec_full} doesn't have free slots{qual}. Try another day or check the Lecturers page."
                )
        except requests.RequestException:
            logger.exception("Lecturer availability API error")
            dispatcher.utter_message(
                text="I couldn't reach the lecturer service. Please try the Lecturers or Book Appointment page."
            )
        return []


class ActionBookAppointment(Action):
    """Call POST /api/appointments to create a booking."""

    def name(self) -> Text:
        return "action_book_appointment"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to book an appointment."
            )
            return []

        lecturer_name = _get_lecturer_name_from_tracker(tracker)
        day_slot = tracker.get_slot("day")
        time_slot = tracker.get_slot("time")

        if not lecturer_name:
            dispatcher.utter_message(
                text="Which lecturer would you like to book? For example: 'Book with Prof. Dhammika Weerasinghe on Monday at 2pm'"
            )
            return []

        if user_id and any(ord(c) >= 128 for c in lecturer_name):
            lecturer_name = _translate_to_english(lecturer_name, user_id)

        try:
            lec = _lookup_lecturer(user_id, lecturer_name)
            if not lec:
                dispatcher.utter_message(
                    text=f"I couldn't find lecturer '{lecturer_name}'. Go to Book Appointment to select from the list."
                )
                return []

            day = _resolve_day(day_slot)
            start_time = _resolve_time(time_slot)

            if not day or not start_time:
                dispatcher.utter_message(
                    text=f"To book with {lec.get('firstName', '')} {lec.get('lastName', '')}, please specify a day and time. "
                    "For example: 'Book with Dr. Dias on Monday at 2pm'. Or use the Book Appointment page for the full form."
                )
                return []

            days_list = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
            target = datetime.now()
            try:
                idx = days_list.index(day)
                today_idx = target.weekday()
                diff = (idx - today_idx) % 7
                if diff == 0 and day_slot and "today" not in (day_slot or "").lower():
                    diff = 7
                target += timedelta(days=diff)
            except ValueError:
                pass

            h, m = map(int, start_time.split(":"))
            target = target.replace(hour=h, minute=m, second=0, microsecond=0)
            date_time = target.isoformat()

            r2 = requests.post(
                f"{PLATFORM_API_URL}/appointments",
                headers=_api_headers(user_id),
                json={
                    "lecturerId": lec.get("id"),
                    "dateTime": date_time,
                    "duration": 30,
                    "reason": "Booked via LECSTU Assistant",
                },
                timeout=10,
            )

            if r2.status_code == 201:
                appt = r2.json().get("data", {})
                lec_name = f"{lec.get('firstName', '')} {lec.get('lastName', '')}".strip()
                dispatcher.utter_message(
                    text=f"Appointment requested with {lec_name} on {target.strftime('%A, %B %d')} at {start_time}. "
                    "The lecturer will confirm. Check your Notifications."
                )
            else:
                err = r2.json().get("message", "Booking failed")
                dispatcher.utter_message(
                    text=f"Could not book: {err}. Please try the Book Appointment page."
                )
        except requests.RequestException:
            logger.exception("Book appointment API error")
            dispatcher.utter_message(
                text="I couldn't complete the booking. Please use the Book Appointment page."
            )
        return []


class ActionCancelAppointment(Action):
    """Find user's appointment with lecturer and call DELETE /api/appointments/:id."""

    def name(self) -> Text:
        return "action_cancel_appointment"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to cancel an appointment."
            )
            return []

        lecturer_name = _get_lecturer_name_from_tracker(tracker)
        if lecturer_name and user_id and any(ord(c) >= 128 for c in lecturer_name):
            lecturer_name = _translate_to_english(lecturer_name, user_id)

        try:
            r = requests.get(
                f"{PLATFORM_API_URL}/appointments",
                params={"status": "PENDING,ACCEPTED,SCHEDULED"},
                headers=_api_headers(user_id),
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            appointments = data.get("data", []) if data.get("success") else []

            if lecturer_name:
                lec = _lookup_lecturer(user_id, lecturer_name)
                if lec:
                    lec_id = lec.get("id")
                    appointments = [a for a in appointments if a.get("lecturer", {}).get("id") == lec_id]

            cancellable = [a for a in appointments if a.get("studentId") == user_id or a.get("student", {}).get("id") == user_id]
            if not cancellable:
                if lecturer_name:
                    dispatcher.utter_message(
                        text=f"You don't have an appointment with {lecturer_name} to cancel."
                    )
                else:
                    dispatcher.utter_message(
                        text="You don't have any appointments to cancel. Check the Appointments page."
                    )
                return []

            appt = cancellable[0]
            appt_id = appt.get("id")
            lec_info = appt.get("lecturer", {})
            lec_full = f"{lec_info.get('firstName', '')} {lec_info.get('lastName', '')}".strip()

            r2 = requests.delete(
                f"{PLATFORM_API_URL}/appointments/{appt_id}",
                headers=_api_headers(user_id),
                timeout=10,
            )

            if r2.status_code in (200, 204) or (r2.status_code < 400):
                dispatcher.utter_message(
                    text=f"Appointment with {lec_full} has been cancelled."
                )
            else:
                err = r2.json().get("message", "Cancellation failed")
                dispatcher.utter_message(text=f"Could not cancel: {err}. Try the Appointments page.")
        except requests.RequestException:
            logger.exception("Cancel appointment API error")
            dispatcher.utter_message(
                text="I couldn't cancel the appointment. Please use the Appointments page."
            )
        return []


def _format_ampm(time_str: str) -> str:
    try:
        h, m = time_str.split(":")
        hr = int(h)
        suffix = "PM" if hr >= 12 else "AM"
        display = hr - 12 if hr > 12 else (12 if hr == 0 else hr)
        return f"{display}:{m} {suffix}"
    except (ValueError, AttributeError):
        return time_str


def _guide_search_queries(tracker: Tracker) -> List[str]:
    """Build search terms from the current user message first (ignore stale slots)."""
    latest = (tracker.latest_message.get("text") or "").strip()
    hall = (tracker.get_slot("hall_name") or "").strip()
    building = (tracker.get_slot("building") or "").strip()
    queries: List[str] = []

    text = latest
    for prefix in (
        r"^guide\s+me\s+to\s+",
        r"^how\s+do\s+i\s+(?:go|get|reach|find)\s+to\s+",
        r"^how\s+to\s+(?:go|get|reach|find)\s+to\s+",
        r"^take\s+me\s+to\s+",
        r"^directions\s+to\s+",
        r"^navigate\s+to\s+",
        r"^walk\s+me\s+to\s+",
        r"^where\s+is\s+(?:the\s+)?",
        r"^find\s+(?:the\s+)?",
        r"^i\s+want\s+to\s+go\s+to\s+",
        r"^can\s+you\s+guide\s+(?:me\s+)?(?:to\s+)?(?:go\s+for\s+the\s+)?",
        r"^please\s+guide\s+(?:me\s+)?to\s+",
    ):
        text = re.sub(prefix, "", text, flags=re.I).strip()

    text = re.sub(
        r"\s+in\s+(?:the\s+)?.+?\s+building\s*",
        " ",
        text,
        flags=re.I,
    ).strip()
    text = re.sub(
        r"\s+(?:administration|academic|laboratory|admin|acad|lab)\s+building\s*",
        " ",
        text,
        flags=re.I,
    ).strip()
    text = re.sub(r"\b(?:on\s+)?ground\s+floor\b", "", text, flags=re.I).strip()

    elv = re.search(r"\b(ELV\s*ROOM)\b", latest, re.I)
    if elv and not re.search(r"\belectrical\b", latest, re.I):
        queries.append(re.sub(r"\s+", " ", elv.group(1)).strip())

    electrical = re.search(r"\b(ELECTRICAL\s+ROOM)\b", latest, re.I)
    if electrical:
        queries.insert(0, re.sub(r"\s+", " ", electrical.group(1)).strip())
    elif re.search(r"\belectrical\s+room\b", latest, re.I):
        queries.insert(0, "electrical room")

    if len(text) >= 2:
        queries.insert(0, text)

    # Only use Rasa slot if it appears in the current message (avoid stale cafeteria → wrong room)
    if hall and hall.lower() in latest.lower():
        if building:
            queries.append(f"{hall} {building}")
        elif hall.lower() not in {q.lower() for q in queries}:
            queries.append(hall)

    if not queries and len(latest) >= 2:
        queries.append(latest)

    seen: set = set()
    out: List[str] = []
    for q in queries:
        key = q.lower()
        if key and key not in seen:
            seen.add(key)
            out.append(q)
    return out


def _pick_map_room_result(results: List[Dict[str, Any]], query: str = "") -> Optional[Dict[str, Any]]:
    """Pick best marker/hall match; avoid first arbitrary DB row."""
    room_like = [r for r in results if r.get("kind") in ("marker", "hall", "office")]
    if not room_like:
        return results[0] if results else None

    if not query:
        return room_like[0]

    q = query.lower().strip()
    generic_tokens = {"room", "hall", "floor", "building", "ground"}
    token_conflicts = [
        ("electrical", "elv"),
        ("elv", "electrical"),
        ("cafeteria", "elv"),
        ("meeting", "elv"),
    ]
    best: Optional[Dict[str, Any]] = None
    best_score = 0

    for r in room_like:
        label = (r.get("label") or "").lower()
        label = re.sub(r"^\d{1,2}\s*[\.\):\-]\s*", "", label).strip()
        score = 0

        for need, forbid in token_conflicts:
            if need in q and forbid in label and need not in label:
                score = 0
                break
        else:
            if label == q:
                score = 100
            elif q in label:
                score = 92
            else:
                tokens = [t for t in q.split() if len(t) >= 2 and t not in ("the", "to", "for")]
                distinctive = [t for t in tokens if t not in generic_tokens]
                if distinctive:
                    if not all(t in label for t in distinctive):
                        score = 0
                    else:
                        matched = sum(1 for t in tokens if t in label)
                        score = int((matched / max(len(tokens), 1)) * 75)
                        if matched == len(tokens):
                            score += 20
                else:
                    matched = sum(1 for t in tokens if t in label)
                    if matched:
                        score = int((matched / max(len(tokens), 1)) * 75)
                        if matched == len(tokens):
                            score += 20
                    if len(tokens) == 1 and tokens[0] == "room":
                        score = min(score, 25)

        if score > best_score:
            best_score = score
            best = r

    return best if best_score >= 45 else None


def _format_indoor_route_message(route: Dict[str, Any], label: str, sublabel: str = "") -> str:
    if not route.get("found"):
        msg = route.get("message") or "Walking paths are not connected yet."
        return f"I found **{label}**" + (f" ({sublabel})" if sublabel else "") + f", but {msg}"

    steps = route.get("steps") or []
    dest = route.get("destinationLabel") or label
    bname = (route.get("building") or {}).get("name", "")
    lines = [f"Walking directions to **{dest}**" + (f" ({bname})" if bname else "") + ":"]
    for i, step in enumerate(steps[:10], 1):
        instr = step.get("instruction", step) if isinstance(step, dict) else step
        lines.append(f"{i}. {instr}")
    if len(steps) > 10:
        lines.append(f"... and {len(steps) - 10} more steps.")
    deep = route.get("deepLink")
    if deep:
        lines.append(f"**View directions:** {deep}")
    return "\n".join(lines)


def _fetch_and_reply_indoor_route(
    dispatcher: CollectingDispatcher,
    headers: Dict[str, str],
    tracker: Tracker,
) -> bool:
    """Return True if a reply was sent. Uses Floor Navigation AI Engine when available."""
    latest = tracker.latest_message or {}
    user_text = (latest.get("text") or "").strip()
    search_queries = _guide_search_queries(tracker)

    if user_text:
        try:
            nr = requests.post(
                f"{PLATFORM_API_URL}/navigation/query",
                json={"message": user_text},
                headers=headers,
                timeout=15,
            )
            if nr.ok:
                payload = nr.json().get("data", {})
                if payload.get("routed") and payload.get("found"):
                    label = payload.get("destinationLabel") or payload.get("roomLabel") or user_text
                    bname = (payload.get("building") or {}).get("name", "")
                    sublabel = bname
                    dispatcher.utter_message(text=_format_indoor_route_message(payload, label, sublabel))
                    return True
                if payload.get("routed") and not payload.get("found"):
                    msg = payload.get("message") or f'Could not find **{user_text}** on the indoor map.'
                    dispatcher.utter_message(text=msg)
                    return True
        except requests.RequestException:
            logger.info("Navigation engine query unavailable; falling back to map search")

    results: List[Dict[str, Any]] = []
    item: Optional[Dict[str, Any]] = None
    primary_q = search_queries[0] if search_queries else user_text

    for search_q in search_queries:
        r = requests.get(
            f"{PLATFORM_API_URL}/map/search",
            params={"q": search_q},
            headers=headers,
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        batch = data.get("data", []) if data.get("success") else []
        picked = _pick_map_room_result(batch, search_q or primary_q)
        if picked and picked.get("kind") != "building":
            item = picked
            break

    if not item and primary_q:
        # Last resort: score across merged results from primary query only
        r = requests.get(
            f"{PLATFORM_API_URL}/map/search",
            params={"q": primary_q},
            headers=headers,
            timeout=10,
        )
        if r.ok:
            batch = r.json().get("data", []) if r.json().get("success") else []
            item = _pick_map_room_result(batch, primary_q)

    if not item:
        room_label = search_queries[0] if search_queries else "that room"
        dispatcher.utter_message(
            text=(
                f"I couldn't find **{room_label}** on the indoor map.\n\n"
                "Uploading the floor JPG is only the first step. An admin must also:\n"
                "1. **Admin → Room map editor** → Administration Building → **Ground** → add a pin named **ELV ROOM**\n"
                "2. **Admin → Walking paths** → sync markers, add entrance + corridors, connect to the room\n\n"
                "Then ask again, or try **Campus Map** search."
            )
        )
        return True

    label = item.get("label", search_queries[0] if search_queries else "room")
    sublabel = item.get("sublabel", "")
    building_id = item.get("buildingId")
    floor = item.get("floor")
    marker_id = item.get("markerId")
    hall_id = item.get("id") if item.get("kind") == "hall" else item.get("hallId")

    if not building_id or item.get("kind") == "building":
        msg = f"**{label}**"
        if sublabel:
            msg += f" ({sublabel})"
        msg += ". Open **Campus Map** and search for a specific room to get indoor walking directions."
        dispatcher.utter_message(text=msg)
        return True

    if not marker_id and not hall_id:
        route_params: Dict[str, Any] = {"buildingId": building_id, "q": label}
    else:
        route_params = {"buildingId": building_id}
        if floor is not None:
            route_params["floor"] = floor
        if marker_id:
            route_params["toMarkerId"] = marker_id
        elif hall_id:
            route_params["toHallId"] = hall_id

    try:
        rr = requests.get(
            f"{PLATFORM_API_URL}/map/indoor-route",
            params=route_params,
            headers=headers,
            timeout=12,
        )
    except requests.RequestException:
        raise

    if rr.status_code >= 400:
        try:
            err_body = rr.json()
            err_msg = err_body.get("message") or err_body.get("error") or rr.text[:200]
        except Exception:
            err_msg = rr.text[:200] or f"HTTP {rr.status_code}"
        dispatcher.utter_message(
            text=(
                f"Found **{label}** but could not build a walking route: {err_msg}\n\n"
                "After uploading the floor JPG, run **Admin → Buildings → Analyze with AI** "
                "(or re-upload the image) so rooms and paths are created automatically."
            )
        )
        return True

    route = rr.json().get("data", {})
    dispatcher.utter_message(text=_format_indoor_route_message(route, label, sublabel))
    return True


class ActionTodayOnCampus(Action):
    """List today's classes with lecturers, halls, and guided map links."""

    def name(self) -> Text:
        return "action_today_on_campus"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[str, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(text="Please log in to see today's classes.")
            return []

        try:
            r = requests.get(
                f"{PLATFORM_API_URL}/timetable/my/today",
                headers=_api_headers(user_id),
                timeout=10,
            )
            r.raise_for_status()
            data = r.json().get("data", {})
            slots = data.get("slots") or []
            day = (data.get("dayOfWeek") or "").title()

            if not slots:
                dispatcher.utter_message(
                    text=f"You have **no classes scheduled** for {day or 'today'}."
                )
                return []

            lines = [f"**Today on campus** ({day}):"]
            if data.get("hasMultipleLocations"):
                lines.append(
                    f"You have classes in **{data.get('locationCount', 2)}** different rooms today."
                )

            for s in slots:
                now_tag = " — **NOW**" if s.get("isNow") else ""
                hall = s.get("hall", {})
                bname = s.get("mapBuildingName") or hall.get("building", "")
                floor = s.get("floor", 0)
                fl = "Ground" if floor == 0 else f"Floor {floor}"
                lines.append(
                    f"• {_format_ampm(s['startTime'])}–{_format_ampm(s['endTime'])}: "
                    f"**{s['course']['name']}** with {s.get('lecturerName', 'TBD')}{now_tag}"
                )
                lines.append(f"  Room: **{hall.get('name', 'TBD')}** — {bname}, {fl}")
                if s.get("mapBuildingId"):
                    params = f"buildingId={s['mapBuildingId']}&floor={floor}&hallId={hall.get('id')}&destination={hall.get('name')}"
                    if s.get("markerId"):
                        params += f"&markerId={s['markerId']}"
                    lines.append(f"  Navigate: /map?{params}")

            lines.append("\n**All today's routes:** /map/guide?today=1")
            dispatcher.utter_message(text="\n".join(lines))
        except requests.RequestException:
            logger.exception("Today on campus API error")
            dispatcher.utter_message(
                text="I couldn't load today's schedule. Try **My Timetable** on the dashboard."
            )
        return []


class ActionGuideToRoom(Action):
    """Indoor route to a named hall or room."""

    def name(self) -> Text:
        return "action_guide_to_room"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(text="Please log in to get walking directions.")
            return []

        queries = _guide_search_queries(tracker)
        if not queries:
            dispatcher.utter_message(
                text="Which room? For example: 'Take me to ELV ROOM in Administration building'."
            )
            return []

        try:
            _fetch_and_reply_indoor_route(dispatcher, _api_headers(user_id), tracker)
        except requests.RequestException:
            logger.exception("Guide to room API error")
            dispatcher.utter_message(
                text="I couldn't get directions. Open **Campus Map** (/map) and search for the room."
            )
        return [SlotSet("hall_name", None)]


class ActionGuideToNextClass(Action):
    """Route to current or next class today via unified navigation API."""

    def name(self) -> Text:
        return "action_guide_to_next_class"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(text="Please log in to find your next class.")
            return []

        headers = _api_headers(user_id)
        try:
            nr = requests.post(
                f"{PLATFORM_API_URL}/navigation/query",
                json={"message": "guide me to my next class"},
                headers=headers,
                timeout=15,
            )
            nr.raise_for_status()
            payload = nr.json().get("data", {})

            if not payload.get("routed"):
                dispatcher.utter_message(
                    text=payload.get("message") or "That doesn't look like a navigation request."
                )
                return []

            ctx = payload.get("classContext") or {}
            if ctx:
                when = ctx.get("when", "")
                intro = (
                    f"Your {'current' if ctx.get('isCurrent') else 'next'} class {when} is "
                    f"**{ctx.get('courseName', 'Class')}** with {ctx.get('lecturerName', 'TBD')} "
                    f"in **{ctx.get('hallName', 'the room')}**.\n\n"
                )
            else:
                intro = ""

            if payload.get("found"):
                label = payload.get("destinationLabel") or ctx.get("hallName") or "your class"
                dispatcher.utter_message(
                    text=intro + _format_indoor_route_message(payload, label)
                )
            else:
                dispatcher.utter_message(
                    text=intro + (payload.get("message") or "Could not build a route to your next class.")
                )
        except requests.RequestException:
            logger.exception("Guide to next class API error")
            dispatcher.utter_message(
                text="I couldn't find your next class. Open **My Timetable** or ask 'What classes do I have today?'"
            )
        return []


class ActionGetDirections(Action):
    """Search map then indoor A* route with turn-by-turn steps."""

    def name(self) -> Text:
        return "action_get_directions"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to search for directions."
            )
            return []

        queries = _guide_search_queries(tracker)
        if not queries:
            dispatcher.utter_message(
                text="Which room or building? For example: 'Guide me to ELV ROOM in Administration building'."
            )
            return []

        try:
            _fetch_and_reply_indoor_route(dispatcher, _api_headers(user_id), tracker)
        except requests.RequestException:
            logger.exception("Map/directions API error")
            dispatcher.utter_message(
                text="I couldn't get directions. Open Campus Map and search for the room."
            )
        return []


class ActionGetOfficeLocation(Action):
    """Get lecturer office via GET /api/lecturers/:id."""

    def name(self) -> Text:
        return "action_get_office_location"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_id = _get_user_id(tracker)
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to look up office locations."
            )
            return []

        lecturer_name = _get_lecturer_name_from_tracker(tracker)
        if not lecturer_name:
            dispatcher.utter_message(
                text="Which lecturer's office? For example: 'Where is Prof. Dhammika Weerasinghe's office?'"
            )
            return []

        if user_id and any(ord(c) >= 128 for c in lecturer_name):
            lecturer_name = _translate_to_english(lecturer_name, user_id)

        try:
            lec = _lookup_lecturer(user_id, lecturer_name)
            if not lec:
                dispatcher.utter_message(
                    text=f"I couldn't find lecturer '{lecturer_name}'. Check the Lecturers page."
                )
                return []

            office = lec.get("lecturerOffice") or lec.get("office")
            if not office:
                lec_full = f"{lec.get('firstName', '')} {lec.get('lastName', '')}".strip()
                dispatcher.utter_message(
                    text=f"{lec_full} doesn't have office information in the system. Check the Lecturers page."
                )
                return []

            room = office.get("roomNumber", "?")
            bldg = office.get("building", "?")
            floor = office.get("floor", "")
            lec_full = f"{lec.get('firstName', '')} {lec.get('lastName', '')}".strip()
            msg = f"{lec_full}'s office: Room {room}, {bldg}"
            if floor:
                msg += f", Floor {floor}"
            msg += ". See the Campus Map for directions."
            dispatcher.utter_message(text=msg)
        except requests.RequestException:
            logger.exception("Office location API error")
            dispatcher.utter_message(
                text="I couldn't look up the office. Please try the Lecturers page."
            )
        return []

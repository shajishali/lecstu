"""
AI Direction Generator — natural-language turn-by-turn from graph path (no hallucination).
Uses only nodes/labels from the actual path; optional LLM polish via Ollama.
"""
from __future__ import annotations

import json
import math
import os
import re
import urllib.request
from typing import Any

from engine.logging_config import setup_logging

logger = setup_logging("direction-generator")

OLLAMA_URL = os.environ.get("NAV_LLM_URL", "http://localhost:11434/api/generate")
USE_LLM = os.environ.get("NAV_USE_LLM", "false").lower() == "true"

_AUTO_CORRIDOR = re.compile(r"^corridor\s*(\(auto\b|\d)", re.I)
_DOOR = re.compile(r"^door(\s+\d+|\s*-\s*|\s+arc)", re.I)


def _bearing(from_n: dict, to_n: dict) -> float:
    dx = to_n["x"] - from_n["x"]
    dy = to_n["y"] - from_n["y"]
    if abs(dx) < 0.01 and abs(dy) < 0.01:
        return 0.0
    return math.degrees(math.atan2(dx, dy))


def _normalize_deg(d: float) -> float:
    while d > 180:
        d -= 360
    while d < -180:
        d += 360
    return d


def _turn_phrase(delta: float) -> str:
    if 28 < delta < 152:
        return "Turn right"
    if -152 < delta < -28:
        return "Turn left"
    if abs(delta) >= 152:
        return "Turn around"
    return "Go straight"


def _human_label(node: dict) -> str:
    """Convert internal nav node labels to natural phrases for users."""
    label = re.sub(r"\s*\(auto\s+[\d.]+%?\)\s*", " ", (node.get("label") or "").strip(), flags=re.I)
    label = re.sub(r"\s+", " ", label).strip()
    ntype = (node.get("type") or "").upper()

    if ntype == "CORRIDOR" or _AUTO_CORRIDOR.match(label) or label.lower().startswith("corridor"):
        return "the corridor"
    if ntype == "ENTRANCE" or re.search(r"\b(entrance|entry|reception)\b", label, re.I):
        return "the main entrance"
    if ntype == "STAIRS" or re.search(r"\bstair", label, re.I):
        return "the stairs"
    if ntype == "LIFT" or re.search(r"\blift\b", label, re.I):
        return "the lift area"
    if _DOOR.match(label):
        return "the doorway"
    if re.match(r"^area\s+\d+$", label, re.I):
        return "the open area"
    return label or "the next point"


def _target_phrase(node: dict) -> str:
    return _human_label(node)


def _nearby_rooms(path_nodes: list[dict], idx: int) -> list[str]:
    if idx >= len(path_nodes):
        return []
    cur = path_nodes[idx]
    nearby: list[str] = []
    for n in path_nodes:
        if (n.get("type") or "").upper() != "ROOM":
            continue
        d = math.hypot(n["x"] - cur["x"], n["y"] - cur["y"])
        lbl = _human_label(n)
        if lbl.startswith("the "):
            continue
        if 0 < d < 15 and lbl not in nearby:
            nearby.append(lbl)
    return nearby[:2]


def _start_instruction(start: dict, building_name: str | None) -> str:
    start_label = _human_label(start)
    if building_name and building_name.lower() not in start_label.lower():
        return f"Start at {start_label} in {building_name}."
    return f"Start at {start_label}."


def generate_directions(
    path_nodes: list[dict],
    destination_label: str,
    building_name: str | None = None,
) -> dict[str, Any]:
    if not path_nodes:
        return {"steps": [], "confidence": 0.0, "engine": "template"}

    dest_clean = destination_label.strip()
    steps: list[dict[str, Any]] = []
    start = path_nodes[0]

    steps.append(
        {
            "instruction": _start_instruction(start, building_name),
            "floor": 0,
            "node_id": start.get("id"),
            "confidence": 0.95,
        }
    )

    for i in range(1, len(path_nodes)):
        prev = path_nodes[i - 1]
        cur = path_nodes[i]
        bearing = _bearing(prev, cur)
        target = _target_phrase(cur)
        prev_label = _human_label(prev)
        is_last = i == len(path_nodes) - 1

        if i == 1:
            b = _normalize_deg(bearing)
            if -35 <= b <= 35:
                move = "Walk straight ahead"
            elif 35 < b < 145:
                move = "Walk to your right"
            elif -145 < b < -35:
                move = "Walk to your left"
            else:
                move = "Turn around and proceed"
            instruction = f"{move} toward {target}."
        else:
            prev_bearing = _bearing(path_nodes[i - 2], prev)
            turn = _normalize_deg(bearing - prev_bearing)
            if abs(turn) > 22:
                instruction = f"{_turn_phrase(turn)} near {prev_label}, then continue toward {target}."
            else:
                instruction = f"Continue straight through {prev_label} toward {target}."

        nearby = _nearby_rooms(path_nodes, i)
        if nearby and not is_last:
            instruction = instruction.rstrip(".") + f" (you will pass {nearby[0]})."

        if is_last:
            cur_type = (cur.get("type") or "").upper()
            if cur_type == "ROOM" or dest_clean.lower() in _human_label(cur).lower():
                t = _normalize_deg(bearing)
                if 25 < t < 155:
                    instruction = f"Turn right — {dest_clean} is beside {prev_label}."
                elif -155 < t < -25:
                    instruction = f"Turn left — {dest_clean} is beside {prev_label}."
                else:
                    instruction = f"Go straight into {dest_clean}."

        steps.append(
            {
                "instruction": instruction,
                "floor": 0,
                "node_id": cur.get("id"),
                "confidence": 0.88,
            }
        )

    if not any("arrived" in s["instruction"].lower() for s in steps):
        steps.append(
            {
                "instruction": f"You have arrived at {dest_clean}.",
                "floor": 0,
                "confidence": 0.99,
            }
        )

    last_label = _human_label(path_nodes[-1])
    dest_validated = (
        dest_clean.lower() in last_label.lower()
        or (path_nodes[-1].get("type") or "").upper() == "ROOM"
    )

    avg_conf = sum(s.get("confidence", 0.8) for s in steps) / max(len(steps), 1)
    result = {
        "steps": steps,
        "confidence": round(avg_conf, 3),
        "engine": "template",
        "destination_validated": dest_validated,
    }

    if USE_LLM:
        polished = _try_llm_polish(result["steps"], dest_clean, building_name)
        if polished:
            result["steps"] = polished
            result["engine"] = "template+llm"

    return result


def generate_directions_from_api_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept path from Express API (polyline + labels) and generate directions."""
    polyline = payload.get("polyline") or []
    path_nodes = [
        {
            "id": p.get("nodeId") or f"n{i}",
            "label": p.get("label") or f"Point {i + 1}",
            "x": float(p["x"]),
            "y": float(p["y"]),
            "type": p.get("type") or ("ROOM" if i == len(polyline) - 1 else "CORRIDOR"),
        }
        for i, p in enumerate(polyline)
    ]
    return generate_directions(
        path_nodes,
        payload.get("destinationLabel") or path_nodes[-1]["label"],
        payload.get("buildingName"),
    )


def _try_llm_polish(
    steps: list[dict],
    destination: str,
    building: str | None,
) -> list[dict] | None:
    facts = [s["instruction"] for s in steps]
    prompt = (
        f"Rewrite these indoor walking directions naturally for {destination}"
        f"{f' in {building}' if building else ''}. "
        "Use ONLY the places mentioned. Do not invent rooms. "
        "Return JSON array of strings, one per step.\n"
        + json.dumps(facts)
    )
    try:
        body = json.dumps({"model": "qwen2.5", "prompt": prompt, "stream": False}).encode()
        req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        text = data.get("response", "")
        match = re.search(r"\[.*\]", text, re.S)
        if not match:
            return None
        lines = json.loads(match.group())
        if len(lines) != len(steps):
            return None
        return [{**steps[i], "instruction": str(lines[i])} for i in range(len(steps))]
    except Exception as e:
        logger.debug("LLM polish skipped: %s", e)
        return None

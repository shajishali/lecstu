"""
Floor Map Upload & Processing Service — orchestrates OCR, detection, graph build.
"""
from __future__ import annotations

from typing import Any

from engine.logging_config import setup_logging
import re

from engine.map_region import detect_drawable_region, filter_legend_placements, normalize_room_label
from engine.ocr_engine import run_ocr
from engine.room_corridor_detector import detect_rooms_and_corridors
from engine.spatial_graph import build_spatial_graph

logger = setup_logging("floor-processor")


def _dedupe_places(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for item in items:
        key = str(item.get("label", "")).upper()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def process_floor_map(image_path: str) -> dict[str, Any]:
    logger.info("Processing floor map: %s", image_path)

    import cv2

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")
    oh, ow = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    drawable_region = detect_drawable_region(gray, ow, oh)

    ocr_result = run_ocr(image_path, image_array=img, drawable_region=drawable_region)
    ocr_detections = ocr_result.get("detections", [])
    legend_names = ocr_result.get("legend_room_names") or []

    legend_map = ocr_result.get("legend_map") or {}
    legend_places = [
        d
        for d in ocr_detections
        if d.get("source") in ("legend-index", "legend-map-match") or d.get("legendNumber") is not None
    ]
    facilities = [
        d
        for d in ocr_detections
        if re.search(r"STAIR|LIFT|TOILET|ELEVATOR", str(d.get("label", "")), re.I)
        and d.get("source") != "legend-index"
    ]

    if legend_places or legend_map:
        rooms_from_ocr = _dedupe_places(legend_places or [d for d in ocr_detections if d.get("legendNumber")])
        entrances = [d for d in rooms_from_ocr if d.get("type") == "ENTRANCE"]
        if not entrances:
            entrances = [d for d in ocr_detections if d.get("type") == "ENTRANCE"]
        skip_opencv_rooms = True
    else:
        rooms_from_ocr = [d for d in ocr_detections if d.get("type") == "ROOM"]
        entrances = [d for d in ocr_detections if d.get("type") == "ENTRANCE"]
        skip_opencv_rooms = False

    vision = detect_rooms_and_corridors(
        image_path, ocr_rooms=rooms_from_ocr, skip_region_detect=skip_opencv_rooms
    )
    vision["rooms"] = filter_legend_placements(vision["rooms"], drawable_region)
    vision["rooms"] = _dedupe_places(vision["rooms"])
    if facilities:
        vision["rooms"] = _dedupe_places(vision["rooms"] + facilities)

    graph_result = build_spatial_graph(
        rooms=vision["rooms"],
        corridors=vision["corridors"],
        doors=vision["doors"],
        entrances=entrances,
    )

    G = graph_result.pop("graph", None)

    return {
        "rooms": vision["rooms"],
        "entrances": entrances or [{"label": "Main entrance", "x": 50.0, "y": 92.0, "type": "ENTRANCE"}],
        "doors": vision["doors"],
        "corridors": vision["corridors"],
        "nodes": graph_result["nodes"],
        "edges": graph_result["edges"],
        "stats": {
            **graph_result["stats"],
            "ocr_count": ocr_result.get("ocr_count", 0),
            "legend_room_names": legend_names,
            "legend_map": legend_map,
            "legend_place_count": len(legend_places),
            "detection_methods": vision.get("methods", {}),
        },
        "legend_places": [d for d in vision["rooms"] if d.get("legendNumber") is not None],
        "ocr_engine": ocr_result.get("engine"),
        "drawableRegion": drawable_region,
        "engine": "indoor-navigation-engine-v1",
        "confidence": _overall_confidence(vision["rooms"], graph_result["stats"]),
    }


def _overall_confidence(rooms: list[dict], stats: dict) -> float:
    if not rooms:
        return 0.35
    room_conf = sum(r.get("confidence", 0.5) for r in rooms) / len(rooms)
    graph_bonus = min(0.15, stats.get("edge_count", 0) * 0.01)
    return round(min(0.98, room_conf * 0.85 + graph_bonus), 3)

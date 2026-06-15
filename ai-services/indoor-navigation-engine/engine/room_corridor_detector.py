"""
Room & Corridor Detection Engine — OpenCV region analysis + optional YOLOv8.
"""
from __future__ import annotations

import os
from typing import Any

import cv2
import numpy as np

from engine.logging_config import setup_logging

logger = setup_logging("room-corridor")

_yolo_model = None
USE_YOLO = os.environ.get("NAV_USE_YOLO", "false").lower() == "true"


def _get_yolo():
    global _yolo_model
    if _yolo_model is None and USE_YOLO:
        try:
            from ultralytics import YOLO

            _yolo_model = YOLO("yolov8n.pt")
            logger.info("YOLOv8 loaded for room detection")
        except Exception as e:
            logger.warning("YOLOv8 unavailable: %s", e)
    return _yolo_model


def _detect_rooms_opencv(gray: np.ndarray, ow: int, oh: int, existing: list[dict]) -> list[dict]:
    margin_x, margin_y = int(ow * 0.06), int(oh * 0.08)
    roi = gray[margin_y : oh - margin_y, margin_x : ow - margin_x]
    if roi.size == 0:
        return []

    blur = cv2.GaussianBlur(roi, (5, 5), 0)
    _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found: list[dict] = []
    min_area = (ow * oh) * 0.002
    max_area = (ow * oh) * 0.35

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw < 25 or bh < 25:
            continue
        aspect = bw / max(bh, 1)
        if aspect > 6 or aspect < 0.15:
            continue
        cx = margin_x + x + bw / 2
        cy = margin_y + y + bh / 2
        px, py = round(cx / ow * 100, 2), round(cy / oh * 100, 2)
        too_close = any(
            ((px - ex["x"]) ** 2 + (py - ex["y"]) ** 2) ** 0.5 < 5
            for ex in existing + found
        )
        if too_close:
            continue
        found.append(
            {
                "label": f"Area {len(found) + 1}",
                "x": px,
                "y": py,
                "confidence": 0.38,
                "type": "ROOM",
                "source": "opencv_region",
            }
        )
        if len(found) >= 8:
            break
    return found


def _detect_corridors(gray: np.ndarray, ow: int, oh: int) -> list[dict]:
    """Skeletonize wall-free space to find corridor centerlines."""
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 50, 150)
    wall = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (4, 4)), iterations=2)
    free = cv2.bitwise_not(wall)
    free = cv2.morphologyEx(free, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))

    dist = cv2.distanceTransform(free, cv2.DIST_L2, 5)
    _, peaks = cv2.threshold(dist, 8, 255, cv2.THRESH_BINARY)
    peaks = peaks.astype(np.uint8)

    ys, xs = np.where(peaks > 0)
    if len(xs) < 10:
        return [{"label": "Corridor hub", "x": 50.0, "y": 50.0, "type": "CORRIDOR", "confidence": 0.4}]

    step = max(1, len(xs) // 12)
    corridors: list[dict] = []
    for i in range(0, len(xs), step):
        px = round(xs[i] / ow * 100, 2)
        py = round(ys[i] / oh * 100, 2)
        corridors.append(
            {
                "label": f"Corridor node {len(corridors) + 1}",
                "x": px,
                "y": py,
                "type": "CORRIDOR",
                "confidence": 0.55,
                "source": "skeleton",
            }
        )
        if len(corridors) >= 10:
            break
    return corridors


def _detect_doors(gray: np.ndarray, ow: int, oh: int) -> list[dict]:
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 40, 120)
    wall = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=2)
    inv = cv2.bitwise_not(wall)
    gaps, _ = cv2.findContours(inv, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    doors: list[dict] = []
    seen: set[tuple[int, int]] = set()

    for cnt in gaps:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area = bw * bh
        if area < 20 or area > 900 or bw < 6 or bh < 6 or bw > 55 or bh > 55:
            continue
        ar = bw / max(bh, 1)
        if ar > 3.5 or ar < 0.28:
            continue
        px = round((x + bw / 2) / ow * 100, 2)
        py = round((y + bh / 2) / oh * 100, 2)
        key = (round(px / 2), round(py / 2))
        if key in seen:
            continue
        seen.add(key)
        doors.append(
            {
                "label": f"Door {len(doors) + 1}",
                "x": px,
                "y": py,
                "type": "DOOR",
                "confidence": 0.45,
                "source": "wall_gap",
            }
        )
        if len(doors) >= 20:
            break
    return doors


def detect_rooms_and_corridors(
    image_path: str,
    ocr_rooms: list[dict] | None = None,
    skip_region_detect: bool = False,
) -> dict[str, Any]:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    oh, ow = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    existing = list(ocr_rooms or [])

    region_rooms = [] if skip_region_detect else _detect_rooms_opencv(gray, ow, oh, existing)
    corridors = _detect_corridors(gray, ow, oh)
    doors = _detect_doors(gray, ow, oh)

    yolo_rooms: list[dict] = []
    yolo = _get_yolo()
    if yolo is not None:
        try:
            results = yolo.predict(image_path, verbose=False, conf=0.35)
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    yolo_rooms.append(
                        {
                            "label": f"Detected region {len(yolo_rooms) + 1}",
                            "x": round(cx / ow * 100, 2),
                            "y": round(cy / oh * 100, 2),
                            "confidence": round(float(box.conf[0]), 3),
                            "type": "ROOM",
                            "source": "yolov8",
                        }
                    )
        except Exception as e:
            logger.warning("YOLO detection failed: %s", e)

    return {
        "rooms": existing + region_rooms + yolo_rooms,
        "corridors": corridors,
        "doors": doors,
        "methods": {
            "opencv_regions": len(region_rooms),
            "corridor_nodes": len(corridors),
            "doors": len(doors),
            "yolo": len(yolo_rooms),
        },
    }

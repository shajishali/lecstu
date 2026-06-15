"""
Floor plan image analysis — OCR room labels, door symbols, stairs/lift, region hints.
Used by LECSTU after admin uploads a building floor JPG.
"""
from __future__ import annotations

import re
from typing import Any

import cv2
import numpy as np

_reader = None

ROOM_HINT = re.compile(
    r"(ROOM|ELV|LAB|OFFICE|HALL|SEMINAR|SCALE|STORE|TOILET|WC|ENTRANCE|ENTRY|RECEPTION|CLERK|"
    r"LOBBY|CAFETERIA|WAITING|SHROFF|SECURITY|AFFAIRS|BREAST|ELECTRICAL|STAIR|LIFT|CORRIDOR|"
    r"MEETING|ADMIN|CLERK|PANTRY|KITCHEN)",
    re.I,
)
LEGEND_LINE = re.compile(r"^(\d{1,2})\s*[\.\):\-]\s*(.+)$", re.I)
SYMBOL_HINT = re.compile(r"(STAIR|LIFT|TOILET|WC|ESCALATOR)", re.I)


def _f(value: Any) -> float:
    return round(float(value), 2)


def _sanitize_for_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    mod = type(obj).__module__
    if mod == "numpy":
        if hasattr(obj, "tolist"):
            return _sanitize_for_json(obj.tolist())
        return float(obj) if "float" in type(obj).__name__ else int(obj)
    return obj


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr

        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _reader


def _bbox_center(bbox: list) -> tuple[float, float]:
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _pct(cx: float, cy: float, ow: int, oh: int) -> tuple[float, float]:
    return _f(cx / ow * 100), _f(cy / oh * 100)


def _is_room_like(text: str) -> bool:
    t = text.strip()
    if len(t) < 2:
        return False
    if LEGEND_LINE.match(t):
        return True
    if ROOM_HINT.search(t):
        return True
    if re.match(r"^[A-Z]{0,5}\s*\d{1,3}[A-Z]?$", t.replace(" ", ""), re.I):
        return True
    if len(t) >= 3 and t.isalpha() and t.upper() in (
        "ELV",
        "LAB",
        "HOD",
        "DCSE",
        "WC",
    ):
        return True
    return False


def _normalize_label(text: str) -> str | None:
    t = re.sub(r"\s+", " ", text.strip().upper())
    m = LEGEND_LINE.match(t)
    if m:
        t = m.group(2).strip()
    if re.fullmatch(r"\d{1,3}", t):
        return None
    if len(t) < 3:
        return None
    if t == "ELV":
        return "ELV ROOM"
    if t in ("ENTRY", "ENTR"):
        return "ENTRANCE"
    if t == "WC":
        return "TOILET"
    return t


def _is_valid_place_label(label: str) -> bool:
    if not label or len(label) < 3:
        return False
    if re.fullmatch(r"\d{1,3}", label.strip()):
        return False
    return True


def _merge_nearby_detections(
    items: list[dict[str, Any]], max_gap_px: float
) -> list[dict[str, Any]]:
    if not items:
        return []
    items = sorted(items, key=lambda d: (d["cy"], d["cx"]))
    merged: list[dict[str, Any]] = []
    used = [False] * len(items)

    for i, a in enumerate(items):
        if used[i]:
            continue
        group = [a]
        used[i] = True
        for j in range(i + 1, len(items)):
            if used[j]:
                continue
            b = items[j]
            if abs(a["cy"] - b["cy"]) > max_gap_px * 0.7:
                continue
            if abs(a["cx"] - b["cx"]) > max_gap_px * 2.5:
                continue
            group.append(b)
            used[j] = True
        label = _normalize_label(" ".join(g["text"] for g in group))
        if not label:
            continue
        cx = sum(g["cx"] for g in group) / len(group)
        cy = sum(g["cy"] for g in group) / len(group)
        conf = max(g["confidence"] for g in group)
        px, py = _pct(cx, cy, group[0]["ow"], group[0]["oh"])
        merged.append(
            {
                "label": label,
                "x": px,
                "y": py,
                "cx": cx,
                "cy": cy,
                "confidence": conf,
                "text": label,
            }
        )
    return merged


def _dedupe_placements(
    items: list[dict[str, Any]], min_dist_pct: float = 3.5
) -> list[dict[str, Any]]:
    """Keep best label when two detections are very close."""
    out: list[dict[str, Any]] = []
    for item in sorted(items, key=lambda d: (-d.get("confidence", 0), -len(d["label"]))):
        dup = False
        for kept in out:
            if (
                (item["x"] - kept["x"]) ** 2 + (item["y"] - kept["y"]) ** 2
            ) ** 0.5 < min_dist_pct:
                dup = True
                break
        if not dup:
            out.append(item)
    return out


def _extract_ocr_places(raw: list, ow: int, oh: int) -> tuple[list[dict], list[dict], list[dict]]:
    """Parse EasyOCR output into rooms, entrances, symbols."""
    rooms: list[dict[str, Any]] = []
    entrances: list[dict[str, Any]] = []
    symbols: list[dict[str, Any]] = []
    ocr_items: list[dict[str, Any]] = []

    for bbox, text, conf in raw:
        if conf < 0.22:
            continue
        t = text.strip()
        if len(t) < 2:
            continue
        cx, cy = _bbox_center(bbox)
        px, py = _pct(cx, cy, ow, oh)

        if SYMBOL_HINT.search(t):
            symbols.append(
                {
                    "label": _normalize_label(t),
                    "x": px,
                    "y": py,
                    "confidence": _f(conf),
                    "type": "SYMBOL",
                }
            )
            continue

        if not _is_room_like(t) and not re.search(
            r"entrance|entry|reception|main\s*ent", t, re.I
        ):
            continue

        ocr_items.append(
            {
                "text": t,
                "cx": cx,
                "cy": cy,
                "ow": ow,
                "oh": oh,
                "confidence": _f(conf),
            }
        )

    for d in _merge_nearby_detections(ocr_items, max_gap_px=ow * 0.035):
        label = d["label"]
        if not _is_valid_place_label(label):
            continue
        entry = {
            "label": label,
            "x": d["x"],
            "y": d["y"],
            "confidence": d["confidence"],
        }
        if re.search(r"entrance|entry|reception", label, re.I):
            entrances.append({**entry, "type": "ENTRANCE"})
        elif SYMBOL_HINT.search(label):
            symbols.append({**entry, "type": "SYMBOL"})
        else:
            rooms.append({**entry, "type": "ROOM"})

    return rooms, entrances, symbols


def _detect_room_regions(
    gray: np.ndarray, ow: int, oh: int, existing: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Find large interior (bright) regions — room footprints when OCR missed a label.
    """
    margin_x = int(ow * 0.06)
    margin_y = int(oh * 0.08)
    roi = gray[margin_y : oh - margin_y, margin_x : ow - margin_x]
    if roi.size == 0:
        return []

    blur = cv2.GaussianBlur(roi, (5, 5), 0)
    _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found: list[dict[str, Any]] = []
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
        px, py = _pct(cx, cy, ow, oh)
        too_close = False
        for ex in existing + found:
            if ((px - ex["x"]) ** 2 + (py - ex["y"]) ** 2) ** 0.5 < 5:
                too_close = True
                break
        if too_close:
            continue
        found.append(
            {
                "label": f"Area {len(found) + 1}",
                "x": px,
                "y": py,
                "confidence": 0.35,
                "type": "ROOM",
                "source": "region",
            }
        )
        if len(found) >= 6:
            break
    return found


def _detect_wall_gap_doors(gray: np.ndarray, ow: int, oh: int) -> list[dict[str, Any]]:
    """Door openings as gaps in thickened wall lines."""
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 40, 120)
    wall = cv2.dilate(
        edges,
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
        iterations=2,
    )
    inv = cv2.bitwise_not(wall)
    gaps, _ = cv2.findContours(inv, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    doors: list[dict[str, Any]] = []
    seen: set[tuple[int, int]] = set()

    for cnt in gaps:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area = bw * bh
        if area < 20 or area > 900:
            continue
        if bw < 6 or bh < 6 or bw > 55 or bh > 55:
            continue
        ar = bw / max(bh, 1)
        if ar > 3.5 or ar < 0.28:
            continue
        cx_pix = x + bw / 2
        cy_pix = y + bh / 2
        px, py = _pct(cx_pix, cy_pix, ow, oh)
        key = (round(px / 2), round(py / 2))
        if key in seen:
            continue
        seen.add(key)
        doors.append(
            {
                "label": f"Door {len(doors) + 1}",
                "x": px,
                "y": py,
                "confidence": 0.45,
                "type": "DOOR",
                "source": "wall_gap",
            }
        )
        if len(doors) >= 25:
            break
    return doors


def _detect_door_arc_symbols(gray: np.ndarray, ow: int, oh: int) -> list[dict[str, Any]]:
    """Quarter-circle door swing symbols via small circle detection."""
    blur = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=12,
        param1=80,
        param2=18,
        minRadius=4,
        maxRadius=22,
    )
    doors: list[dict[str, Any]] = []
    if circles is None:
        return doors

    seen: set[tuple[int, int]] = set()
    for c in circles[0]:
        cx, cy, r = float(c[0]), float(c[1]), float(c[2])
        px, py = _pct(cx, cy, ow, oh)
        key = (round(px), round(py))
        if key in seen:
            continue
        seen.add(key)
        doors.append(
            {
                "label": f"Door arc {len(doors) + 1}",
                "x": px,
                "y": py,
                "confidence": 0.5,
                "type": "DOOR",
                "source": "arc",
            }
        )
        if len(doors) >= 20:
            break
    return doors


def _merge_door_detections(door_lists: list[list[dict]]) -> list[dict[str, Any]]:
    all_doors: list[dict[str, Any]] = []
    for lst in door_lists:
        all_doors.extend(lst)
    return _dedupe_placements(all_doors, min_dist_pct=2.8)


def _label_doors_near_rooms(
    doors: list[dict[str, Any]], rooms: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    for i, door in enumerate(doors):
        best_room = None
        best_d = 999.0
        for room in rooms:
            d = ((door["x"] - room["x"]) ** 2 + (door["y"] - room["y"]) ** 2) ** 0.5
            if d < best_d:
                best_d = d
                best_room = room
        if best_room and best_d < 12:
            door["label"] = f"Door - {best_room['label']}"
            door["nearRoom"] = best_room["label"]
        else:
            door["label"] = f"Door {i + 1}"
    return doors


def analyze_floor_plan(image_path: str) -> dict[str, Any]:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]
    max_dim = 2400
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img_work = cv2.resize(img, (int(w * scale), int(h * scale)))
    else:
        img_work = img.copy()

    oh, ow = img_work.shape[:2]
    gray = cv2.cvtColor(img_work, cv2.COLOR_BGR2GRAY)
    from map_region import detect_drawable_region, filter_legend_placements, normalize_room_label

    drawable_region = detect_drawable_region(gray, ow, oh)
    y_cut = int(oh * float(drawable_region["y1"]) / 100)
    y_cut = max(int(oh * 0.5), min(y_cut, int(oh * 0.88)))

    reader = _get_reader()
    raw = reader.readtext(img_work[0:y_cut, :], paragraph=False)

    rooms, entrances, symbols = _extract_ocr_places(raw, ow, oh)
    gray = cv2.cvtColor(img_work, cv2.COLOR_BGR2GRAY)

    region_rooms = _detect_room_regions(gray, ow, oh, rooms + entrances + symbols)
    rooms.extend(region_rooms)

    gap_doors = _detect_wall_gap_doors(gray, ow, oh)
    arc_doors = _detect_door_arc_symbols(gray, ow, oh)
    doors = _merge_door_detections([gap_doors, arc_doors])
    doors = _dedupe_placements(doors, min_dist_pct=4.5)
    doors = _label_doors_near_rooms(doors, rooms)
    doors.sort(
        key=lambda d: (
            0 if d.get("nearRoom") else 1,
            -float(d.get("confidence", 0)),
        )
    )
    doors = doors[:20]

    rooms = [r for r in rooms if _is_valid_place_label(r["label"])]
    rooms = _dedupe_placements(rooms, min_dist_pct=3.5)
    rooms = filter_legend_placements(rooms, drawable_region)
    entrances = _dedupe_placements(entrances, min_dist_pct=4.0)
    entrances = filter_legend_placements(entrances, drawable_region)
    symbols = _dedupe_placements(symbols, min_dist_pct=4.0)

    if not entrances:
        ent_ocr = [
            r
            for r in raw
            if len(r) >= 2
            and r[1]
            and re.search(r"entrance|entry|reception", str(r[1]), re.I)
            and r[2] > 0.25
        ]
        if ent_ocr:
            bbox, _, conf = ent_ocr[0]
            cx, cy = _bbox_center(bbox)
            px, py = _pct(cx, cy, ow, oh)
            entrances.append(
                {
                    "label": "Building entrance",
                    "x": px,
                    "y": py,
                    "confidence": _f(conf),
                    "type": "ENTRANCE",
                }
            )
        else:
            entrances.append(
                {
                    "label": "Main entrance",
                    "x": 50.0,
                    "y": 92.0,
                    "confidence": 0.5,
                    "type": "ENTRANCE",
                }
            )

    return _sanitize_for_json(
        {
            "rooms": rooms,
            "entrances": entrances,
            "doors": doors,
            "symbols": symbols,
            "imageWidth": int(w),
            "imageHeight": int(h),
            "ocrCount": int(len(raw)),
            "engine": "easyocr+opencv-v2",
            "drawableRegion": drawable_region,
        }
    )

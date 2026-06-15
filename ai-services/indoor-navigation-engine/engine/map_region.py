"""Detect architectural drawing region vs legend/footer on floor plan images."""
from __future__ import annotations

import re

import cv2
import numpy as np

LEGEND_LINE = re.compile(r"^\d{1,2}\s*[\.\):\-]\s*\S", re.I)
LEGEND_ENTRY = re.compile(r"^\d{1,2}\s*[\.\):\-]\s*(.+)$", re.I)
NUM_MARKER = re.compile(r"^(\d{1,2})\s*[\._]?\s*$")
ROOM_NAME_HINT = re.compile(
    r"(ROOM|ELV|ELECTRICAL|LAB|OFFICE|HALL|CAFETERIA|MEETING|LOBBY|ENTRANCE|AFFAIRS|CLERK|SECURITY|"
    r"RECEPTION|TOILET|WC|GUIDANCE|CAREER|DIRECTOR|STORE|REPAIR|COMPUTER|UNIT|CAFETERIA)",
    re.I,
)


def detect_drawable_region(gray: np.ndarray, ow: int, oh: int) -> dict[str, float]:
    """
    Return percent region {x0,y0,x1,y1} for the floor plan drawing.
    Excludes bottom legend strip common on university floor JPGs.
    """
    y1 = 72.0

    # Detect horizontal separator: strong edge row in lower third
    if oh > 200:
        band_start = int(oh * 0.55)
        band = gray[band_start:, :]
        if band.size > 0:
            row_edge = np.mean(cv2.Sobel(band, cv2.CV_64F, 0, 1, ksize=3), axis=1)
            if row_edge.size > 10:
                peak_idx = int(np.argmax(row_edge))
                cut_y = band_start + peak_idx
                pct = cut_y / oh * 100
                if 58 <= pct <= 85:
                    y1 = round(pct, 1)

    return {"x0": 0.0, "y0": 0.0, "x1": 100.0, "y1": y1}


def legend_list_scan_floor(region: dict[str, float]) -> float:
    """Start scanning for numbered legend list (may sit slightly above drawable cut)."""
    return float(region.get("y1", 72)) - 6.0


def legend_strip_floor(region: dict[str, float]) -> float:
    """Strict footer below the floor plan drawing."""
    return float(region.get("y1", 72)) + 0.5


def is_in_legend_zone(py: float, region: dict[str, float]) -> bool:
    return py > legend_strip_floor(region)


def is_legend_list_text(px: float, py: float, region: dict[str, float]) -> bool:
    """Numbered list column at bottom of sign (not room markers on the drawing)."""
    return py > legend_list_scan_floor(region) and 20.0 < px < 55.0


def is_legend_number_column(px: float) -> bool:
    return px < 28.0


def normalize_room_label(text: str) -> str:
    t = re.sub(r"^\d{1,2}\s*[\.\):\-]\s*", "", text.strip())
    return re.sub(r"\s+", " ", t).strip().upper()


def filter_legend_placements(
    items: list[dict], region: dict[str, float], ocr_reader=None, img_work=None
) -> list[dict]:
    """Drop OCR hits in the legend/footer band; prefer labels without list numbering."""
    out: list[dict] = []
    for item in items:
        y = float(item.get("y", 0))
        label = str(item.get("label") or item.get("text") or "")
        raw = str(item.get("raw_text") or label)

        if is_in_legend_zone(y, region):
            continue

        if is_legend_list_text(float(item.get("x", 50)), y, region):
            continue

        # Legend list entries often at bottom even if y slightly above cut
        if (
            LEGEND_LINE.match(raw.strip())
            and y > region.get("y1", 72) - 8
            and item.get("source") != "legend-index"
            and item.get("legendNumber") is None
        ):
            continue

        cleaned = normalize_room_label(label)
        if cleaned and cleaned != label:
            item = {**item, "label": cleaned}
        out.append(item)
    return out


def parse_legend_numbered_rooms(raw_full: list, ow: int, oh: int, region: dict[str, float]) -> dict[int, str]:
    """Pair legend index (left column) with room name (right column) by row."""
    legend_rows: list[dict] = []
    for bbox, text, conf in raw_full:
        cx, cy = _bbox_center(bbox)
        px, py = _pct(cx, cy, ow, oh)
        if not is_in_legend_zone(py, region) and not is_legend_list_text(px, py, region):
            continue
        legend_rows.append({"px": px, "py": py, "text": str(text).strip(), "conf": float(conf)})

    numbers: list[dict] = []
    names: list[dict] = []
    for row in legend_rows:
        num_m = re.match(r"^(\d{1,2})\s*[\._]?\s*$", row["text"])
        if num_m and is_legend_number_column(row["px"]):
            numbers.append({**row, "num": int(num_m.group(1))})
        elif ROOM_NAME_HINT.search(row["text"]) and not is_legend_number_column(row["px"]):
            cleaned = normalize_room_label(row["text"])
            if cleaned:
                names.append({**row, "name": cleaned})

    mapping: dict[int, str] = {}
    for num_row in numbers:
        best_name: str | None = None
        best_dy = 999.0
        for name_row in names:
            dy = abs(num_row["py"] - name_row["py"])
            if dy < 3.0 and dy < best_dy:
                best_dy = dy
                best_name = name_row["name"]
        if best_name:
            mapping[num_row["num"]] = best_name

    for row in legend_rows:
        text = row["text"].strip()
        m = LEGEND_ENTRY.match(text)
        if not m:
            continue
        num_part = re.match(r"^(\d{1,2})", text)
        if not num_part:
            continue
        num = int(num_part.group(1))
        name = normalize_room_label(m.group(1))
        if name and num not in mapping:
            mapping[num] = name

    used_names = {v.upper() for v in mapping.values()}
    orphans = [n for n in names if n["name"].upper() not in used_names]
    orphans.sort(key=lambda x: x["py"])
    next_num = 1
    for orphan in orphans:
        while next_num in mapping:
            next_num += 1
        mapping[next_num] = orphan["name"]
        next_num += 1
    return mapping


def _parse_legend_numbered_rooms(raw_full: list, ow: int, oh: int, region: dict[str, float]) -> dict[int, str]:
    return parse_legend_numbered_rooms(raw_full, ow, oh, region)


def _find_map_index_positions_upscale(
    image_array,
    ow: int,
    oh: int,
    region: dict[str, float],
    reader=None,
) -> dict[int, tuple[float, float]]:
    """Read small index digits on the drawing via 2× upscaled ROI OCR."""
    y1_px = int(oh * float(region.get("y1", 72)) / 100)
    roi = image_array[0:y1_px, :]
    if roi.size == 0:
        return {}

    if reader is None:
        import easyocr

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    roi2 = cv2.resize(roi, None, fx=2, fy=2)
    raw = reader.readtext(roi2, paragraph=False, allowlist="0123456789")
    oh2, ow2 = roi2.shape[:2]
    positions: dict[int, tuple[float, float]] = {}
    scores: dict[int, float] = {}

    for bbox, text, conf in raw:
        digits = re.sub(r"\D", "", str(text).strip())
        if not digits or len(digits) > 2:
            continue
        num = int(digits)
        if num < 1 or num > 15:
            continue
        c = float(conf)
        if c < (0.18 if len(digits) == 1 else 0.45):
            continue
        cx, cy = _bbox_center(bbox)
        px = round(cx / ow2 * 100, 2)
        py = round((cy / oh2) * y1_px / oh * 100, 2)
        if _is_legend_index_digit(px, py, region):
            continue
        if py > float(region.get("y1", 72)) - 2:
            continue
        if scores.get(num, -1) <= c:
            scores[num] = c
            positions[num] = (px, py)
    return positions


def _find_map_index_positions_colored(
    image_array,
    ow: int,
    oh: int,
    region: dict[str, float],
    reader=None,
) -> dict[int, tuple[float, float]]:
    """Read index digits inside colored room zones on the drawing."""
    y1_px = int(oh * float(region.get("y1", 72)) / 100)
    roi = image_array[0:y1_px, :]
    if roi.size == 0:
        return {}

    if reader is None:
        import easyocr

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    masks = [
        cv2.inRange(hsv, np.array([35, 40, 40]), np.array([90, 255, 255])),
        cv2.inRange(hsv, np.array([90, 40, 40]), np.array([130, 255, 255])),
        cv2.inRange(hsv, np.array([5, 80, 80]), np.array([22, 255, 255])),
        cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 60, 255])),
    ]
    positions: dict[int, tuple[float, float]] = {}
    scores: dict[int, float] = {}
    lf = legend_strip_floor(region)

    for mask in masks:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:18]:
            area = cv2.contourArea(contour)
            if area < 400:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            crop = roi[max(0, y) : y + h, max(0, x) : x + w]
            if crop.size == 0:
                continue
            crop2 = cv2.resize(crop, None, fx=3, fy=3)
            for bbox, text, conf in reader.readtext(crop2, allowlist="0123456789", paragraph=False):
                t = str(text).strip()
                if not t.isdigit():
                    continue
                num = int(t)
                if num < 1 or num > 15:
                    continue
                c = float(conf)
                if c < 0.35:
                    continue
                cx, cy = _bbox_center(bbox)
                px = round((x + cx / 3) / ow * 100, 2)
                py = round((y + cy / 3) / oh * 100, 2)
                if _is_legend_index_digit(px, py, region):
                    continue
                if py > float(region.get("y1", 72)) - 1:
                    continue
                if scores.get(num, -1) <= c:
                    scores[num] = c
                    positions[num] = (px, py)
    return positions


def _is_legend_index_digit(px: float, py: float, region: dict[str, float]) -> bool:
    return is_legend_number_column(px) and py > legend_list_scan_floor(region)


def _merge_index_positions(*maps: dict[int, tuple[float, float]]) -> dict[int, tuple[float, float]]:
    merged: dict[int, tuple[float, float]] = {}
    for m in maps:
        for num, pos in m.items():
            merged[num] = pos
    return merged


def find_map_index_positions(
    raw_full: list,
    ow: int,
    oh: int,
    region: dict[str, float],
    image_array=None,
    reader=None,
) -> dict[int, tuple[float, float]]:
    """Room index bubbles on the floor plan drawing (not the legend list)."""
    positions: dict[int, tuple[float, float]] = {}
    y1 = float(region.get("y1", 72))
    for bbox, text, conf in raw_full:
        c = float(conf)
        num_m = re.match(r"^(\d{1,2})\s*[\._]?\s*$", str(text).strip())
        if not num_m:
            continue
        if c < (0.25 if len(num_m.group(1)) == 1 else 0.45):
            continue
        cx, cy = _bbox_center(bbox)
        px, py = _pct(cx, cy, ow, oh)
        if _is_legend_index_digit(px, py, region):
            continue
        if is_in_legend_zone(py, region) and is_legend_number_column(px):
            continue
        if py > y1 - 2 or py < 8:
            continue
        num = int(num_m.group(1))
        positions[num] = (px, py)

    if image_array is not None:
        positions = _merge_index_positions(
            positions,
            _find_map_index_positions_upscale(image_array, ow, oh, region, reader=reader),
            _find_map_index_positions_colored(image_array, ow, oh, region, reader=reader),
        )
        cleaned: dict[int, tuple[float, float]] = {}
        for num, (px, py) in positions.items():
            if _is_legend_index_digit(px, py, region):
                continue
            cleaned[num] = (px, py)
        positions = cleaned
    return positions


def _find_map_index_positions(raw_full: list, ow: int, oh: int, region: dict[str, float]) -> dict[int, tuple[float, float]]:
    return find_map_index_positions(raw_full, ow, oh, region)


def apply_legend_numbers(detections: list[dict], legend_map: dict[int, str]) -> list[dict]:
    reverse = {name.upper(): num for num, name in legend_map.items()}
    out: list[dict] = []
    for item in detections:
        row = dict(item)
        if row.get("legendNumber") is None:
            key = str(row.get("label", "")).upper()
            if key in reverse:
                row["legendNumber"] = reverse[key]
        out.append(row)
    return out


def place_legend_rooms_by_index(
    raw_full: list,
    ow: int,
    oh: int,
    region: dict[str, float],
    existing_labels: set[str],
    image_array=None,
    reader=None,
) -> list[dict]:
    """Place legend-only rooms using numbered index markers on the map drawing."""
    legend_map = parse_legend_numbered_rooms(raw_full, ow, oh, region)
    map_positions = find_map_index_positions(
        raw_full, ow, oh, region, image_array=image_array, reader=reader
    )
    if not legend_map or not map_positions:
        return []

    out: list[dict] = []
    for num, name in sorted(legend_map.items()):
        key = name.upper()
        if key in existing_labels:
            continue
        pos = map_positions.get(num)
        if not pos:
            continue
        px, py = pos
        out.append(
            {
                "label": name,
                "x": px,
                "y": py,
                "confidence": 0.72,
                "raw_text": f"{num}. {name}",
                "type": "ENTRANCE" if re.search(r"ENTRANCE|LOBBY", name, re.I) else "ROOM",
                "source": "legend-index",
                "legendNumber": num,
            }
        )
        existing_labels.add(key)
    return out


def _bbox_center(bbox: list) -> tuple[float, float]:
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _pct(cx: float, cy: float, ow: int, oh: int) -> tuple[float, float]:
    return round(cx / ow * 100, 2), round(cy / oh * 100, 2)


def extract_legend_room_names(raw_legend: list) -> list[str]:
    """Parse numbered legend list at bottom of floor plan (e.g. '12. ELECTRICAL ROOM')."""
    names: list[str] = []
    seen: set[str] = set()
    for bbox, text, conf in raw_legend:
        if float(conf) < 0.18:
            continue
        t = str(text).strip()
        m = LEGEND_ENTRY.match(t)
        candidate = normalize_room_label(m.group(1)) if m else normalize_room_label(t)
        if not candidate or len(candidate) < 3:
            continue
        if not ROOM_NAME_HINT.search(candidate):
            continue
        key = candidate.upper()
        if key not in seen:
            seen.add(key)
            names.append(candidate)
    return names


def _labels_conflict(a: str, b: str) -> bool:
    au, bu = a.upper(), b.upper()
    pairs = [("ELECTRICAL", "ELV"), ("ELV", "ELECTRICAL")]
    for x, y in pairs:
        if x in au and y in bu and x not in bu:
            return True
        if x in bu and y in au and x not in au:
            return True
    return False


def _match_legend_name_on_map(
    legend_name: str,
    raw_map: list,
    ow: int,
    oh: int,
    region: dict[str, float],
    max_gap_px: float,
) -> dict | None:
    """Find map-zone OCR group whose text matches a legend room name."""
    target = legend_name.upper()
    target_tokens = [t for t in re.split(r"\s+", target) if len(t) >= 3]

    items: list[dict] = []
    for bbox, text, conf in raw_map:
        if float(conf) < 0.18:
            continue
        cx, cy = _bbox_center(bbox)
        px, py = _pct(cx, cy, ow, oh)
        if is_in_legend_zone(py, region):
            continue
        items.append({"text": str(text).strip(), "cx": cx, "cy": cy, "conf": float(conf), "px": px, "py": py})

    if not items:
        return None

    items.sort(key=lambda d: (d["cy"], d["cx"]))
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
            if abs(a["cy"] - b["cy"]) > max_gap_px * 0.8:
                continue
            if abs(a["cx"] - b["cx"]) > max_gap_px * 3:
                continue
            if _labels_conflict(a["text"], b["text"]):
                continue
            group.append(b)
            used[j] = True

        combined = normalize_room_label(" ".join(g["text"] for g in group))
        if not combined:
            continue
        if combined.upper() == target:
            cx = sum(g["cx"] for g in group) / len(group)
            cy = sum(g["cy"] for g in group) / len(group)
            px, py = _pct(cx, cy, ow, oh)
            return {
                "label": combined,
                "x": px,
                "y": py,
                "confidence": round(max(g["conf"] for g in group), 3),
                "raw_text": " ".join(g["text"] for g in group),
                "type": "ROOM",
                "source": "legend-map-match",
            }

        if target_tokens and all(t in combined.upper() for t in target_tokens):
            cx = sum(g["cx"] for g in group) / len(group)
            cy = sum(g["cy"] for g in group) / len(group)
            px, py = _pct(cx, cy, ow, oh)
            return {
                "label": target if target.endswith("ROOM") or "ROOM" in target else combined,
                "x": px,
                "y": py,
                "confidence": round(max(g["conf"] for g in group) * 0.92, 3),
                "raw_text": combined,
                "type": "ROOM",
                "source": "legend-map-match",
            }

    return None


def enrich_rooms_from_legend(
    detections: list[dict],
    legend_names: list[str],
    raw_map: list,
    ow: int,
    oh: int,
    region: dict[str, float],
    legend_map: dict[int, str] | None = None,
) -> list[dict]:
    """Add map-zone room markers for legend entries missing from OCR detections."""
    if not legend_names:
        return detections

    reverse = {v.upper(): k for k, v in (legend_map or {}).items()}
    existing = {str(d.get("label", "")).upper() for d in detections}
    out = list(detections)
    max_gap = ow * 0.04

    for name in legend_names:
        key = name.upper()
        if key in existing:
            continue

        hit = _match_legend_name_on_map(name, raw_map, ow, oh, region, max_gap)
        if hit:
            num = reverse.get(key)
            if num is not None:
                hit = {**hit, "legendNumber": num}
            out.append(hit)
            existing.add(hit["label"].upper())

    return out

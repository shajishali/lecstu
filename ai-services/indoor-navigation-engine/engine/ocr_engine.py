"""
OCR Engine — EasyOCR default (reliable install). PaddleOCR optional via NAV_USE_PADDLE=true.
"""
from __future__ import annotations

import os
import re
from typing import Any

from engine.logging_config import setup_logging

logger = setup_logging("ocr-engine")

USE_PADDLE = os.environ.get("NAV_USE_PADDLE", "false").lower() == "true"

_paddle_ocr = None
_easy_reader = None
_engine_name = "none"

ROOM_HINT = re.compile(
    r"(ROOM|ELV|ELECTRICAL|LAB|OFFICE|HALL|SEMINAR|CAFETERIA|MEETING|WAITING|LOBBY|"
    r"ENTRANCE|RECEPTION|AFFAIRS|CORRIDOR|STAIR|LIFT|TOILET|WC|CLERK|SECURITY|"
    r"GUIDANCE|CAREER|DIRECTOR|STORE|REPAIR|COMPUTER)",
    re.I,
)


def _get_paddle():
    global _paddle_ocr, _engine_name
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR

        logger.info("Loading PaddleOCR...")
        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        _engine_name = "paddleocr"
    return _paddle_ocr


def _get_easyocr():
    global _easy_reader, _engine_name
    if _easy_reader is None:
        import easyocr

        logger.info("Loading EasyOCR fallback...")
        _easy_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        if _engine_name == "none":
            _engine_name = "easyocr"
    return _easy_reader


def get_ocr_engine_name() -> str:
    return _engine_name


def _bbox_center(bbox: list) -> tuple[float, float]:
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _pct(cx: float, cy: float, ow: int, oh: int) -> tuple[float, float]:
    return round(cx / ow * 100, 2), round(cy / oh * 100, 2)


def _normalize_label(text: str) -> str | None:
    t = re.sub(r"\s+", " ", text.strip().upper())
    if len(t) < 3 or re.fullmatch(r"\d{1,3}", t):
        return None
    if t == "ELV":
        return "ELV ROOM"
    if t in ("ENTRY", "ENTR"):
        return "ENTRANCE"
    return t


def _is_room_like(text: str) -> bool:
    t = text.strip()
    if len(t) < 2:
        return False
    return bool(ROOM_HINT.search(t) or re.search(r"entrance|entry|reception", t, re.I))


def _run_paddle(image_path: str) -> list[tuple[list, str, float]]:
    ocr = _get_paddle()
    result = ocr.ocr(image_path, cls=True)
    out: list[tuple[list, str, float]] = []
    if not result:
        return out
    for line in result[0] or []:
        if not line or len(line) < 2:
            continue
        bbox, (text, conf) = line[0], line[1]
        out.append((bbox, text, float(conf)))
    return out


def _run_easyocr(image_array) -> list[tuple[list, str, float]]:
    reader = _get_easyocr()
    raw = reader.readtext(image_array, paragraph=False)
    return [(bbox, text, float(conf)) for bbox, text, conf in raw]


def run_ocr(
    image_path: str,
    image_array=None,
    drawable_region: dict | None = None,
) -> dict[str, Any]:
    """
    Run OCR on floor plan image. Returns detections with percent coordinates.
    """
    import cv2

    if image_array is None:
        image_array = cv2.imread(image_path)
    if image_array is None:
        raise ValueError(f"Cannot read image: {image_path}")

    oh, ow = image_array.shape[:2]
    region = drawable_region or {"x0": 0, "y0": 0, "x1": 100, "y1": 72}
    y_cut = int(oh * float(region.get("y1", 72)) / 100)
    y_cut = max(int(oh * 0.5), min(y_cut, int(oh * 0.88)))

    raw_full: list[tuple[list, str, float]] = []

    if USE_PADDLE:
        try:
            import tempfile
            import os

            fd, tmp = tempfile.mkstemp(suffix=".jpg")
            os.close(fd)
            cv2.imwrite(tmp, image_array)
            raw_full = _run_paddle(tmp)
            os.unlink(tmp)
        except Exception as e:
            logger.warning("PaddleOCR failed, falling back to EasyOCR: %s", e)
            raw_full = _run_easyocr(image_array)
    else:
        raw_full = _run_easyocr(image_array)

    from engine.map_region import (
        apply_legend_numbers,
        enrich_rooms_from_legend,
        extract_legend_room_names,
        filter_legend_placements,
        is_in_legend_zone,
        is_legend_list_text,
        legend_list_scan_floor,
        normalize_room_label,
        parse_legend_numbered_rooms,
        place_legend_rooms_by_index,
    )

    raw: list[tuple[list, str, float]] = []
    for bbox, text, conf in raw_full:
        cx, cy = _bbox_center(bbox)
        px, py = _pct(cx, cy, ow, oh)
        if is_in_legend_zone(py, region) or is_legend_list_text(px, py, region):
            continue
        raw.append((bbox, text, conf))

    detections: list[dict[str, Any]] = []
    for bbox, text, conf in raw:
        if conf < 0.25 or not _is_room_like(text):
            continue
        label = _normalize_label(text) or normalize_room_label(text)
        if not label:
            continue
        cx, cy = _bbox_center(bbox)
        px, py = _pct(cx, cy, ow, oh)
        detections.append(
            {
                "label": label,
                "x": px,
                "y": py,
                "confidence": round(conf, 3),
                "raw_text": text.strip(),
                "type": "ENTRANCE"
                if re.search(r"entrance|entry|reception", label, re.I)
                else "ROOM",
            }
        )

    detections = filter_legend_placements(detections, region)

    legend_raw = []
    for bbox, text, conf in raw_full:
        cx, cy = _bbox_center(bbox)
        _, py = _pct(cx, cy, ow, oh)
        if is_in_legend_zone(py, region):
            legend_raw.append((bbox, text, conf))
    legend_map = parse_legend_numbered_rooms(raw_full, ow, oh, region)
    legend_names = list(legend_map.values()) or extract_legend_room_names(legend_raw)
    reader = _get_easyocr()
    try:
        detections = enrich_rooms_from_legend(
            detections, legend_names, raw, ow, oh, region, legend_map=legend_map
        )
        detections = apply_legend_numbers(detections, legend_map)
        existing = {str(d.get("label", "")).upper() for d in detections}
        detections.extend(
            place_legend_rooms_by_index(
                raw_full, ow, oh, region, existing, image_array=image_array, reader=reader
            )
        )
        detections = apply_legend_numbers(detections, legend_map)
        detections = filter_legend_placements(detections, region)
    except Exception as e:
        logger.warning("Legend OCR enrichment skipped: %s", e)

    return {
        "detections": detections,
        "ocr_count": len(raw),
        "legend_room_names": legend_names,
        "legend_map": legend_map,
        "engine": get_ocr_engine_name(),
        "image_width": ow,
        "image_height": oh,
    }

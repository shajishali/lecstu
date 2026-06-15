"""Detect architectural drawing region vs legend/footer on floor plan images."""
from __future__ import annotations

import re

import cv2
import numpy as np

LEGEND_LINE = re.compile(r"^\d{1,2}\s*[\.\):\-]\s*\S", re.I)


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


def is_in_legend_zone(py: float, region: dict[str, float]) -> bool:
    return py > region.get("y1", 72) + 1.5


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

        # Legend list entries often at bottom even if y slightly above cut
        if LEGEND_LINE.match(raw.strip()) and y > region.get("y1", 72) - 8:
            continue

        cleaned = normalize_room_label(label)
        if cleaned and cleaned != label:
            item = {**item, "label": cleaned}
        out.append(item)
    return out

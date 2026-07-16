#!/usr/bin/env python3
"""Extract Word thesis to markdown body (paragraphs + tables)."""
from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

DOCX = Path(r"c:\Users\Saji\Desktop\thesis of the Research\CSCI 43018-Final Thesis of Shakiththiyan-2026.docx")
OUT_BODY = Path(__file__).resolve().parents[1] / "reports" / "word_thesis_body.md"

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def para_text(p: ET.Element) -> str:
    parts: list[str] = []
    for t in p.iter(f"{W_NS}t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts).strip()


def is_heading(p: ET.Element) -> tuple[int, str] | None:
    ppr = p.find(f"{W_NS}pPr")
    if ppr is None:
        return None
    style = ppr.find(f"{W_NS}pStyle")
    if style is None:
        return None
    val = style.get(f"{W_NS}val", "")
    m = re.match(r"Heading(\d+)", val or "", re.I)
    if m:
        return int(m.group(1)), para_text(p)
    if val and "heading" in val.lower():
        return 2, para_text(p)
    return None


def table_to_md(tbl: ET.Element) -> str:
    rows: list[list[str]] = []
    for tr in tbl.findall(f".//{W_NS}tr"):
        cells: list[str] = []
        for tc in tr.findall(f"{W_NS}tc"):
            cell_parts: list[str] = []
            for p in tc.findall(f".//{W_NS}p"):
                t = para_text(p)
                if t:
                    cell_parts.append(t)
            cells.append(" ".join(cell_parts).replace("|", "\\|").replace("\n", " "))
        if any(c.strip() for c in cells):
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    norm = [r + [""] * (width - len(r)) for r in rows]
    lines = [
        "| " + " | ".join(norm[0]) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    for r in norm[1:]:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


def extract_docx(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find(f"{W_NS}body")
    if body is None:
        return []

    lines: list[str] = []
    skip_until_chapter = True
    started = False

    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = para_text(child)
            if not text:
                continue
            # Start at Declaration (skip title page duplicate noise)
            if not started:
                if text.strip().lower() == "declaration":
                    started = True
                    lines.append("# Declaration")
                    continue
                continue
            h = is_heading(child)
            if h:
                level, ht = h
                if not ht:
                    continue
                hashes = "#" * min(level + 1, 6)
                lines.append(f"{hashes} {ht}")
            else:
                # Heuristic chapter headings in Word body text
                if re.match(r"^Chapter \d+", text):
                    lines.append(f"# {text}")
                elif re.match(r"^\d+\.\d+(\.\d+)? ", text) and len(text) < 120:
                    depth = text.count(".") + 1
                    hashes = "#" * min(depth + 1, 6)
                    lines.append(f"{hashes} {text}")
                else:
                    lines.append(text)
        elif tag == "tbl":
            md = table_to_md(child)
            if md:
                lines.append("")
                lines.append(md)
                lines.append("")

    return lines


def main() -> None:
    lines = extract_docx(DOCX)
    OUT_BODY.write_text("\n\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(lines)} blocks to {OUT_BODY}")


if __name__ == "__main__":
    main()

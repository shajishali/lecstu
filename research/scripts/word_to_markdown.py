#!/usr/bin/env python3
"""Convert Word thesis docx to markdown matching document order."""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

DOCX = Path(r"c:\Users\Saji\Desktop\thesis of the Research\CSCI 43018-Final Thesis of Shakiththiyan-2026.docx")
OUT = Path(__file__).resolve().parents[1] / "reports" / "word_thesis_synced.md"

SKIP_HEADINGS = {
    "table of contents",
    "contents",
    "list of tables",
    "list of figures",
}

STOP_SKIP = {"abbreviations", "chapter 1", "introduction"}


def iter_block_items(parent):
    from docx.document import Document as DocType
    from docx.oxml.text.paragraph import CT_P
    from docx.oxml.table import CT_Tbl

    if isinstance(parent, DocType):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._tc
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def heading_level(style_name: str) -> int | None:
    if not style_name:
        return None
    s = style_name.lower()
    if "heading 1" in s or s == "phd preliminary heading":
        return 1
    if "heading 2" in s:
        return 2
    if "heading 3" in s:
        return 3
    if "heading 4" in s:
        return 4
    if "heading 5" in s:
        return 5
    return None


def is_section_heading(text: str) -> int | None:
    t = text.strip()
    if re.match(r"^Chapter \d+", t, re.I):
        return 1
    m = re.match(r"^(\d+\.\d+(?:\.\d+)?)\s+(.+)$", t)
    if m and len(t) < 100:
        depth = m.group(1).count(".") + 1
        return min(depth + 1, 5)
    return None


def table_md(table: Table) -> str:
    rows: list[list[str]] = []
    for row in table.rows:
        cells = []
        for cell in row.cells:
            txt = "\n".join(p.text.strip() for p in cell.paragraphs if p.text.strip())
            txt = txt.replace("|", "\\|").replace("\n", " ")
            cells.append(txt)
        if any(c.strip() for c in cells):
            rows.append(cells)
    if not rows:
        return ""
    w = max(len(r) for r in rows)
    rows = [r + [""] * (w - len(r)) for r in rows]
    out = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join(["---"] * w) + " |"]
    for r in rows[1:]:
        out.append("| " + " | ".join(r) + " |")
    return "\n".join(out)


def convert() -> str:
    doc = Document(DOCX)
    lines: list[str] = []
    started = False
    skipping_front = False

    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if not text:
                continue
            low = text.lower().strip()

            if not started:
                if low == "declaration":
                    started = True
                    lines.append("# Declaration")
                continue

            # skip auto TOC blocks
            if skipping_front:
                if any(low.startswith(x) for x in STOP_SKIP) or low == "abbreviations":
                    skipping_front = False
                else:
                    continue

            style = block.style.name if block.style else ""
            hl = heading_level(style)
            if hl and low in SKIP_HEADINGS:
                skipping_front = True
                continue

            if hl:
                lines.append(f"{'#' * (hl + 1)} {text}")
                continue

            sh = is_section_heading(text)
            if sh and not text.startswith("#"):
                # avoid code lines
                if not text.startswith("def ") and "import " not in text[:20]:
                    lines.append(f"{'#' * (sh + 1)} {text}")
                    continue

            lines.append(text)

        else:
            md = table_md(block)
            if md:
                lines.extend(["", md, ""])

    return "\n\n".join(lines)


def main() -> None:
    body = convert()
    OUT.write_text(body, encoding="utf-8")
    print(f"Wrote {OUT} ({len(body)} chars)")


if __name__ == "__main__":
    main()

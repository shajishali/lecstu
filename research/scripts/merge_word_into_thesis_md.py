#!/usr/bin/env python3
"""Merge Word-extracted body into thesisWriting.md (title page + sync note + Word text)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THESIS = ROOT / "thesisWriting.md"
WORD_BODY = ROOT / "research" / "reports" / "word_thesis_synced.md"
USABILITY_PASTE = ROOT / "research" / "reports" / "usability_paste_into_word.md"

TITLE_PAGE = """# Smart Faculty Access and Student Assistant System (LECSTU)

## Design and Evaluation of an AI-Integrated Academic Platform for University Environments

**Pirabakaran Shakiththiyan**  
**Student Registration Number: CS/2020/063**

Prepared under the supervision of  
**Mr. Kesavan Selvarajah**

Submitted in partial fulfilment of the requirements for the  
**Bachelor of Science Honours in Computer Science Degree**

Faculty of Computing and Technology  
University of Kelaniya  
Academic Year 2023/2024

---

# SYNC NOTE — This file matches your Word thesis

**Source:** `CSCI 43018-Final Thesis of Shakiththiyan-2026.docx` (synced 10 July 2026)  
**Regenerate:** `python research/scripts/word_to_markdown.py` then `python research/scripts/merge_word_into_thesis_md.py`

Everything below **Declaration** is extracted from your Word document **exactly** (paragraphs and tables).

**Word sections that still need usability updates** (real *n* = 11 data — paste from `research/reports/usability_paste_into_word.md`):

| Section | Word still shows |
|---|---|
| Abstract | Duplicate paragraph without SUS — delete shorter one |
| §3.7.4 Study status | “sessions had not been completed” |
| §4.7 | All N/A / 0 tables |
| §4.8, §5.5–5.7, §6.2–6.3, §7.4 R-16, §7.6 | Old “incomplete / not achieved” wording |
| Table 2.1 LECSTU row | “usability study incomplete” |
| §1.9 | “six chapters” (TOC has seven) |

**Already correct in Word:** Acknowledgement, Abstract (SUS paragraph), §1.7 closing.

---
"""

# Extract usability paste block from previous thesisWriting if exists
USABILITY_START = "## 4.7 Usability Results"
USABILITY_END = "## 4.8 Chapter Summary"


def extract_usability_paste(old: str) -> str:
    if USABILITY_START not in old:
        return ""
    start = old.index(USABILITY_START)
    end = old.index(USABILITY_END, start)
    block = old[start:end].strip()
    # strip WORD markers lines
    lines = [ln for ln in block.splitlines() if not ln.strip().startswith("> **WORD:")]
    header = """# Paste into Word — usability sections (*n* = 11 real data)

Replace §4.7 in Word with this section. Then update §4.8, §5.5–5.7, §6.2–6.3, §7 per `usability_study_report.md`.

---

"""
    return header + "\n".join(lines) + "\n\n"


def main() -> None:
    old = THESIS.read_text(encoding="utf-8") if THESIS.exists() else ""
    usability = extract_usability_paste(old)
    if usability:
        USABILITY_PASTE.write_text(usability, encoding="utf-8")
        print(f"Wrote {USABILITY_PASTE}")

    body = WORD_BODY.read_text(encoding="utf-8")
    THESIS.write_text(TITLE_PAGE + body, encoding="utf-8")
    print(f"Wrote {THESIS} ({THESIS.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

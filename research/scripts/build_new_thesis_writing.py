#!/usr/bin/env python3
"""Build newThesisWriting.md — title page + Word body only (no usability guide)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORD_BODY = ROOT / "research" / "reports" / "word_thesis_synced.md"
OUT = ROOT / "newThesisWriting.md"

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

**Mirror of:** `CSCI 43018-Final Thesis of Shakiththiyan-2026.docx`  
**Regenerate:** `python research/scripts/word_to_markdown.py` then `python research/scripts/build_new_thesis_writing.py`

Everything below is extracted from Word **exactly** (no usability edits, no change logs).

---

"""

def main() -> None:
    body = WORD_BODY.read_text(encoding="utf-8")
    OUT.write_text(TITLE_PAGE + body, encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

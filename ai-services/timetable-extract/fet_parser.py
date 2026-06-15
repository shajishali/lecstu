"""
FET faculty timetable PDF extractor using pdfplumber (position-aware).
Extracts per day: time range, course name, lecturer, hall, student group.
Falls back to Node pdf-parse when pdfplumber yields too few rows.
"""
from __future__ import annotations

import io
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import pdfplumber

DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
TIME_RE = re.compile(r"^(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})")
COURSE_RE = re.compile(
    r"([A-Z]{2,6}\s*\d{4,5}(?:\s*[TtPp](?:\s*[TtPp])?)?(?:\s*\+\s*[A-Z]{2,6}\s*\d{4,5})*)",
    re.I,
)
ROOM_RE = re.compile(
    r"\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+|[A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2})\b",
    re.I,
)
PATHWAY_CODES = (
    "AINT", "DSCI", "CSEC", "SPCS", "GANI", "SWST", "CTNT",
    "ETIA", "ETMP", "ETST",
)
GROUP_HEADER_RE = re.compile(
    r"^(Y\d+\s+.+Group|Y\d+\s+(?:CS|ET|CT|BS|BST)\s*\d*\s*Group|Y\d+\s+(?:CS|ET|CT|BS|BST)\b|Y\d+\s+(?:"
    + "|".join(PATHWAY_CODES)
    + r")\b|Y\d+\s+.+,\s*Y\d+)",
    re.I,
)
YEAR_LABEL_RE = re.compile(r"^Y\d+\s", re.I)
EMPTY_CELL = re.compile(r"^(-{1,3}|x|-X-)$", re.I)


@dataclass
class SlotRow:
    year: int
    month: int
    week: int
    dayOfWeek: str
    startTime: str
    endTime: str
    courseCode: str
    courseName: str
    lecturerName: str
    lecturerEmail: str
    hallName: str
    groupName: str
    semester: int = 1


def _norm_time(h: str, m: str) -> str:
    return f"{int(h):02d}:{m}"


def _parse_time_line(text: str) -> tuple[str, str] | None:
    m = TIME_RE.match(text.strip())
    if not m:
        return None
    return _norm_time(m.group(1), m.group(2)), _norm_time(m.group(3), m.group(4))


_PATHWAY_TYPO = {"FTIA": "ETIA", "FTMP": "ETMP", "FTST": "ETST"}


def _canonical_group(raw: str) -> str:
    t = raw.strip()
    direct = re.match(r"^(CS|ET|CT|BS|FT)-Y([1-4])(?:-([A-Z0-9]+))?$", t, re.I)
    if direct:
        prog = "ET" if direct.group(1).upper() == "FT" else direct.group(1).upper()
        yr = direct.group(2)
        pw = direct.group(3)
        if pw:
            up = pw.upper()
            up = _PATHWAY_TYPO.get(up, up)
            return f"{prog}-Y{yr}-{up}"
        return f"{prog}-Y{yr}"

    m = re.match(r"^Y([1-4])\s+(CS|ET|CT|BS|BST)\s*\d*\s*Group\b", t, re.I)
    if m:
        code = "BS" if m.group(2).upper() == "BST" else m.group(2).upper()
        return f"{code}-Y{m.group(1)}"

    m = re.match(r"^Y([1-4])\s+(CS|ET|CT|BS|BST)\b", t, re.I)
    if m:
        code = "BS" if m.group(2).upper() == "BST" else m.group(2).upper()
        return f"{code}-Y{m.group(1)}"

    m = re.match(r"^Y([1-4])\s+([A-Z]{2,6})\b", t, re.I)
    if m:
        pw = _PATHWAY_TYPO.get(m.group(2).upper(), m.group(2).upper())
        prog_map = {
            "AINT": "CS", "DSCI": "CS", "CSEC": "CS", "SPCS": "CS",
            "GANI": "CT", "SWST": "CT", "CTNT": "CT",
            "ETIA": "ET", "ETMP": "ET", "ETST": "ET",
        }
        prog = prog_map.get(pw, "CS")
        return f"{prog}-Y{m.group(1)}-{pw}"
    return t


def _short_course_name(course: str, code: str) -> str:
    c = course.strip()
    if c and len(c) <= 48:
        return c
    return code.replace("-", " ")


def _is_year_label(line: str) -> bool:
    t = line.strip()
    if not t or EMPTY_CELL.match(t):
        return False
    if YEAR_LABEL_RE.match(t) and not COURSE_RE.search(t):
        return True
    return False


def _parse_cell_lines(lines: list[str], section_group: str) -> dict[str, Any] | None:
    useful = [ln.strip() for ln in lines if ln.strip() and not EMPTY_CELL.match(ln.strip())]
    if not useful:
        return None

    group = _canonical_group(section_group)
    for ln in useful:
        if _is_year_label(ln):
            g = _canonical_group(ln.split(",")[0].strip())
            if g and g != ln:
                group = g
            elif re.match(r"^Y\d+\s+[A-Z]", ln, re.I):
                group = _canonical_group(ln)

    course_text = " ".join(
        ln for ln in useful
        if not extract_room(ln) and not _is_year_label(ln) and not _looks_lecturer(ln)
    )
    course = None
    cm = COURSE_RE.search(course_text)
    if cm:
        course = cm.group(1).strip()
    else:
        for ln in useful:
            cm2 = COURSE_RE.search(ln)
            if cm2:
                course = cm2.group(1).strip()
                break
    if not course:
        return None

    hall = None
    for ln in useful:
        hall = extract_room(ln)
        if hall:
            break

    lecturer = ""
    for ln in useful:
        if _looks_lecturer(ln):
            lecturer = ln.strip()
            break

    suffix_codes = _extract_lecturer_codes_from_course(course)
    if not lecturer and suffix_codes:
        lecturer = " ".join(suffix_codes)

    code = re.sub(r"\s+", "-", course.upper())[:40]
    return {
        "courseCode": code,
        "courseName": _short_course_name(course, code),
        "lecturerName": lecturer,
        "hallName": hall or "TBD",
        "groupName": group,
    }


def extract_room(text: str) -> str | None:
    m = ROOM_RE.search(text)
    if m:
        return m.group(1)
    if "language lab" in text.lower():
        return text.strip()
    return None


def _extract_lecturer_codes_from_course(course: str) -> list[str]:
    m = re.search(r"\b\d{4,5}\s+([A-Za-z](?:\s+[A-Za-z]){0,2})\s*$", course.strip())
    if not m:
        return []
    suffix = m.group(1).strip()
    if "_" in suffix or re.search(r"\d", suffix):
        return []
    return [c.upper() for c in suffix.split()]


def _looks_lecturer(line: str) -> bool:
    t = line.strip()
    if COURSE_RE.search(t) or extract_room(t) or _is_year_label(t):
        return False
    if len(t) <= 3 and re.match(r"^[A-Za-z+.&,]+$", t) and not re.search(r"\d", t):
        return True
    if re.match(r"^(Dr\.|Prof\.|Mr\.|Ms\.)\s+", t, re.I):
        return True
    return False


def _cluster_columns(words: list[dict], page_width: float) -> list[float]:
    """Return x-centers for time + day columns."""
    xs = sorted(w["x0"] for w in words if w["text"].strip())
    if not xs:
        return []
    # Time column is left ~12% of page
    time_max = page_width * 0.14
    day_words = [w for w in words if w["x0"] > time_max]
    if not day_words:
        return []

    bins: list[list[float]] = []
    for w in sorted(day_words, key=lambda x: x["x0"]):
        x = (w["x0"] + w["x1"]) / 2
        if not bins or x - bins[-1][-1] > 25:
            bins.append([x])
        else:
            bins[-1].append(x)
    centers = [sum(b) / len(b) for b in bins if len(b) > 2]
    # Keep up to 6 day columns
    if len(centers) > 6:
        centers = centers[:6]
    return centers


def _words_in_cell(words: list[dict], x0: float, x1: float, y0: float, y1: float) -> list[str]:
    cell_words = [
        w for w in words
        if w["top"] >= y0 - 2 and w["bottom"] <= y1 + 2
        and (w["x0"] + w["x1"]) / 2 >= x0 and (w["x0"] + w["x1"]) / 2 < x1
    ]
    cell_words.sort(key=lambda w: (w["top"], w["x0"]))
    lines: list[str] = []
    current_y: float | None = None
    buf: list[str] = []
    for w in cell_words:
        if current_y is None:
            current_y = w["top"]
        if abs(w["top"] - current_y) > 4 and buf:
            lines.append(" ".join(buf))
            buf = [w["text"]]
            current_y = w["top"]
        else:
            buf.append(w["text"])
    if buf:
        lines.append(" ".join(buf))
    return [ln.strip() for ln in lines if ln.strip()]


def _extract_semester(filename: str, page_text: str) -> int:
    blob = f"{filename} {page_text}"
    if re.search(r"sem(?:ester)?[\s_-]*ii", blob, re.I):
        return 2
    return 1


def _extract_period(page_text: str) -> tuple[int, int]:
    m = re.search(r"\bon\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})", page_text, re.I)
    if not m:
        return 2026, 1
    first, second, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if yr < 100:
        yr += 2000
    month = second if first <= 12 else first
    return yr, max(1, min(12, month))


def _normalize_fet_dash_lines(lines: list[str]) -> list[str]:
    """FET pdfplumber text uses '---' between day columns; convert to tab-separated."""
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if "---" in stripped:
            head = re.split(r"\s*---\s*", stripped, maxsplit=1)[0]
            if TIME_RE.match(head.strip()):
                parts = [p.strip() for p in re.split(r"\s*---\s*", stripped)]
                out.append("\t".join(parts))
                continue
        out.append(line)
    return out


def _page_to_tab_lines(page) -> list[str]:
    """Rebuild FET rows with tab-separated day columns (like pdf-parse cellThreshold)."""
    words = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
    if not words:
        return [ln for ln in (page.extract_text() or "").splitlines() if ln.strip()]

    day_x: list[tuple[float, int]] = []
    for w in words:
        t = w["text"].strip().lower()
        if t in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday"):
            day_x.append(((w["x0"] + w["x1"]) / 2, DAYS.index(t.upper())))

    day_x.sort(key=lambda x: x[0])
    col_starts: list[float] = []
    if len(day_x) >= 4:
        time_end = page.width * 0.12
        col_starts = [time_end] + [x[0] - 8 for x in day_x[:6]]
    else:
        col_starts = [page.width * 0.12]

    def col_index(cx: float) -> int:
        idx = 0
        for i in range(len(col_starts) - 1, -1, -1):
            if cx >= col_starts[i] - 4:
                return i
        return 0

    by_y: dict[int, list] = {}
    for w in words:
        by_y.setdefault(int(round(w["top"] / 4)), []).append(w)

    out: list[str] = []
    for key in sorted(by_y):
        line_words = sorted(by_y[key], key=lambda x: x["x0"])
        if len(col_starts) >= 2:
            cols: list[list[str]] = [[] for _ in range(min(7, len(col_starts) + 1))]
            for w in line_words:
                ci = col_index((w["x0"] + w["x1"]) / 2)
                if ci >= len(cols):
                    cols.append([])
                cols[ci].append(w["text"])
            out.append("\t".join(" ".join(c).strip() for c in cols))
        else:
            out.append(" ".join(w["text"] for w in line_words))
    return out


def _parse_time_range(text: str) -> tuple[str, str] | None:
    return _parse_time_line(text.split("\t")[0].strip())


def _is_fet_time_line(line: str) -> bool:
    return bool(TIME_RE.match(line.strip().split("\t")[0].strip()))


def _is_fet_section_header(line: str) -> bool:
    """Section title for a class group (sets current_group)."""
    t = line.strip()
    if "Monday" in t and "Tuesday" in t:
        return False
    if GROUP_HEADER_RE.match(t):
        return True
    return bool(re.match(r"^Y\d+\s+(CS|ET|CT|BS|BST)\s*$", t, re.I))


def _is_fet_block_end(line: str) -> bool:
    """Ends a time-slot continuation block — not the same as section headers like 'Y3 AINT'."""
    t = line.strip()
    if _is_fet_time_line(t):
        return True
    if re.match(r"^Y\d+\s+.+Group$", t, re.I):
        return True
    if re.match(r"^Y\d+\s+(CS|ET|CT|BS|BST)\s*\d*\s*Group$", t, re.I):
        return True
    if bool(re.search(r"Timetable generated with FET", t, re.I)):
        return True
    if bool(re.search(r"^Faculty of Computing", t, re.I)):
        return True
    if bool(re.search(r"^--\s*\d+\s+of\s+\d+\s*--", t, re.I)):
        return True
    return False


def _content_lines_from_block(block: list[str]) -> list[str]:
    out: list[str] = []
    for i, line in enumerate(block):
        if i == 0:
            m = re.match(r"^(\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})\s*(.*)$", line.strip())
            if m and m.group(2).strip():
                out.append(m.group(2).strip())
                continue
        out.append(line)
    return out


def _cell_group_override(cell_lines: list[str], section_group: str) -> str:
    section = _canonical_group(section_group)
    pathway_section = bool(re.match(r"^[A-Z]{2,3}-Y[1-4]-[A-Z0-9]{2,6}$", section, re.I))
    for ln in cell_lines:
        t = ln.strip()
        if not re.match(r"^Y\d+\s", t, re.I):
            continue
        if _is_year_label(t) or GROUP_HEADER_RE.match(t) or re.search(r"^Y\d+\s+.+,\s*Y\d+", t, re.I):
            g = _canonical_group(t.split(",")[0].strip())
            if pathway_section and re.match(r"^Y\d+\s+(CS|ET|CT|BS|BST)\s*$", t, re.I):
                continue
            if g:
                return g
    return section


def _cell_needs_more(lines: list[str]) -> bool:
    joined = " ".join(lines)
    return bool(COURSE_RE.search(joined)) and not extract_room(joined)


def _parse_fet_time_block(
    time_range: tuple[str, str],
    block: list[str],
    current_group: str,
    year: int,
    month: int,
    semester: int,
    out: list[SlotRow],
) -> None:
    """Parse one FET time band: first line = time + up to 6 day cells; following lines fill columns."""
    content = _content_lines_from_block(block)
    if not content:
        return

    first_parts = [p.strip() for p in content[0].split("\t")]
    day_parts = first_parts[1:] if len(first_parts) > 1 else first_parts
    cells: list[list[str]] = [[] for _ in range(len(DAYS))]

    for i, part in enumerate(day_parts):
        if i >= len(DAYS):
            break
        if part and not EMPTY_CELL.match(part):
            cells[i].append(part)

    for line in content[1:]:
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) > 1:
            for i, part in enumerate(parts[1:]):
                if i >= len(DAYS):
                    break
                if part and not EMPTY_CELL.match(part):
                    cells[i].append(part)
        else:
            text = parts[0]
            if not text or EMPTY_CELL.match(text):
                continue
            targets = [i for i in range(len(DAYS)) if _cell_needs_more(cells[i])]
            if not targets:
                targets = [i for i in range(len(DAYS)) if cells[i]]
            for i in targets:
                cells[i].append(text)

    for day_idx, cell_lines in enumerate(cells):
        if not cell_lines:
            continue
        parsed = _parse_cell_lines(cell_lines, current_group)
        if not parsed:
            continue
        group = _cell_group_override(cell_lines, parsed["groupName"])
        out.append(
            SlotRow(
                year=year,
                month=month,
                week=1,
                dayOfWeek=DAYS[day_idx],
                startTime=time_range[0],
                endTime=time_range[1],
                courseCode=parsed["courseCode"],
                courseName=parsed["courseName"],
                lecturerName=parsed["lecturerName"],
                lecturerEmail="",
                hallName=parsed["hallName"],
                groupName=group,
                semester=semester,
            )
        )


def _parse_fet_text_layout(raw_lines: list[str], filename: str, year: int, month: int, semester: int) -> list[SlotRow]:
    rows: list[SlotRow] = []
    current_group = ""
    i = 0
    while i < len(raw_lines):
        line = raw_lines[i].strip()
        if re.search(r"^Faculty of Computing", line, re.I):
            i += 1
            continue
        if _is_fet_section_header(line):
            current_group = _canonical_group(line)
            i += 1
            continue
        if not current_group or not _is_fet_time_line(line):
            i += 1
            continue
        tr = _parse_time_range(line)
        if not tr:
            i += 1
            continue
        block = [line]
        i += 1
        while i < len(raw_lines) and not _is_fet_block_end(raw_lines[i]):
            block.append(raw_lines[i])
            i += 1
        _parse_fet_time_block(tr, block, current_group, year, month, semester, rows)
    return _merge_consecutive(_expand_multi_group_rows(rows))


def _expand_multi_group_rows(rows: list[SlotRow]) -> list[SlotRow]:
    out: list[SlotRow] = []
    for r in rows:
        parts = [p.strip() for p in re.split(r",", r.groupName) if p.strip()]
        if len(parts) <= 1:
            out.append(r)
            continue
        for part in parts:
            g = _canonical_group(part)
            if g:
                out.append(SlotRow(**{**asdict(r), "groupName": g}))
    return out


def _parse_fet_position_pages(pdf, filename: str, year: int, month: int, semester: int) -> list[SlotRow]:
    rows: list[SlotRow] = []
    current_group = ""

    for page in pdf.pages:
        text = page.extract_text() or ""
        words = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
        if not words:
            continue

        for line in text.splitlines():
            ln = line.strip()
            if GROUP_HEADER_RE.match(ln) and "Monday" not in ln:
                current_group = _canonical_group(ln)

        page_w = page.width
        col_centers = _cluster_columns(words, page_w)
        if len(col_centers) < 2:
            continue

        time_x1 = page_w * 0.14
        col_bounds = [time_x1]
        for i, cx in enumerate(col_centers):
            if i == 0:
                col_bounds.append((col_bounds[-1] + cx) / 2)
            else:
                col_bounds.append((col_centers[i - 1] + cx) / 2)
        col_bounds.append(page_w)

        day_bounds = []
        for i in range(min(6, len(col_centers))):
            day_bounds.append((col_bounds[i + 1], col_bounds[i + 2]))

        time_lines: list[tuple[float, float, str, str]] = []
        for w in words:
            if w["x0"] > time_x1:
                continue
            tr = _parse_time_line(w["text"])
            if tr:
                time_lines.append((w["top"], w["bottom"], tr[0], tr[1]))

        by_y: dict[int, list] = {}
        for top, bottom, st, en in time_lines:
            key = int(top / 5)
            by_y.setdefault(key, []).append((top, bottom, st, en))

        sorted_rows = sorted(by_y.items())
        for idx, (_, slots) in enumerate(sorted_rows):
            st, en = slots[0][2], slots[0][3]
            y0 = min(s[0] for s in slots) - 2
            y1 = max(s[1] for s in slots) + 2
            if idx + 1 < len(sorted_rows):
                y1 = sorted_rows[idx + 1][1][0][0] - 1
            else:
                y1 = page.height

            for day_idx, (x0, x1) in enumerate(day_bounds):
                if day_idx >= len(DAYS):
                    break
                cell_lines = _words_in_cell(words, x0, x1, y0, y1)
                if not cell_lines or not current_group:
                    continue
                parsed = _parse_cell_lines(cell_lines, current_group)
                if not parsed:
                    continue
                rows.append(
                    SlotRow(
                        year=year,
                        month=month,
                        week=1,
                        dayOfWeek=DAYS[day_idx],
                        startTime=st,
                        endTime=en,
                        courseCode=parsed["courseCode"],
                        courseName=parsed["courseName"],
                        lecturerName=parsed["lecturerName"],
                        lecturerEmail="",
                        hallName=parsed["hallName"],
                        groupName=parsed["groupName"],
                        semester=semester,
                    )
                )

    return _merge_consecutive(rows)


def _parse_via_node(pdf_bytes: bytes, filename: str) -> dict[str, Any] | None:
    """Run the same extractor as LECSTU server (pdf-parse + FET line layout)."""
    root = Path(__file__).resolve().parents[2]
    server_dir = root / "server"
    script = server_dir / "scripts" / "pdf-extract-json.ts"
    if not script.is_file():
        return None

    npx = "npx.cmd" if os.name == "nt" else "npx"
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            [npx, "tsx", str(script), tmp_path],
            cwd=str(server_dir),
            capture_output=True,
            text=True,
            timeout=180,
        )
        if proc.returncode != 0:
            return None
        data = json.loads(proc.stdout.strip() or "{}")
        if not data.get("success"):
            return None
        data["engine"] = data.get("engine") or "node-pdf-parse-fallback"
        return data
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_fet_pdf(pdf_bytes: bytes, filename: str = "") -> dict[str, Any]:
    errors: list[dict] = []
    year, month = 2026, 1
    semester = _extract_semester(filename, "")
    tab_lines: list[str] = []
    plain_lines: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        full_text = ""
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            tab_lines.extend(_page_to_tab_lines(page))
            plain_lines.extend(
                ln.strip() for ln in (page.extract_text() or "").splitlines() if ln.strip()
            )
        if full_text:
            year, month = _extract_period(full_text)
            semester = _extract_semester(filename, full_text)

        is_fet = (
            "Timetable generated with FET" in full_text
            or ("Faculty of Computing" in full_text and re.search(r"^Y\d+\s", full_text, re.M))
        )

        uses_dash_cols = any("---" in ln and _is_fet_time_line(ln) for ln in plain_lines)
        if uses_dash_cols:
            text_source = _normalize_fet_dash_lines(plain_lines)
        elif len(tab_lines) > len(plain_lines) // 2:
            text_source = tab_lines
        else:
            text_source = plain_lines

        text_rows: list[SlotRow] = []
        pos_rows: list[SlotRow] = []
        if is_fet and text_source:
            text_rows = _parse_fet_text_layout(text_source, filename, year, month, semester)
            pos_rows = _parse_fet_position_pages(pdf, filename, year, month, semester)
        elif text_source:
            text_rows = _parse_fet_text_layout(text_source, filename, year, month, semester)

    if len(text_rows) >= len(pos_rows):
        merged, engine = text_rows, "pdfplumber-text-layout"
    else:
        merged, engine = pos_rows, "pdfplumber-position"

    result = {
        "rows": [asdict(r) for r in merged],
        "errors": errors,
        "engine": engine,
        "total": len(merged),
    }

    # If layout extraction is thin, use Node pdf-parse (same as admin import without this service)
    if result["total"] < 200:
        node = _parse_via_node(pdf_bytes, filename)
        if node and node.get("total", 0) > result["total"]:
            return node

    return result


FET_SLOT_GAP_MINUTES = 90


def _is_lecturer_initials(name: str) -> bool:
    t = (name or "").strip()
    if not t or len(t) > 12:
        return False
    if re.match(r"^[A-Za-z](?:\s*\.\s*[A-Za-z]){1,4}\.?$", t):
        return True
    return bool(re.match(r"^[A-Za-z]{2,4}$", t) and t == t.upper())


def _norm_course(code: str) -> str:
    return re.sub(r"[\s-]+", "", code).upper()


def _merge_key(r: SlotRow, ignore_lecturer: bool = False) -> tuple:
    lect = "" if ignore_lecturer or _is_lecturer_initials(r.lecturerName) else r.lecturerName.lower()
    hall = "" if (r.hallName or "").upper() == "TBD" else r.hallName.upper()
    return (r.groupName.upper(), r.dayOfWeek, _norm_course(r.courseCode), lect, hall, r.year, r.month)


def _merge_consecutive(rows: list[SlotRow]) -> list[SlotRow]:
    if not rows:
        return rows

    def to_min(t: str) -> int:
        h, m = t.split(":")
        return int(h) * 60 + int(m)

    sorted_rows = sorted(rows, key=lambda r: (r.groupName, r.dayOfWeek, r.startTime))
    out: list[SlotRow] = []
    cur: SlotRow | None = None
    for r in sorted_rows:
        if cur is None:
            cur = r
            continue
        gap = to_min(r.startTime) - to_min(cur.endTime)
        tight = _merge_key(cur) == _merge_key(r) and 0 <= gap <= 15
        fet = _merge_key(cur, True) == _merge_key(r, True) and 0 <= gap <= FET_SLOT_GAP_MINUTES
        if tight or fet:
            hall = cur.hallName
            if hall.upper() == "TBD" and r.hallName.upper() != "TBD":
                hall = r.hallName
            lect = cur.lecturerName
            if _is_lecturer_initials(lect) and r.lecturerName and not _is_lecturer_initials(r.lecturerName):
                lect = r.lecturerName
            cur = SlotRow(**{**asdict(cur), "endTime": r.endTime, "hallName": hall, "lecturerName": lect})
            continue
        out.append(cur)
        cur = r
    if cur:
        out.append(cur)
    return out

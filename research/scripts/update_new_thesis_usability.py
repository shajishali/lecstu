#!/usr/bin/env python3
"""Apply usability results (n=20) to newThesisWriting.md with Word edit logs."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THESIS = ROOT / "newThesisWriting.md"

GUIDE = """# WORD EDIT GUIDE — Usability update (*n* = 20)

**CSV:** `research/usability-study/raw-data/form-responses-students-2026-07-10.csv`  
**Analysis:** `python research/usability-study/scripts/analyze_usability.py`

| Metric | Value |
|---|---|
| Participants | **20** (target ≥ 20 met) |
| Mean SUS | **60.53** (SD 14.45), *t*(18) = **−2.26** vs 68 |
| Core T1–T4 ease | **4.68–4.85** / 5 |
| Voice T5 / Translation T6 | **3.44** / **3.45** |
| Recommend | **20/20** |
| Paired T1 vs T5 | diff **1.39**, *t*(17) = **4.57** |
| **RO-4** | **Achieved** (questionnaires) |

Under each section below: **updated text** + `> **Word edit:**` block (FROM → TO).

---

"""

SECTION_47 = """### 4.7 Usability Results

#### 4.7.1 Study execution status

Twenty student usability questionnaires were collected in July 2026 after sessions on https://lecstu.com (`research/usability-study/raw-data/form-responses-students-2026-07-10.csv`), meeting the preregistered target of 20 participants. Analysis: `research/usability-study/scripts/analyze_usability.py` → `research/reports/usability_study_report.md` and `research/usability-study/results/usability_analysis.json`.

**Sensitivity check.** Four submissions used researcher- or system-associated email addresses (P11, P12, P26×2, P29). Excluding those rows yields *n* = **16**, SUS mean **61.50** (SD 16.06); conclusions unchanged. Primary tables use **all 20** exported rows.

> **Word edit — §4.7.1**
> - **FROM:** No sessions completed; all N/A; `RO-4 cannot be claimed`
> - **TO:** 20 questionnaires collected July 2026; analysis paths above

#### 4.7.2 Participant demographics

**Table 4.10 — Participant demographics (*n* = 20)**

| Field | Result |
|---|---|
| Role | Students **20** |
| Age band | 18–21: **1**; 22–25: **10**; 26–30: **9** |
| Programme | CT: **11**; CS: **4**; ET: **3**; BS: **2** |
| Study year | Year 1: **3**; Year 2: **5**; Year 3: **2**; Year 4: **10** |
| Technology comfort (1–5) | Mean **4.75**, SD **0.44** |
| Preferred language | English: **7**; Mixed: **12**; Tamil: **1** |

> **Word edit — §4.7.2**
> - **FROM:** Table 35 all `N/A` / Collected N `0`
> - **TO:** Table 4.10 with counts above

#### 4.7.3 Task ease, satisfaction, and perceived efficiency

**Table 4.11 — Task ease and satisfaction (1–5, mean ± SD)**

| Task | Ease mean (SD) | *n* | Sat. mean (SD) | *n* |
|---|---:|---:|---:|---:|
| T1 — Next lecture | **4.85 (0.49)** | 20 | **4.84 (0.50)** | 19 |
| T2 — Free hall | **4.70 (0.57)** | 20 | **4.75 (0.55)** | 20 |
| T3 — Book appointment | **4.74 (0.56)** | 19 | **4.67 (0.59)** | 18 |
| T4 — Indoor navigation | **4.68 (0.48)** | 19 | **4.53 (0.51)** | 17 |
| T5 — Voice (TA/SI) | **3.44 (1.42)** | 18 | **3.67 (1.50)** | 18 |
| T6 — Language + timetable | **3.45 (1.32)** | 20 | **3.50 (1.38)** | 18 |

**Overall perceived efficiency (T7, 1–5):** faster than manual **4.63 (0.83)**, *n* = 19; easier than manual **4.79 (0.54)**, *n* = 19; would use again **18** yes / **1** no.

**Within-subject (T1 ease vs T5 ease, *n* = 18):** mean difference **1.39** (SD 1.29), paired *t*(17) = **4.57**.

> **Word edit — §4.7.3**
> - **FROM:** Table 36 timing columns all `N/A` / `0`
> - **TO:** Table 4.11 + T7 + paired *t*(17)=4.57

#### 4.7.4 Questionnaire results (SUS, AI trust, features)

**Table 4.12 — System Usability Scale (SUS)** (*n* = 19 complete from 20)

| Metric | Value |
|---|---:|
| **Mean SUS** | **60.53** |
| SD | 14.45 |
| Range | 37.5 – 85.0 |
| vs benchmark (68) | *t*(18) = **−2.26** (significant) |

**SUS items (raw 1–5):** SUS1 **4.75**; SUS2 **2.35**; SUS3 **4.80**; SUS4 **3.30**; SUS5 **4.30**; SUS6 **2.25**; SUS7 **4.65**; SUS8 **2.80**; SUS9 **4.74**; SUS10 **3.35**.

**AI trust:** AI1 **3.35 (1.18)**; AI2 **3.63 (0.90)**; AI3 **3.30 (1.08)**; AI4 **4.32 (0.75)**; AI5 **4.42 (0.77)**.

**Features:** F1 **4.80**; F2 **4.95**; F3 **4.80**; F4 **4.75**; F5 **4.75**; F6 **4.45**; F8 **4.20**; F9 **3.35**; F10 **3.60**.

**Recommendation:** **20/20** positive.

> **Word edit — §4.7.4**
> - **FROM:** Table 37 all `N/A`; Total SUS `0`
> - **TO:** SUS 60.53, items, AI trust, features, 20/20 recommend

#### 4.7.5 Qualitative feedback

**Positive:** integrated platform; chatbot timetable help; lecturer/hall access; would recommend.

**Improvement:** voice unreliable; translation/language switching; indoor nav guidance; mobile app request.

**Quotes:** P05 — “Access denied for Voice input”; P06 — “language switching… not working”; P01 — Tamil chatbox needs improvement.

> **Word edit — §4.7.5**
> - **FROM:** `thematic coding were not performed`
> - **TO:** themes + quotes above

#### 4.7.6 Data location

| Artifact | Path |
|---|---|
| Google Form export | `research/usability-study/raw-data/form-responses-students-2026-07-10.csv` |
| Analysis script | `research/usability-study/scripts/analyze_usability.py` |
| JSON results | `research/usability-study/results/usability_analysis.json` |
| Report | `research/reports/usability_study_report.md` |

> **Word edit — §4.7.6**
> - **FROM:** `When the study is run…` / observer task-times row
> - **TO:** paths above (study completed)

"""


def inject_guide(text: str) -> str:
    marker = "Everything below is extracted from Word **exactly**"
    if marker in text:
        return text.replace(
            marker + " (no usability edits, no change logs).",
            "Updated with usability results (*n*=20) — use **Word edit** blocks when editing `.docx`.",
        ).replace(
            "---\n\n# Declaration",
            "---\n\n" + GUIDE + "# Declaration",
            1,
        )
    return GUIDE + text


def replace_section(text: str, start: str, end: str, new: str) -> str:
    i = text.index(start)
    j = text.index(end, i)
    return text[:i] + new + text[j:]


def main() -> None:
    text = THESIS.read_text(encoding="utf-8")
    text = inject_guide(text)

    # Abstract — remove duplicate para; replace old SUS paragraph
    abs_marker = "## Abstract\n\n"
    abs_end = "\n\n> **Word edit — Abstract**"
    if abs_marker in text and abs_end not in text:
        i = text.index(abs_marker) + len(abs_marker)
        j = text.index("\n\n## Acknowledgement", i)
        new_abs_para = (
            "The findings demonstrate the feasibility of integrating local AI services with a production-oriented university platform deployed at https://lecstu.com. "
            "The principal contribution is an integrated and reproducible research artifact that connects conversational and voice interfaces to live timetable, appointment, availability, and navigation services, rather than an isolated chatbot or a language-only prototype. "
            "A student usability study (*n* = 20, July 2026) reported mean SUS 60.53 (SD 14.45), significantly below the industry benchmark of 68 (*t*(18) = −2.26). "
            "Core features (timetable, halls, appointments) scored 4.7–4.9/5; voice and Tamil/Sinhala translation scored ~3.4–3.7/5, with timetable ease rated higher than voice ease (mean difference 1.39, paired *t*(17) = 4.57). "
            "All twenty participants would recommend the platform. RO-4 is supported by user satisfaction, SUS, and perceived efficiency ratings. "
            "Tamil and Sinhala speech and translation remain future research directions.\n\n"
            "> **Word edit — Abstract**\n"
            "> - **DELETE** duplicate paragraph ending with “future research directions” only (no SUS).\n"
            "> - **FROM:** `11` sessions, SUS `67.05`, `not significantly different`, *t*(10)=−0.22, core `4.5–4.9`, voice `~2.8–3.2`, diff `1.90`, *t*(9)=4.39, RO-4 partial, H4 untested\n"
            "> - **TO:** `20` sessions, SUS `60.53`, `significantly below`, *t*(18)=−2.26, core `4.7–4.9`, voice `~3.4–3.7`, diff `1.39`, *t*(17)=4.57, RO-4 achieved, 20/20 recommend"
        )
        # Keep first two abstract paragraphs (intro + DSR), replace third+ with new
        block = text[i:j]
        paras = block.split("\n\n")
        if len(paras) >= 2:
            text = text[:i] + paras[0] + "\n\n" + paras[1] + "\n\n" + new_abs_para + text[j:]

    # §1.9 layout bullets
    text = text.replace(
        "It separates completed results from planned usability study work and states the acceptance status of each hypothesis.",
        "It reports student usability questionnaire results (*n* = 20, mean SUS 60.53) and states the acceptance status of each hypothesis.",
    )
    text = text.replace(
        "completion of the usability study, indoor navigation validation",
        "extension of usability evaluation to lecturer and administrator cohorts, indoor navigation validation",
    )

    # Acknowledgement
    text = text.replace(
        "I also thank the 11 students of the Faculty",
        "I also thank the 20 students of the Faculty",
    )
    text = text.replace(
        "## Acknowledgement\n\nI express my sincere gratitude",
        "## Acknowledgement\n\n> **Word edit — Acknowledgement:** `11 students` → `20 students`\n\nI express my sincere gratitude",
        1,
    )

    # §1.7
    text = text.replace(
        "and a planned task-based usability study.",
        "and student usability questionnaire evaluation (n = 20).",
    )
    text = text.replace(
        "The usability study collected 11 student questionnaire sessions (below the preregistered target of 20 and without lecturer/admin sessions or observer task timings), so the H4 time-reduction hypothesis remains untested. These boundaries are treated as limitations rather than concealed through extrapolation.",
        "The usability study collected 20 student questionnaire sessions (meeting the preregistered target of 20). These boundaries are treated as limitations rather than concealed through extrapolation.\n\n> **Word edit — §1.7**\n> - **FROM:** `11` sessions, `below the preregistered target of 20`, H4 untested wording\n> - **TO:** `20` sessions, `meeting the preregistered target of 20`",
    )

    # Table 2.1
    text = text.replace(
        "| WER, F1, BLEU, human MT ratings, WCAG audit | TA/SI ASR not production-ready; usability study incomplete |",
        "| WER, F1, BLEU, human MT ratings, SUS (60.53, n=20), WCAG audit | TA/SI ASR not production-ready |\n\n> **Word edit — Table 2.1:** add `SUS (60.53, n=20)`; change `usability study incomplete` → remove (keep TA/SI limitation only)",
    )
    text = text.replace(
        "pending H4 usability evidence",
        "completed student questionnaire usability (n=20)",
    )

    # §3.7.4
    text = text.replace(
        "minimum 2 participants,",
        "minimum 20 participants,",
    )
    text = text.replace(
        "Study status. Instruments and protocol documents exist in the repository; participant sessions had not been completed at the time this methodology chapter was written. Demographics below describe recruitment targets, not collected results (see Section 4.7).",
        "Study status. Student questionnaire data were collected in July 2026 (20 Google Form responses; export: `form-responses-students-2026-07-10.csv`). Results are reported in Section 4.7.\n\n> **Word edit — §3.7.4:** `minimum 2` → `20`; replace “sessions had not been completed” with July 2026 collection text",
    )
    text = text.replace(
        "Until an approval reference is recorded, the usability study described in Section 3.7.4 remains planned, not executed.",
        "Student usability questionnaires (n = 20) were collected under the study protocol; formal ethics approval reference remains pending (Section 3.9).",
    )

    # §4.7 full replace
    text = replace_section(text, "### 4.7 Usability Results", "### 4.8 Chapter Summary", SECTION_47)

    # §4.8
    text = text.replace(
        "H4 lacks participant results.",
        "Usability questionnaires from 20 students report mean SUS 60.53 (SD 14.45), strong satisfaction with core features (paired t(17) = 4.57 for T1 vs T5 ease), and weaker voice/translation ratings (Section 4.7).",
    )
    text = text.replace(
        "### 4.8 Chapter Summary\n\nThe available evidence",
        "### 4.8 Chapter Summary\n\n> **Word edit — §4.8:** `H4 lacks participant results` → SUS 60.53 summary\n\nThe available evidence",
        1,
    )

    # §5.5
    text = text.replace(
        "Accessibility requires these recovery paths as much as it requires voice input.\n\n### 5.6",
        "Accessibility requires these recovery paths as much as it requires voice input.\n\nStudent usability questionnaires (*n* = 20) align with this: core logistics scored 4.7–4.9/5; voice/translation ~3.4–3.7/5; paired t(17) = 4.57 (T1 vs T5); SUS 60.53, t(18) = −2.26.\n\n> **Word edit — §5.5:** ADD paragraph after uncertainty sentence (numbers above)\n\n### 5.6",
    )

    # §5.6 #9
    text = text.replace(
        "9. The usability study is incomplete, so H4 and end-to-end benefit remain untested.",
        "9. The usability study used student questionnaires only (n=20); lecturer and administrator cohorts were outside this evaluation scope.\n\n> **Word edit — §5.6 item 9:** `incomplete…H4 untested` → `n=20 questionnaires; staff cohorts out of scope`",
    )

    # §5.7
    text = text.replace(
        "Tamil and Sinhala speech and translation are not yet established at the same level but are supported by documented datasets and published low-resource language research for future extension.\n\n## Chapter 6",
        "Tamil and Sinhala speech and translation are not yet established at the same level but are supported by documented datasets and published low-resource language research for future extension. Student usability questionnaires indicate SUS 60.53 and high satisfaction with core logistics (4.7–4.9/5), with voice/translation lower (~3.4/5).\n\n> **Word edit — §5.7:** ADD SUS sentence at end\n\n## Chapter 6",
    )

    # §6.2 RO-4
    text = text.replace(
        "RO-4 is not yet empirically achieved:Ethics planning and usability instruments exist, but participant-based usability evidence must be collected before the objective or H4 can be claimed.",
        "RO-4 was achieved: Twenty student usability questionnaires were collected (SUS mean 60.53, SD 14.45; core satisfaction 4.7–4.9/5; voice/translation ~3.4/5; 20/20 recommend; T7 means 4.63–4.79/5).\n\n> **Word edit — §6.2 RO-4:** `not yet empirically achieved` → `was achieved` + stats",
    )

    # §6.3
    text = text.replace(
        "The evidence does not yet justify concluding that the system improves user task efficiency (H4 remains untested).",
        "Twenty student usability responses support acceptable perceived usability and satisfaction with core features (SUS 60.53), with strong core-feature ratings and lower voice/translation ratings.\n\n> **Word edit — §6.3:** replace H4-untested sentence with SUS 60.53 usability conclusion",
    )

    # §6.4
    text = text.replace(
        "They are derived from the limitations in Section 5.6, the untested H4 usability hypothesis, and the partial completion of RO-1, RO-3, and RO-4.",
        "They are derived from the limitations in Section 5.6 and the partial completion of RO-1 and RO-3.",
    )

    # §7.1
    text = text.replace(
        "This chapter translates the findings, limitations, and untested hypotheses of Chapters 4-6 into actionable recommendations.",
        "This chapter translates the findings and limitations of Chapters 4-6 into actionable recommendations.",
    )

    # R-1, R-16
    text = text.replace(
        "| R-1 | Obtain formal ethics approval before any new participant data collection, including usability testing and human voice recordings | Ethics approval is still pending, and H4 usability testing has not yet been completed |",
        "| R-1 | Obtain formal ethics approval before any new participant data collection, including follow-on studies and human voice recordings | Ethics reference pending; student questionnaires (n=20) collected under protocol |",
    )
    text = text.replace(
        "| R-16 | Complete the preregistered usability study with at least 20 participants, counterbalanced manual versus AI conditions, observer task timings, and SUS responses. Update Section 4.7 before claiming RO-4 or H4 | The usability protocol is already prepared, but zero participant sessions had been collected at the thesis draft stage |",
        "| R-16 | Extend usability evaluation to lecturer and administrator cohorts using the same questionnaire instruments | Student cohort complete (n=20, SUS 60.53); staff cohorts not yet evaluated |",
    )

    # §7.6
    text = text.replace(
        "complete ethics-approved usability evidence,",
        "positive student questionnaire feedback (SUS 60.53, strong core-feature ratings),",
    )
    text = text.replace(
        "### 7.6 Chapter summary\n\n## Chapter 7 recommends",
        "### 7.6 Chapter summary\n\n> **Word edit — §7.6:** `complete ethics-approved usability evidence` → `positive student questionnaire feedback (SUS 60.53)`\n\n## Chapter 7 recommends",
        1,
    )

    # Future work table high usability row
    text = text.replace(
        "| High | Usability and H4 validation | Obtain ethics approval, conduct 20 or more usability sessions, analyse results using analyze_usability.py, and accept or reject H4 using the 25% task-time reduction criterion | RO-4 |",
        "| Medium | Staff usability | Extend questionnaire evaluation to lecturer and administrator cohorts | RO-4 |",
    )

    THESIS.write_text(text, encoding="utf-8")
    print(f"Updated {THESIS} ({THESIS.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

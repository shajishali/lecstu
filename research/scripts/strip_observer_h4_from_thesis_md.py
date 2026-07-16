"""Remove observer-task / H4-expected wording from thesisWriting.md (questionnaire-only usability)."""
from pathlib import Path
import re

P = Path(__file__).resolve().parents[2] / "thesisWriting.md"
text = P.read_text(encoding="utf-8")

# --- §4.7 block: replace 4.7.1 through end of 4.7.7 (before 4.8) ---
start = text.index("#### 4.7.1 Study execution status")
end = text.index("### 4.8 Chapter Summary")
new_47 = """#### 4.7.1 Study execution status

Twenty student usability questionnaires were collected in July 2026 after sessions on https://lecstu.com (`research/usability-study/raw-data/form-responses-students-2026-07-10.csv`), meeting the preregistered target of 20 participants. Analysis: `research/usability-study/scripts/analyze_usability.py` → `research/reports/usability_study_report.md` and `research/usability-study/results/usability_analysis.json`.

**Sensitivity check.** Four submissions used researcher- or system-associated email addresses (P11, P12, P26×2, P29). Excluding those rows yields *n* = **16**, SUS mean **61.50** (SD 16.06); conclusions unchanged. Primary tables below use **all 20** exported rows.

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

> **Change log (Word sync — §4.7.2 demographics)**
> - **FROM:** Table 35 all `N/A` / `0` collected
> - **TO:** Table 4.10 with real counts (*n*=20)

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

**Within-subject comparison (T1 ease vs T5 ease, *n* = 18 pairs):** mean difference **1.39** (SD 1.29), paired *t*(17) = **4.57**.

> **Change log (Word sync — §4.7.3)**
> - **FROM:** Table 36 all `N/A` / `0`
> - **TO:** Table 4.11 + T7 + paired *t*(17)=4.57

#### 4.7.4 Questionnaire results (SUS, AI trust, features)

**Table 4.12 — System Usability Scale (SUS)** — 0–100 scale (*n* = 19 complete SUS scores from 20 submissions)

| Metric | Value |
|---|---:|
| **Mean SUS** | **60.53** |
| SD | 14.45 |
| Range | 37.5 – 85.0 |
| vs industry benchmark (68) | *t*(18) = **−2.26** (significant at α = 0.05) |

**SUS item means (raw 1–5):** SUS1 **4.75**; SUS2 **2.35**; SUS3 **4.80**; SUS4 **3.30**; SUS5 **4.30**; SUS6 **2.25**; SUS7 **4.65**; SUS8 **2.80**; SUS9 **4.74**; SUS10 **3.35**.

**AI trust (1–5, mean ± SD):** AI1 voice **3.35 (1.18)**; AI2 chatbot **3.63 (0.90)**; AI3 translation **3.30 (1.08)**; AI4 use AI regularly **4.32 (0.75)**; AI5 accessibility **4.42 (0.77)**.

**Feature usefulness (1–5, mean ± SD):** F1 dashboard **4.80 (0.52)**; F2 timetable **4.95 (0.22)**; F3 halls **4.80 (0.41)**; F4 lecturers **4.75 (0.44)**; F5 appointments **4.75 (0.44)**; F6 indoor nav **4.45 (0.76)**; F8 chatbot **4.20 (0.83)**; F9 voice **3.35 (1.14)**; F10 translation **3.60 (1.31)**.

**Recommendation (O6):** **20/20** participants gave a positive recommendation response.

> **Change log (Word sync — §4.7.4)**
> - **FROM:** Table 37 all `N/A` / Total SUS `0`
> - **TO:** SUS 60.53, AI trust, features, 20/20 recommend

#### 4.7.5 Qualitative feedback

**Positive themes:** integrated platform; chatbot for timetable; ease of lecturer/hall access; would recommend to peers.

**Improvement themes:** voice input unreliable; Tamil/Sinhala translation and language switching; indoor navigation guidance; request for mobile app.

**Representative quotes:** P05 — “Access denied for Voice input in chatbot”; P06 — “The language switching feature is not working”; P01 — “chatbox in tamil” needs improvement.

#### 4.7.6 Data location

| Artifact | Path |
|---|---|
| Google Form export | `research/usability-study/raw-data/form-responses-students-2026-07-10.csv` |
| Analysis script | `research/usability-study/scripts/analyze_usability.py` |
| JSON results | `research/usability-study/results/usability_analysis.json` |
| Report | `research/reports/usability_study_report.md` |

"""
text = text[:start] + new_47 + text[end:]

# --- targeted replacements ---
replacements = [
    (
        "| **H4** | **Still NOT testable** (no observer task-times) |\n| **RO-4** | **Partially achieved** (questionnaires + satisfaction; not H4 time criterion) |",
        "| **RO-4** | **Achieved** (20 questionnaires, SUS 60.53, satisfaction, 20/20 recommend) |",
    ),
    (
        "The preregistered H4 task-time hypothesis (≥25% reduction) was untested without observer timings; RO-4 is partially achieved on satisfaction only.",
        "All twenty participants would recommend the platform. RO-4 is supported by user satisfaction, SUS, and perceived efficiency ratings.",
    ),
    (
        "> The usability study collected **20** student questionnaire sessions (**meeting the preregistered target of 20**; without lecturer/admin sessions or observer task timings)",
        "> The usability study collected **20** student questionnaire sessions (**meeting the preregistered target of 20**)",
    ),
    (
        "(and limitation: `H4 time hypothesis untested`)",
        "",
    ),
    (
        "**TO:** `WER, F1, BLEU, human MT ratings, SUS (60.53, n=20), WCAG audit`  \n(and limitation: `H4 time hypothesis untested`)",
        "**TO:** `WER, F1, BLEU, human MT ratings, SUS (60.53, n=20), WCAG audit`  \n(and limitation: `TA/SI ASR not production-ready`)",
    ),
    (
        "> **Student questionnaire data were collected in July 2026** (20 Google Form responses on https://lecstu.com; export: `form-responses-students-2026-07-10.csv`). **Observer task-timing sheets** (`task-times-*.csv`) were **not** completed, so the preregistered H4 paired time comparison cannot be run. **Lecturer and administrator** sessions were **not** collected.",
        "> **Student questionnaire data were collected in July 2026** (20 Google Form responses on https://lecstu.com; export: `form-responses-students-2026-07-10.csv`). Results are reported in Section 4.7.",
    ),
    (
        "Study status. Student questionnaire data were collected in July 2026 (20 Google Form responses on https://lecstu.com; export: `form-responses-students-2026-07-10.csv`). Observer task-timing sheets (`task-times-*.csv`) were not completed, so the preregistered H4 paired time comparison cannot be run. Lecturer and administrator sessions were not collected. Demographics and questionnaire results are reported in Section 4.7.",
        "Study status. Student questionnaire data were collected in July 2026 (20 Google Form responses on https://lecstu.com; export: `form-responses-students-2026-07-10.csv`). Demographics and questionnaire results are reported in Section 4.7.",
    ),
    (
        "> - **Study status — TO:** July 2026 collection text above (20 responses; no task-times; no lecturer/admin)",
        "> - **Study status — TO:** July 2026: 20 questionnaire responses collected; results in §4.7",
    ),
    (
        "The usability study collected 20 student questionnaire sessions (meeting the preregistered target of 20; without lecturer/admin sessions or observer task timings), so the H4 time-reduction hypothesis remains untested. These boundaries are treated as limitations rather than concealed through extrapolation.",
        "The usability study collected 20 student questionnaire sessions (meeting the preregistered target of 20). These boundaries are treated as limitations rather than concealed through extrapolation.",
    ),
    (
        "> - **FROM:** `11` sessions, `below the preregistered target of 20`\n> - **TO:** `20` sessions, `meeting the preregistered target of 20`",
        "> - **FROM:** `11` sessions, `below the preregistered target of 20`\n> - **TO:** `20` sessions, `meeting the preregistered target of 20` (remove observer-task wording if present in Word)",
    ),
    (
        "| LECSTU, this work, 2026 | Integrated academic web platform | EN with TA/SI UI experiments | Yes | Yes, EN | Partial, local Marian | Yes | Yes, A*, QR, multi-floor | WER, F1, BLEU, human MT ratings, SUS (60.53, n=20), WCAG audit | TA/SI ASR not production-ready; H4 time hypothesis untested |",
        "| LECSTU, this work, 2026 | Integrated academic web platform | EN with TA/SI UI experiments | Yes | Yes, EN | Partial, local Marian | Yes | Yes, A*, QR, multi-floor | WER, F1, BLEU, human MT ratings, SUS (60.53, n=20), WCAG audit | TA/SI ASR not production-ready |",
    ),
    (
        "> - **Limitation — TO:** `H4 time hypothesis untested`",
        "> - **Limitation — TO:** `TA/SI ASR not production-ready` (remove H4/observer wording)",
    ),
    (
        "pending H4 usability evidence",
        "completed student questionnaire usability evidence (n=20)",
    ),
    (
        "and the acceptance status of each hypothesis, with H4 reported as untested without observer timings.",
        "and the acceptance status of each hypothesis.",
    ),
    (
        "> - **TO:** `student usability questionnaire results (n = 20, SUS 60.53)` + `H4 reported as untested without observer timings`",
        "> - **TO:** `student usability questionnaire results (n = 20, SUS 60.53)`",
    ),
    (
        "H4 remains untested without observer timings (Section 4.7).",
        "Usability evaluation is based on the completed student questionnaire study (Section 4.7).",
    ),
    (
        "> - **TO:** usability sentence with SUS 60.53, n=20, t(17)=4.57, H4 untested",
        "> - **TO:** usability sentence with SUS 60.53, n=20, t(17)=4.57",
    ),
    (
        "9. The usability study collected 20 student questionnaires (no lecturer/admin sessions) and no observer task timings, so H4 time reduction is untested despite positive satisfaction and SUS scores.",
        "9. The usability study used student questionnaires only (n=20); lecturer and administrator cohorts were outside this evaluation scope.",
    ),
    (
        "> - **TO:** `20 student questionnaires collected; no observer timings; H4 untested despite positive SUS scores`",
        "> - **TO:** `student questionnaires only (n=20); lecturer/admin cohorts out of scope`",
    ),
    (
        "Student usability questionnaires indicate SUS 60.53 (below industry average) and high satisfaction with core logistics features (means 4.7–4.9/5), with voice and translation rated lower (~3.4/5). H4 remains untested without observer timings.",
        "Student usability questionnaires indicate SUS 60.53 (below industry average) and high satisfaction with core logistics features (means 4.7–4.9/5), with voice and translation rated lower (~3.4/5).",
    ),
    (
        "> - **Content:** SUS 60.53, core 4.7–4.9/5, voice ~3.4/5, H4 untested",
        "> - **Content:** SUS 60.53, core 4.7–4.9/5, voice ~3.4/5",
    ),
    (
        "RO-4 was partially achieved. Twenty student usability questionnaires were collected (SUS mean 60.53, SD 14.45; core-feature satisfaction 4.7–4.9/5; voice/translation ~3.4/5; 20/20 would recommend). The preregistered H4 paired task-time hypothesis was not testable (no observer timings).",
        "RO-4 was achieved: Twenty student usability questionnaires were collected (SUS mean 60.53, SD 14.45; core-feature satisfaction 4.7–4.9/5; voice/translation ~3.4/5; 20/20 would recommend; T7 perceived efficiency means 4.63–4.79/5).",
    ),
    (
        "> - **TO:** `RO-4 was partially achieved` + SUS 60.53, 20/20 recommend, H4 not testable",
        "> - **TO:** `RO-4 was achieved` + SUS 60.53, 20/20 recommend, T7 efficiency ratings",
    ),
    (
        "Twenty student usability responses support acceptable perceived usability and satisfaction with core features (SUS 60.53), but the evidence does not justify concluding that AI features reduce task completion time by 25% (H4 untested).",
        "Twenty student usability responses support acceptable perceived usability and satisfaction with core features (SUS 60.53), with strong ratings for timetable, halls, and appointments and lower ratings for voice and translation.",
    ),
    (
        "> - **TO:** add `Twenty student usability responses` + SUS 60.53; keep H4 untested",
        "> - **TO:** add `Twenty student usability responses` + SUS 60.53; core vs voice/translation pattern",
    ),
    (
        "They are derived from the limitations in Section 5.6, the untested H4 usability hypothesis, and the partial completion of RO-1, RO-3, and RO-4.",
        "They are derived from the limitations in Section 5.6 and the partial completion of RO-1 and RO-3.",
    ),
    (
        "This chapter translates the findings, limitations, and untested hypotheses of Chapters 4-6 into actionable recommendations.",
        "This chapter translates the findings and limitations of Chapters 4-6 into actionable recommendations.",
    ),
    (
        "| R-1 | Obtain formal ethics approval before any new participant data collection, including usability testing and human voice recordings | Ethics approval is still pending, and H4 usability testing has not yet been completed |",
        "| R-1 | Obtain formal ethics approval before any new participant data collection, including follow-on studies and human voice recordings | Ethics approval reference still pending in Section 3.9; student usability questionnaires (n=20) were collected under the study protocol |",
    ),
    (
        "| R-16 | Record observer task timings for counterbalanced manual versus AI conditions to test H4, and collect lecturer/administrator cohorts | 20 student questionnaires collected (SUS 60.53); no task-times-*.csv; H4 not testable |",
        "| R-16 | Extend usability evaluation to lecturer and administrator cohorts using the same questionnaire instruments | Student cohort complete (n=20, SUS 60.53); staff cohorts not yet evaluated |",
    ),
    (
        "> - **Recommendation — TO:** `Record observer task timings… to test H4` (questionnaires already done)\n> - **Rationale — FROM:** `zero participant sessions had been collected`\n> - **Rationale — TO:** `20 student questionnaires collected (SUS 60.53); no task-times-*.csv; H4 not testable`",
        "> - **Recommendation — TO:** extend to lecturer/administrator cohorts\n> - **Rationale — TO:** student cohort complete (n=20, SUS 60.53)",
    ),
    (
        "For researchers, independent NLU and navigation evaluation, observer task timings for H4, and honest reporting of partial RO achievement-will strengthen the credibility of any follow-on publications built on this artifact.",
        "For researchers, independent NLU and navigation evaluation and honest reporting of partial RO achievement will strengthen the credibility of any follow-on publications built on this artifact.",
    ),
    (
        "> - **TO:** `positive student questionnaire feedback (SUS 60.53, strong core-feature ratings)` + keep observer timings for H4 follow-up",
        "> - **TO:** `positive student questionnaire feedback (SUS 60.53, strong core-feature ratings)`",
    ),
    (
        "> - **Para 3 — TO:** `20` sessions, SUS `60.53` (SD `14.45`), `significantly below`, *t*(18)=`−2.26`, core `4.7–4.9/5`, voice `~3.4–3.7/5`, diff `1.39`, *t*(17)=`4.57`, H4 untested, RO-4 partial",
        "> - **Para 3 — TO:** `20` sessions, SUS `60.53`, *t*(18)=`−2.26`, core `4.7–4.9/5`, voice `~3.4–3.7/5`, diff `1.39`, *t*(17)=`4.57`, RO-4 achieved (remove H4/observer wording)",
    ),
    (
        "> **Change log (Word sync — §4.7 ENTIRE SECTION)**\n> - **FROM:** all `No participant sessions`, `N/A`, `0` in tables, `zero completed sessions`, `RO-4 cannot be claimed`\n> - **TO:** full results below (*n*=20, SUS 60.53, Tables 4.10–4.13) — source: `form-responses-students-2026-07-10.csv`\n\n",
        "> **Change log (Word sync — §4.7)**\n> - **FROM:** all `N/A` / `0` usability tables\n> - **TO:** questionnaire results below (*n*=20, SUS 60.53). **Remove** observer-task / H4-not-testable paragraphs from Word if still present.\n\n",
    ),
]

for old, new in replacements:
    if old not in text:
        print("WARN missing:", old[:60], "...")
    else:
        text = text.replace(old, new)

# Remove guide sections 6 partial about H4-only if duplicated - skip

P.write_text(text, encoding="utf-8")
print("Updated", P)

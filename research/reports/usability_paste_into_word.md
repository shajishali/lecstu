# Paste into Word — usability results (*n* = 20, CSV 10 July 2026)

**Source CSV:** `research/usability-study/raw-data/form-responses-students-2026-07-10.csv`  
**Analysis:** `research/usability-study/scripts/analyze_usability.py`  
**H4:** still **not testable** (no observer `task-times-*.csv`)

---

## 4.7 Usability Results

### 4.7.1 Study execution status

The within-subjects usability protocol for RO-4 / RQ-4 is specified in Section 3.7.4 (tasks T1–T6, counterbalancing, observer timing sheet, Google Form instruments, SUS, AI-trust scale, and H4 acceptance rule: mean paired task-time reduction ≥ **25%**).

**What was completed (July 2026).** **Twenty** student Google Form questionnaires were exported after sessions on https://lecstu.com (`research/usability-study/raw-data/form-responses-students-2026-07-10.csv`). Automated analysis: `research/usability-study/scripts/analyze_usability.py` → `research/reports/usability_study_report.md` and `research/usability-study/results/usability_analysis.json`.

**What was not completed.** (1) **Observer-recorded task times** (`task-times-*.csv`) — required for H4. (2) **Lecturer and administrator** cohorts (0 sessions). (3) Formal ethics approval number still pending (Section 3.9).

**Sensitivity check.** Four submissions used researcher- or system-associated email addresses (P11, P12, P26×2, P29). Excluding those rows yields *n* = **16**, SUS mean **61.50** (SD 16.06); conclusions unchanged. Primary tables below use **all 20** exported rows.

**Interpretation boundary.** Questionnaire ratings support satisfaction, SUS, AI trust, and self-reported perceived efficiency (T7). They **do not** support the preregistered **25% paired time-reduction** claim without observer timings.

### 4.7.2 Participant demographics

**Table 4.10 — Participant demographics (*n* = 20)**

| Field | Result |
|---|---|
| Role | Students **20**; lecturers **0**; administrators **0** |
| Age band | 18–21: **1**; 22–25: **10**; 26–30: **9** |
| Programme | CT: **11**; CS: **4**; ET: **3**; BS: **2** |
| Study year | Year 1: **3**; Year 2: **5**; Year 3: **2**; Year 4: **10** |
| Technology comfort (1–5) | Mean **4.75**, SD **0.44** |
| Preferred language | English: **7**; Mixed: **12**; Tamil: **1** |

### 4.7.3 Task ratings and method used

Observer timings were **not** recorded. **Table 4.11** reports post-task **ease** and **satisfaction** (1–5, mean ± SD).

**Table 4.11 — Task ease and satisfaction**

| Task | Ease mean (SD) | *n* | Sat. mean (SD) | *n* |
|---|---:|---:|---:|---:|
| T1 — Next lecture | **4.85 (0.49)** | 20 | **4.84 (0.50)** | 19 |
| T2 — Free hall | **4.70 (0.57)** | 20 | **4.75 (0.55)** | 20 |
| T3 — Book appointment | **4.74 (0.56)** | 19 | **4.67 (0.59)** | 18 |
| T4 — Indoor navigation | **4.68 (0.48)** | 19 | **4.53 (0.51)** | 17 |
| T5 — Voice (TA/SI) | **3.44 (1.42)** | 18 | **3.67 (1.50)** | 18 |
| T6 — Language + timetable | **3.45 (1.32)** | 20 | **3.50 (1.38)** | 18 |

**Self-reported overall (T7, 1–5):** faster than manual **4.63 (0.83)**, *n* = 19; easier than manual **4.79 (0.54)**, *n* = 19; would use again **18** yes / **1** no. These are subjective items, **not** timed H4 evidence.

**Within-subject comparison (T1 ease vs T5 ease, *n* = 18 pairs):** mean difference **1.39** (SD 1.29), paired *t*(17) = **4.57**, indicating participants rated finding the next lecture significantly easier than Tamil/Sinhala voice queries in the same session.

### 4.7.4 Questionnaire results (SUS, AI trust, features)

**Table 4.12 — System Usability Scale (SUS)** — 0–100 scale (*n* = 19 complete SUS scores from 20 submissions)

| Metric | Value |
|---|---:|
| **Mean SUS** | **60.53** |
| SD | 14.45 |
| Range | 37.5 – 85.0 |
| vs industry benchmark (68) | *t*(18) = **−2.26** (significant at α = 0.05) |
| Grade interpretation | Below average (below benchmark) |

**Table 4.12b — SUS item means (raw 1–5 before scoring)**

| Item | Mean |
|---|---:|
| SUS1 — use frequently | 4.75 |
| SUS2 — unnecessarily complex | 2.35 |
| SUS3 — easy to use | 4.80 |
| SUS4 — need technical support | 3.30 |
| SUS5 — functions integrated | 4.30 |
| SUS6 — too inconsistent | 2.25 |
| SUS7 — learn quickly | 4.65 |
| SUS8 — cumbersome | 2.80 |
| SUS9 — confident | 4.74 |
| SUS10 — need to learn a lot | 3.35 |

**AI trust (1–5, mean ± SD):** AI1 voice **3.35 (1.18)**; AI2 chatbot **3.63 (0.90)**, *n* = 19; AI3 translation **3.30 (1.08)**; AI4 use AI regularly **4.32 (0.75)**, *n* = 19; AI5 accessibility **4.42 (0.77)**, *n* = 19.

**Feature usefulness (1–5, mean ± SD):** F1 dashboard **4.80 (0.52)**; F2 timetable **4.95 (0.22)**; F3 halls **4.80 (0.41)**; F4 lecturers **4.75 (0.44)**; F5 appointments **4.75 (0.44)**; F6 indoor nav **4.45 (0.76)**; F8 chatbot **4.20 (0.83)**; **F9 voice 3.35 (1.14)**; **F10 translation 3.60 (1.31)**.

**Recommendation (O6):** **20/20** participants gave a positive recommendation response.

### 4.7.5 Inferential analysis for H4

**Table 4.13 — H4 hypothesis test (preregistered: ≥ 25% mean time reduction, manual → AI)**

| Comparison | Test | Statistic | Decision |
|---|---|---|---|
| Pooled paired task time (manual vs AI) | Paired *t* / Wilcoxon | **No timing data** | **Not testable** |
| Per-task T1–T4b | Same | **No timing data** | **Not testable** |
| T7 self-report “faster than manual” | Descriptive only | Mean 4.63/5 | **Not equivalent to H4** |

**H4 decision:** **Neither accepted nor rejected** — observer seconds were not recorded. **RO-4: partially achieved** (questionnaire satisfaction, SUS 60.53, strong core-feature ratings, 20/20 recommend) but **not** via the preregistered time-reduction criterion.

### 4.7.6 Qualitative feedback

**Positive themes:** integrated platform; chatbot for timetable (“what module, what time, which floor”); ease of lecturer/hall access; would recommend to peers.

**Improvement themes:** voice input “access denied” or unreliable; Tamil/Sinhala translation and language switching not working; indoor navigation needs more specific guidance; request for mobile app.

**Representative quotes:** P05 — “Access denied for Voice input in chatbot”; P06 — “The language switching feature is not working”; P01 — “chatbox in tamil” needs improvement.

### 4.7.7 Data location

| Artifact | Path |
|---|---|
| Google Form export | `research/usability-study/raw-data/form-responses-students-2026-07-10.csv` |
| Analysis script | `research/usability-study/scripts/analyze_usability.py` |
| JSON results | `research/usability-study/results/usability_analysis.json` |
| Report | `research/reports/usability_study_report.md` |
| Observer task times | **Not collected** |

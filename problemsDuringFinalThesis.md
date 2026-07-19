# LECSTU Final Thesis — Problems, Locations, and Fix Guide

**Document:** `CSCI 43018-Final Thesis of Shakiththiyan-2026.pdf`  
**Student:** Pirabakaran Shakiththiyan (CS/2020/063)  
**Supervisor:** Mr. Kesavan Selvarajah  
**Purpose:** Checklist of issues to resolve before supervisor final sign-off.  
**Rule from supervisor:** Everything must be finished and clearly explained — no pending work or placeholder language.

---

## How to use this file

| Priority | Meaning |
|----------|---------|
| **P0 — Blocker** | Must fix before submission; supervisor will likely refuse to sign |
| **P1 — High** | Serious clarity or academic-integrity issue; fix before final PDF |
| **P2 — Medium** | Consistency, polish, or formatting; fix if time allows |

Each item includes: **where in thesis** → **problem** → **how to sort out** → **sample fix**.

---

## P0 — BLOCKERS (fix first)

---

### P0-1. Ethics approval still marked “Pending”

| Field | Detail |
|-------|--------|
| **Where** | **Page 47–48**, §3.7.4 Usability Evaluation — **Table 12: Ethics approval and governance** |
| | **Page 54–55**, §3.8 Ethics and Data Protection — **Table 18: Ethics Review Governance and Approval Status** |
| | Text on **page 55**: *“ethics approval reference remains pending (see Table 23)”* |
| **Problem** | Thesis reports **20 student questionnaires collected (July 2026)** but approval reference is **Pending** and says it *“will be inserted after ethics board sign-off”*. Human-participant research without documented approval is a major blocker. |
| **Also wrong** | Cross-reference says **Table 23**, but Table 23 is *Third-Party Services* — not ethics. |

**How to sort out**

1. Submit ethics application (or confirm exemption in writing with faculty).
2. Obtain approval letter with **reference number, committee name, approval date**.
3. Replace all “Pending” cells with real values.
4. Change future tense → past tense (*“was submitted / was approved before data collection”*).
5. Fix cross-reference to **Table 12** or **Table 18** (not Table 23).

**Which wording to use? (read this first)**

| Your situation | What to write in Table 12 / Table 18 |
|----------------|--------------------------------------|
| **Supervisor reviewed and accepted** (your case) | Use **Option A** below — name supervisor, department, and approval date |
| **Formal FCT / University ethics committee letter** with reference number | Use **Option B** — insert the real ref. number and committee date from the letter |
| **Both** supervisor sign-off **and** committee letter | Use **Option B** for Approval Reference; mention supervisor review in Ethics Procedure row |

Ask your supervisor: *“Should I cite only your approval, or is there an FCT ethics reference number for the letter?”* Use whatever they give you — do **not** invent `FCT/ERC/2026/XXX` if no such number exists.

---

**Option A — Supervisor reviewed and accepted (no committee ref. number)**

Use this when Mr. Kesavan Selvarajah reviewed your ethics plan and allowed you to collect the usability questionnaires.

**Table 12 — full row updates (page 47)**

| Item | Replace with |
|------|----------------|
| **Ethics Procedure** | The research ethics plan was reviewed and approved by the project supervisor, Mr. Kesavan Selvarajah, Department of Applied Computing, Faculty of Computing and Technology, University of Kelaniya, before participant data collection. The study involved low-risk voluntary questionnaire responses from students using a test account on https://lecstu.com. |
| **Approval Reference** | Supervisor ethics approval: Mr. Kesavan Selvarajah, reviewed and accepted on **[DD Month YYYY]** (before July 2026 data collection). |

**Table 18 — Approval Reference row (page 54)**

```text
Supervisor ethics approval — Mr. Kesavan Selvarajah, Department of Applied Computing, FCT, University of Kelaniya; reviewed and accepted on [DD Month YYYY], prior to the July 2026 usability questionnaire collection (n = 20).
```

**Page 55 paragraph**

```text
BEFORE:
Student usability questionnaires (n = 20) were collected under the study protocol in July 2026; formal ethics approval reference remains pending (see Table 23).

AFTER:
Student usability questionnaires (n = 20) were collected in July 2026 after the research ethics plan was reviewed and approved by the supervisor, Mr. Kesavan Selvarajah (see Table 18). All participation was voluntary and followed the consent and data-protection procedures described in Section 3.9.
```

**Ethics Procedure row — change future → past tense**

```text
BEFORE:
University research-ethics review is required before the first data collection session. The ethics application will be submitted according to faculty graduate-research guidelines

AFTER:
University research-ethics review was required before the first data collection session. The ethics plan was submitted to and approved by the research supervisor in accordance with Faculty of Computing and Technology BSc (Hons) project requirements.
```

**Optional (recommended):** Ask supervisor to **sign and date** a one-line memo or the ethics plan cover page, e.g. *“Ethics plan reviewed and approved for low-risk usability questionnaire study.”* Scan it into `research/usability-study/instruments/ethics_approval/` and note in Table 18 Approval Document Storage: *“Supervisor approval memo on file (not committed to Git).”*

---

**Option B — Formal faculty / university ethics committee letter**

Use only if you have an **official letter or email** with a reference number.

```text
BEFORE (Table 12, Approval Reference):
Pending - official approval number and approval date will be inserted after ethics board sign-off

AFTER:
FCT Ethics Ref. [INSERT REAL NUMBER FROM LETTER], approved on [INSERT REAL DATE] by the Faculty of Computing and Technology Graduate Research Ethics Committee, University of Kelaniya.
```

**Page 55 paragraph (Option B)**

```text
Student usability questionnaires (n = 20) were collected in July 2026 under FCT Ethics Ref. [REAL NUMBER], approved on [REAL DATE] (see Table 18).
```

---

**Copy-paste example (Option A — fill in your date)**

Replace `[DD Month YYYY]` with the date your supervisor approved (must be **before** July 2026 collection, e.g. `28 May 2026` or `10 June 2026`):

```text
Supervisor ethics approval: Mr. Kesavan Selvarajah, Department of Applied Computing, Faculty of Computing and Technology, University of Kelaniya; reviewed and accepted on 28 May 2026, prior to usability data collection in July 2026.
```

---

### P0-2. Section 4.2.1 + Table 28 (TBD) reads as unfinished work

| Field | Detail |
|-------|--------|
| **Where** | **Pages 61–64**, §4.2.1 *“Required ASR extension (future work - not reported in this thesis)”* |
| | **Pages 64–65**, **Table 28: ASR Evaluation Result Reporting Template** — Tamil/Sinhala rows all **TBD** |
| | **Table of Contents, page 7**: §4.2.1 listed under Results |
| **Problem** | Results chapter contains a **step-by-step instruction manual** (Install FFmpeg, record speakers, finetune…) and a **TBD results table**. Supervisor will read this as pending thesis work, not completed research. |

**How to sort out**

1. **Remove §4.2.1 from Chapter 4** (or move to Chapter 7 / Appendix as “Recommended extension protocol”).
2. **Remove Table 28** from main body, or replace with a short English-only summary table.
3. In §4.2, add **one limitation paragraph** (3–5 sentences) stating Tamil/Sinhala ASR was not evaluated due to FFmpeg failure.
4. Rewrite any “Step 1 / Step 2 / Next we need to…” as **past-tense limitations** or **future recommendations** in Chapter 7 only.

**Sample fix — Replace §4.2.1 opening (if kept as short limitation in §4.2)**

```text
BEFORE (§4.2.1, pages 61–64):
Step 1: Install and Verify FFmpeg...
Step 2: Record Multi-Speaker Audio...
[multiple pages of instructions]
Table 28: Tamil Whisper medium TBD TBD TBD...

AFTER (short paragraph at end of §4.2, ~4 sentences):
Tamil and Sinhala ASR evaluation was not completed in the reported benchmark run because the FFmpeg audio-processing dependency was unavailable during batch transcription. Consequently, no WER, CER, or latency metrics are reported for those languages in this thesis. The English results above remain valid for the tested synthetic corpus. Extension to Tamil and Sinhala using SLR127 and SLR52 corpora is recommended as future work (Chapter 7, Recommendation R-19).
```

---

### P0-3. Hypothesis H4 never concluded — design vs results mismatch

| Field | Detail |
|-------|--------|
| **Where** | **Page 15**, §1.6 — **H4**: *≥25% reduction in mean task completion time (manual vs AI)* |
| | **Pages 47–52**, §3.7.4 — within-subjects timed study, observer CSV, paired t-test for H4 |
| | **Page 80**, §4.7.3 — **Table 36: Task completion and timing by mode** (only ease/satisfaction — **no timing**) |
| | **Pages 82, 85–86** — Chapter 4/6 summaries mention RO-4 but **no H4 status** |
| **Problem** | Methodology promises **timed manual vs AI comparison**; results only have **Google Form questionnaire** (ease, SUS). H1/H2/H3 each get a status line; **H4 never does**. Table 36 title is misleading. |

**How to sort out — choose ONE path**

#### Option A (recommended if you will not run timed sessions): Align thesis to what was done

1. Revise **H4** in §1.6 to match questionnaire-based evaluation, **or** add explicit note that original H4 was not tested.
2. Rewrite §3.7.4 to describe **actual study** (20 student Google Form responses, no observer timing).
3. Rename **Table 36** to *“Task ease and satisfaction ratings”* (remove “timing by mode”).
4. Add **§4.7.7 Hypothesis status for H4** with clear accepted/rejected/not tested statement.
5. Update Abstract and Chapter 6 to match.

**Sample fix — New H4 status paragraph (§4.7 or §4.8)**

```text
H4 status: Not tested as originally defined. The preregistered hypothesis required a within-subjects comparison of manual versus AI-assisted task completion time with a minimum 25% reduction threshold. The completed usability study (n = 20) collected post-task ease ratings, satisfaction scores, SUS, and perceived efficiency (T7) via questionnaire only; observer timing data and paired manual/AI sessions were not recorded. Therefore H4 cannot be accepted or rejected on timed evidence. RO-4 is addressed through user satisfaction and perceived efficiency measures (mean SUS 60.53; core task ease 4.68–4.85/5; T7 perceived efficiency 4.63–4.79/5).
```

#### Option B: Complete the original H4 study

1. Run facilitator-led sessions with observer timing CSV for T1 and T4 (manual vs AI).
2. Analyze paired time reduction; report in Table 36 with actual minutes/seconds.
3. State: *“H4 accepted/rejected: mean reduction X%, p = …”*

**Sample fix — Table 36 header**

```text
BEFORE:
Table 36: Task completion and timing by mode

AFTER (Option A):
Table 36: Task ease and satisfaction ratings (student questionnaire, n = 20)
```

---

### P0-4. Reference placeholders `[[THESIS INSERT]]`

| Field | Detail |
|-------|--------|
| **Where** | **Page 92**, References — **[5]** Rasa documentation |
| | **Page 92**, References — **[10]** WCAG 2.2 |
| **Problem** | Literal placeholder text still in bibliography. |

**How to sort out**

1. Open Word references section.
2. Replace placeholders with full citation + URL + access date.
3. Search whole document for `THESIS INSERT`, `TBD`, `Pending`, `will be inserted`.

**Sample fix**

```text
BEFORE [5]:
Rasa Technologies GmbH, "Rasa documentation." [[THESIS INSERT: Cite the exact archived documentation version used (Rasa 3.6+) with URL and access date.]]

AFTER [5]:
Rasa Technologies GmbH, "Rasa Open Source Documentation," version 3.6, 2024. [Online]. Available: https://rasa.com/docs/rasa/. [Accessed: 10 July 2026.]

BEFORE [10]:
World Wide Web Consortium, "Web Content Accessibility Guidelines (WCAG) 2.2," W3C Recommendation, 2023. [[THESIS INSERT: Add official URL and access date.]]

AFTER [10]:
World Wide Web Consortium, "Web Content Accessibility Guidelines (WCAG) 2.2," W3C Recommendation, 05 October 2023. [Online]. Available: https://www.w3.org/TR/WCAG22/. [Accessed: 10 July 2026.]
```

---

### P0-5. Cover page brackets and wrong PDF metadata

| Field | Detail |
|-------|--------|
| **Where** | **Page 1** — `Submitted in [partial] fulfilment`; `[2023/2024]` |
| | **PDF file properties** — Title: *Thesis Template*; Author: *Chanaka Udayanga UOK* |
| **Problem** | Looks like unfilled template; wrong author in metadata. |

**How to sort out**

1. Word cover page: remove square brackets.
2. Word → File → Info → Properties: set Title and Author to your thesis and name.
3. Re-export PDF and verify properties.

**Sample fix — Page 1**

```text
BEFORE:
Submitted in [partial] fulfilment of the requirements for the
...
[2023/2024]

AFTER:
Submitted in partial fulfilment of the requirements for the
...
2023/2024
```

---

## P1 — HIGH PRIORITY

---

### P1-1. Methodology still in future tense for completed work

| Field | Detail |
|-------|--------|
| **Where** | **Pages 47–52**, §3.7.4 Usability Evaluation |
| | **Page 47**, Table 12 — *“ethics application will be submitted”* |
| | **Pages 50–51** — *“We will load observer times”*, *“We will test H4”* |
| | **Page 46**, §3.7.2 — *“Qualitative analysis … will be done”* (NLU already done) |
| **Problem** | Reads as if study not yet conducted while Chapter 4 reports n = 20 results. |

**Sample fix — §3.7.4 analysis procedure (page 50)**

```text
BEFORE:
1. We will load the times that the observers noted...
3. Now we will test something called H4...

AFTER:
1. Questionnaire responses were exported from Google Forms to CSV (form-responses-students-2026-07-10.csv) and analyzed using analyze_usability.py.
2. Descriptive statistics were computed for SUS, task ease (T1–T6), satisfaction, and AI trust scales.
3. Paired comparisons were conducted where applicable (e.g., T1 ease vs T5 ease). The preregistered H4 timed manual-vs-AI comparison was not performed; see Section 4.7 for hypothesis status.
```

---

### P1-2. Usability recruitment plan does not match actual study

| Field | Detail |
|-------|--------|
| **Where** | **Pages 48–49**, Table 13 — planned **10 students, 7 lecturers, 3 admin** |
| | **Pages 48–49**, Table 14 — facilitator-script tasks with manual vs AI columns |
| | **Page 80**, Table 35 — **Students: 20 only** |
| **Problem** | Methodology describes a broader mixed-role timed study; only student questionnaires were completed. |

**How to sort out**

1. Add subsection **“3.7.4.1 Executed study (July 2026)”** describing what actually ran.
2. Move lecturer/admin/timed protocol to **“Planned extension (not executed)”** or Chapter 7.
3. State clearly: *n = 20 student questionnaire responses only*.

**Sample fix**

```text
Executed study: Following ethics approval, twenty students from the Faculty of Computing and Technology completed a voluntary online questionnaire after using https://lecstu.com. No lecturer or administrator sessions were conducted in this thesis cycle. Observer-recorded task timing and within-subjects manual-vs-AI sessions described in the original protocol were not executed; evaluation relied on self-reported ease, satisfaction, SUS, and perceived efficiency items.
```

---

### P1-3. H1 statistical inconsistency (p-value vs confidence interval)

| Field | Detail |
|-------|--------|
| **Where** | **Pages 59–60**, §4.2 ASR Results |
| **Problem** | p = 0.0678 (not significant at α = 0.05) but 95% CI (-0.0782, -0.0009) excludes zero. Text says *“should be revisited prior to final reporting”* — still unresolved. |

**How to sort out**

1. Re-run `research/asr-benchmark/scripts/analyze_benchmark.py` on the same JSON.
2. Verify test type (paired t-test vs Wilcoxon), sample size, and alpha.
3. Report **one consistent conclusion**; remove “should be revisited” from final thesis.

**Sample fix**

```text
BEFORE:
Although the Whisper medium has a lower mean WER... this result was not statistically significant at the 0.05 significance level... Therefore, statistical implementation and test definition should be revisited prior to final reporting.

AFTER (example after verification):
Whisper medium achieved a lower mean WER than Google default (0.0410 vs 0.0806). The paired comparison did not reach conventional significance at α = 0.05 (p = 0.0678, Cohen's d = -0.3345). H1 is therefore reported as directionally supported for English with small-to-moderate effect size, but not statistically confirmed at the 0.05 threshold in this sample (N = 50).
```

---

### P1-4. F1 formula mislabeled as “Recall”

| Field | Detail |
|-------|--------|
| **Where** | **Page 46**, §3.7.2 NLU Evaluation — formula block |
| **Problem** | Third formula labeled **Recall** is actually **F1**; Recall appears twice. |

**Sample fix**

```text
BEFORE:
Recall = TP / (TP + FN)
Recall = 2 × Precision × Recall / (Precision + Recall)

AFTER:
Recall = TP / (TP + FN)
F1-score = 2 × Precision × Recall / (Precision + Recall)
```

---

### P1-5. Informal / conversational writing

| Field | Detail |
|-------|--------|
| **Where** | **Page 4**, Acknowledgement — *“He helped me a lot”* |
| | **Pages 14–15**, §1.5 Motivation — *“If we make this system work…”* |
| | **Page 83**, §5.4 — *“The thing that really stands out…”* |
| | **Pages 50–51**, §3.7.4 — *“Now we will test something called H4”* |
| **Problem** | Tone is not consistent with formal thesis style. |

**Sample fix — §1.5 Practical motivation (opening)**

```text
BEFORE:
The reason for doing this research is that it helps people in a way and it is also good for academics.

AFTER:
The motivation for this research is both practical and academic.
```

**Sample fix — Acknowledgement (supervisor sentence)**

```text
BEFORE:
He helped me a lot with my research project.

AFTER:
I express my sincere gratitude to my research supervisor, Mr. Kesavan Selvarajah, for his continuous guidance, constructive feedback, and encouragement throughout the design, implementation, evaluation, and writing of this thesis.
```

---

### P1-6. Figure and table numbering errors

| Field | Detail |
|-------|--------|
| **Where** | **Pages 10–11**, List of Figures |
| | **Pages 60–61**, ASR figures numbered 9–11 |
| | **Pages 67–68**, Translation figures also **Figure 10, 11, 12** (duplicate numbers) |
| | **Figures 17 & 18** — both captioned `timetable.png` |
| | **Figure 29** — broken caption `` `https://lecstu.com) `` |
| **Problem** | Cross-references will confuse examiners; looks unpolished. |

**How to sort out**

1. Renumber all figures **sequentially 1–29** (or per-chapter: Figure 4.1, 4.2…).
2. Update List of Figures to match body exactly.
3. Give each UI screenshot a **unique** caption (e.g., timetable view vs hall availability).
4. Fix Figure 29 closing backtick/parenthesis.

**Sample fix — List of Figures entries for Chapter 4**

```text
BEFORE:
Figure 9: fig-4-1-wer_by_config.png
Figure 10: fig-4-8-bleu_by_pair.png   ← skips ASR figs 4-2, 4-3, 4-4

AFTER:
Figure 9: English ASR mean WER by configuration
Figure 10: English ASR WER boxplot by configuration
Figure 11: English ASR mean latency by configuration
Figure 12: English ASR WER versus latency trade-off
Figure 13: Translation mean BLEU by language pair
...
```

---

### P1-7. Translation corpus native review pending

| Field | Detail |
|-------|--------|
| **Where** | **Pages 45–46**, **Table 11: Authorship and verification of reference translations** |
| | **Page 89**, Recommendation R-21 |
| **Problem** | Sentences 051–100: `pending_native_review`, *“has not yet been signed off”*, `primary_draft`. |

**How to sort out**

**Option A:** Complete native-speaker review; update table to *verified*.

**Option B:** State in thesis that human evaluation used verified subset only.

**Sample fix — Table 11, rows 051–100**

```text
BEFORE:
Pending independent verification... has not yet been signed off — primary_draft

AFTER:
Sentences 051–100 were used as investigator-authored draft references for automated benchmarking only. Human adequacy/fluency ratings in Section 4.4.1 were conducted on MarianMT outputs derived from the full corpus; native-speaker verification of reference sentences 051–100 was not completed before thesis submission and is listed as a limitation (Section 5.6, item 6).
```

---

### P1-8. Researcher-associated emails in usability data

| Field | Detail |
|-------|--------|
| **Where** | **Page 81**, §4.7.1 Sensitivity check — P11, P12, P26×2, P29 |
| **Problem** | Possible conflict of interest / non-independent participants. |

**How to sort out**

1. Decide primary analysis: **all 20** or **n = 16** excluding researcher emails.
2. State decision clearly in §4.7.1 and use **same n** in Abstract.

**Sample fix**

```text
Primary analysis uses n = 16 independent student responses after excluding four submissions associated with researcher or system email addresses (P11, P12, P26×2, P29). Sensitivity analysis including all 20 responses yielded similar conclusions (SUS mean 60.53 vs 61.50).
```

---

### P1-9. Declaration signatures incomplete

| Field | Detail |
|-------|--------|
| **Where** | **Page 2**, Declaration |
| **Problem** | Blank signature/date lines; typed names below lines (non-standard). |

**How to sort out**

1. Print thesis or use approved digital sign-off process per faculty rules.
2. Student and supervisor **sign on the lines**; fill department and dates.
3. Remove duplicate typed names below if not required by template.

---

## P2 — MEDIUM PRIORITY (polish and consistency)

---

### P2-1. RO-1 and RO-3 “partially met” — tighten wording everywhere

| Field | Detail |
|-------|--------|
| **Where** | **Pages 13–14**, RO-1, RO-3 objectives — *“will be tested in the future”* |
| | **Pages 85–86**, §6.2 Alignment with Objectives |
| **Problem** | Future tense in objectives sounds like incomplete thesis work. |

**Sample fix — RO-1**

```text
BEFORE:
RO-1: ...with Tamil and Sinhala being left for future research.

AFTER:
RO-1: Development and evaluation of an ASR system for English academic voice queries, with Tamil and Sinhala explicitly out of scope for empirical evaluation in this thesis.
```

---

### P2-2. Too many internal repository paths in main text

| Field | Detail |
|-------|--------|
| **Where** | Throughout Chapters 3–4 — e.g. `research/usability-study/...`, `photos-for-thesis/ch4-ui/`, `.py`, `.yaml` |
| **Problem** | Reads like developer documentation, not formal thesis. |

**How to sort out**

1. Main text: refer to **“Appendix H”** or **“project repository”**.
2. Keep full paths only in appendices.

**Sample fix**

```text
BEFORE:
Analysis: research/usability-study/scripts/analyze_usability.py → research/reports/usability_study_report.md

AFTER:
Analysis scripts and exported results are documented in Appendix H (Usability Study Artifacts).
```

---

### P2-3. NLU held-out 100% — clarify H2 basis

| Field | Detail |
|-------|--------|
| **Where** | **Pages 44–45**, Table 7 — 75/78 held-out overlap with training |
| | **Pages 65–66**, §4.3 — held-out 100% intent accuracy |
| **Problem** | Could be seen as overstating NLU performance. |

**Sample fix — §4.3 after held-out mention**

```text
The held-out 77-example set produced 100% intent and entity results; however, as documented in Section 3.6.2, 75 of 78 held-out utterances overlapped with training data. Cross-validation (intent F1 = 0.904) is therefore used as the conservative basis for H2 acceptance.
```

---

### P2-4. Playwright E2E failures — frame as limitation, not pending thesis task

| Field | Detail |
|-------|--------|
| **Where** | **Pages 69–76**, §4.5 System and Functional Testing |
| | **Page 88**, Recommendation R-7 — 22/26 E2E failures |
| **Problem** | Could imply thesis is waiting on test repair. |

**Sample fix — §4.5 summary sentence**

```text
Core authentication, API, and selected UI flows passed verification; the full Playwright regression suite recorded 22 failures in 26 tests due to UI selector drift and is documented as a platform maintenance item rather than a blocker for the research experiments reported in this thesis.
```

---

### P2-5. Abstract minor language issues

| Field | Detail |
|-------|--------|
| **Where** | **Page 3**, Abstract |
| **Problem** | Awkward phrasing; ensure H4/RO-4 claims match final §4.7 wording. |

**Sample fix**

```text
BEFORE:
The results indicate that local AI services can be integrated local AI services with a practical university platform...

AFTER:
The results indicate that local AI services can be integrated with a production-oriented university platform deployed at https://lecstu.com.
```

---

### P2-6. §1.3 Research Aim formatting

| Field | Detail |
|-------|--------|
| **Where** | **Page 13**, §1.3 |
| **Problem** | Aim appears as plain paragraph without clear heading style; minor grammar (*“university system”*). |

**Sample fix**

```text
BEFORE:
Objective of research is to design, develop and evaluate an AI based academic platform to improve accessibility of faculty details and student services in university system.

AFTER:
The aim of this research is to design, develop, and evaluate an AI-based academic platform to improve accessibility to faculty information and student services in a university environment.
```

---

### P2-7. Typo and spacing issues (final proofread)

| Field | Detail |
|-------|--------|
| **Where** | Various — e.g. *“ended questions”* (page 51) → **open-ended**; *“Rasa Technologi es”* in [5]; broken words from line breaks (*transla tion*, *Syst em*) |
| **How to sort out** | Run Word spell-check; search: `TBD`, `Pending`, `will be`, `not yet`, `THESIS INSERT`, `primary_draft`, `We will` |

---

## Quick search checklist (Word Find)

Run these in the `.docx` before final PDF:

| Search term | Expected after fix |
|-------------|-------------------|
| `TBD` | 0 matches |
| `Pending` | 0 matches (except if quoting past status in revision history — avoid) |
| `THESIS INSERT` | 0 matches |
| `will be inserted` | 0 matches |
| `not yet been` | 0 matches |
| `primary_draft` | 0 matches in main tables (or explained in limitations) |
| `We will` | 0 matches in Methodology (use past tense) |
| `[[` | 0 matches |
| `[partial]` | 0 matches |
| `Table 23` near ethics | Should reference Table 12 or 18 |

---

## Suggested fix order (shortest path to sign-off)

| Step | Task | Est. effort |
|------|------|-------------|
| 1 | Obtain ethics approval / exemption letter | External (faculty) |
| 2 | Resolve H4 — Option A or B above | 2–4 hours (A) or 1–2 weeks (B) |
| 3 | Remove/reframe §4.2.1 + Table 28 TBD | 1–2 hours |
| 4 | Fix references [5], [10] + cover + PDF metadata | 30 min |
| 5 | Past-tense Methodology + actual usability description | 2–3 hours |
| 6 | H1 statistics verification + F1 formula label | 1 hour |
| 7 | Figure numbering + List of Figures | 1–2 hours |
| 8 | Formal language pass (§1.5, Acknowledgement, §5.4) | 2–3 hours |
| 9 | Full proofread with search checklist | 1 hour |
| 10 | Supervisor review → print/sign Declaration | As required |

---

## Hypothesis status summary (fill in after fixes)

| ID | Current thesis state | Target final statement |
|----|----------------------|-------------------------|
| **H1** | Partially supported, English only; stats need consistency | Partially supported (English); p and CI aligned |
| **H2** | Accepted (F1 = 0.904) | Accepted on cross-validation; held-out excluded |
| **H3** | Partially addressed | Partially addressed; Tamil/Sinhala not production-ready |
| **H4** | **Missing** | **Must add:** Not tested (Option A) or Accepted/Rejected (Option B) |
| **RO-1** | Partially met | Partially met — English only |
| **RO-2** | Met | Met |
| **RO-3** | Partially met | Partially met |
| **RO-4** | Met (questionnaire) | Met — align with H4 wording |
| **RO-5** | Largely met | Largely met |

---

## Document control

| Item | Value |
|------|-------|
| Created | July 2026 |
| Source analysis | `CSCI 43018-Final Thesis of Shakiththiyan-2026.pdf` (105 pages) |
| Related project files | `newThesisWriting.md`, `research/reports/word_thesis_synced.md` |
| Regenerate PDF extract | `research/reports/pdf_thesis_extract.txt` (from pypdf extraction) |

---

*After completing fixes, export a new PDF and re-run the search checklist. Only then request supervisor final signature.*

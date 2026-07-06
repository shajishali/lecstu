# LECSTU Usability Testing — Google Form Content

**Phase:** 10 — Usability Study (RO-4, RQ-4, H4)  
**Purpose:** Copy-paste content to build Google Forms for **students** and **lecturers**.  
**Platform URL:** https://lecstu.com  
**Session length:** ~45 minutes (tasks on LECSTU + this form at the end)

---

## How to use this file

1. Create **two separate Google Forms** (recommended):
   - `LECSTU Usability — Student`
   - `LECSTU Usability — Lecturer`
2. For each question below, add the matching **Google Form question type**.
3. Use **Linear scale 1–5** unless noted otherwise.
4. Turn **off** “Collect email addresses” for anonymity.
5. Add a **required** consent checkbox in Section 1.
6. Share the form link or QR code **after** the participant finishes tasks on LECSTU.

### Standard 1–5 scale labels (use for all rating questions)

| Value | Label |
|-------|--------|
| **1** | Strongly disagree / Very difficult / Very dissatisfied |
| **2** | Disagree / Difficult / Dissatisfied |
| **3** | Neutral / Moderate / Neither |
| **4** | Agree / Easy / Satisfied |
| **5** | Strongly agree / Very easy / Very satisfied |

For **ease** and **satisfaction** questions, use the right-hand column (Very difficult → Very easy).

---

## Form settings checklist

| Setting | Recommendation |
|---------|----------------|
| Collect emails | **Off** |
| Limit to 1 response | Optional (one device per participant) |
| Edit after submit | Off |
| See summary charts | On (for quick review) |
| Link responses to Sheet | On → store in `research/usability-study/raw-data/` (not in Git) |

---

## Observer sheet (not in Google Form)

Task **times**, **success/fail**, and **error counts** are recorded by the researcher on a separate sheet during the session. Use participant ID (P01, L01) only — no real names in exported Form data.

| Column | Example |
|--------|---------|
| Participant ID | P07 |
| Task | T1 |
| Condition | Manual / AI |
| Time (seconds) | 42 |
| Success | Y / N |
| Errors | 0 |

---

# FORM A — STUDENT QUESTIONNAIRE

**Form title:** LECSTU Usability Study — Student Questionnaire  
**Form description:** Thank you for testing LECSTU. Use the ID on your participant card (e.g. P01). Do not enter your real name. This takes about 10–15 minutes after your task session.

---

## Section 1 — Participant information

**Question type:** Short answer / Multiple choice / Date / Checkbox

### A1. Participant ID *
- **Type:** Short answer  
- **Question:** What is your participant ID? (Example: P01, P02 — use the code on your card, not your name.)  
- **Required:** Yes

### A2. Session date *
- **Type:** Date  
- **Question:** Date of this session  
- **Required:** Yes

### A3. Consent *
- **Type:** Checkbox  
- **Question:** I took part voluntarily. I understand my answers are used for research only and I may withdraw without penalty.  
- **Options:** I agree  
- **Required:** Yes

### A4. Age range *
- **Type:** Multiple choice  
- **Question:** Age range  
- **Options:** 18–21 | 22–25 | 26–30 | 31+  
- **Required:** Yes

### A5. Study programme *
- **Type:** Multiple choice  
- **Question:** Your degree programme  
- **Options:** CS | ET | CT | BS | Other (short answer)  
- **Required:** Yes

### A6. Study year *
- **Type:** Multiple choice  
- **Question:** Current study year  
- **Options:** Year 1 | Year 2 | Year 3 | Year 4  
- **Required:** Yes

### A7. Technology familiarity *
- **Type:** Linear scale 1–5  
- **Question:** How comfortable are you using web apps and smartphones?  
- **Scale:** 1 = Not comfortable at all → 5 = Very comfortable  
- **Required:** Yes

### A8. Primary language *
- **Type:** Multiple choice  
- **Question:** Which language do you prefer for daily university work?  
- **Options:** English | Sinhala | Tamil | Mixed  
- **Required:** Yes

### A9. Used LECSTU before this session? *
- **Type:** Multiple choice  
- **Question:** Had you used LECSTU before today’s session?  
- **Options:** No — first time | Yes — a few times | Yes — regularly  
- **Required:** Yes

---

## Section 2 — Task ratings (Student)

**Section description:** Rate each task you completed today. Skip tasks you did not do.

**Question type for all below:** Linear scale 1–5 (unless noted)

---

### Task T1 — Find your next lecture

| ID | Question | Scale |
|----|----------|-------|
| T1a | **Ease:** How easy was it to find your next lecture? | 1 = Very difficult → 5 = Very easy |
| T1b | **Satisfaction:** How satisfied were you with this task? | 1 = Very dissatisfied → 5 = Very satisfied |
| T1c | **Method used** — **Type:** Multiple choice | Manual (timetable page only) / AI (chatbot) / Both |

---

### Task T2 — Find a free hall right now

| ID | Question | Scale |
|----|----------|-------|
| T2a | **Ease:** How easy was it to find an available hall? | 1–5 |
| T2b | **Satisfaction:** How satisfied were you with this task? | 1–5 |
| T2c | **Method used** — **Type:** Multiple choice | Manual (hall explorer) / AI (voice or chatbot) / Both |

---

### Task T3 — Book appointment with a lecturer

| ID | Question | Scale |
|----|----------|-------|
| T3a | **Ease:** How easy was it to book an appointment? | 1–5 |
| T3b | **Satisfaction:** How satisfied were you with this task? | 1–5 |
| T3c | **Method used** — **Type:** Multiple choice | Manual (booking pages) / AI (chatbot) / Both |

---

### Task T4 — Indoor navigation to a lecture room

| ID | Question | Scale |
|----|----------|-------|
| T4a | **Ease:** How easy was it to get directions inside a building? | 1–5 |
| T4b | **Satisfaction:** How satisfied were you with indoor navigation? | 1–5 |
| T4c | **Method used** — **Type:** Multiple choice | Manual (map / Find My Way) / AI (chatbot + guided route) / Both |

---

### Task T4b — Outdoor campus map (find a building)

| ID | Question | Scale |
|----|----------|-------|
| T4b-a | **Ease:** How easy was it to find a building on the campus map? | 1–5 |
| T4b-b | **Satisfaction:** How satisfied were you with the outdoor map? | 1–5 |
| T4b-c | **Method used** — **Type:** Multiple choice | Manual / AI (voice or chat) / Both |

---

### Task T5 — Ask a question in Sinhala or Tamil (voice)

| ID | Question | Scale |
|----|----------|-------|
| T5a | **Ease:** How easy was it to ask your question by voice? | 1–5 |
| T5b | **Satisfaction:** How satisfied were you with voice input? | 1–5 |
| T5c | **Accuracy:** How well did the system understand you? | 1 = Poor → 5 = Excellent |

*Note: T5 has no manual condition — AI only.*

---

### Task T6 — Switch language and find timetable

| ID | Question | Scale |
|----|----------|-------|
| T6a | **Ease:** How easy was it to switch language and view your timetable? | 1–5 |
| T6b | **Satisfaction:** How satisfied were you with translation / language switch? | 1–5 |
| T6c | **Accuracy:** How accurate was the translated content? | 1 = Poor → 5 = Excellent |

*Note: T6 has no manual condition — AI only.*

---

### Overall task comparison (Student)

| ID | Question | Scale |
|----|----------|-------|
| TC1 | Overall, AI features were **faster** than doing tasks manually. | 1 = Strongly disagree → 5 = Strongly agree |
| TC2 | Overall, AI features were **easier** than manual navigation. | 1–5 |
| TC3 | I would choose AI features again next time. | 1–5 |

---

## Section 3 — System Usability Scale (SUS) — Student

**Section description:** Rate your agreement with each statement about LECSTU overall.  
**Question type:** Linear scale 1–5  
**Scale:** 1 = Strongly disagree → 5 = Strongly agree

| # | Statement |
|---|-----------|
| SUS1 | I think I would like to use this system frequently. |
| SUS2 | I found the system unnecessarily complex. |
| SUS3 | I thought the system was easy to use. |
| SUS4 | I think I would need technical support to use this system. |
| SUS5 | I found the various functions in this system were well integrated. |
| SUS6 | I thought there was too much inconsistency in this system. |
| SUS7 | I would imagine that most people would learn to use this system quickly. |
| SUS8 | I found the system very cumbersome to use. |
| SUS9 | I felt very confident using the system. |
| SUS10 | I needed to learn a lot of things before I could get going with this system. |

**Scoring (for analysis — do not show to participants):**  
Odd items: score − 1. Even items: 5 − score. Sum all × 2.5 = SUS score (0–100). Above 68 = above average.

---

## Section 4 — AI trust scale — Student

**Question type:** Linear scale 1–5  
**Scale:** 1 = Strongly disagree → 5 = Strongly agree

| # | Statement |
|---|-----------|
| AI1 | I trust the voice recognition to understand me correctly. |
| AI2 | I trust the chatbot to give accurate information. |
| AI3 | I trust the translation to be accurate. |
| AI4 | I would use AI features on LECSTU regularly. |
| AI5 | AI features made the platform more accessible for me. |

---

## Section 5 — Feature-specific ratings — Student

**Question type:** Linear scale 1–5  
**Scale:** 1 = Very poor → 5 = Excellent

| ID | Question |
|----|----------|
| F1 | Student dashboard (today’s schedule, quick links) |
| F2 | My Timetable page |
| F3 | Hall availability / booking |
| F4 | Lecturer directory and profiles |
| F5 | Appointment booking |
| F6 | Indoor navigation (Find My Way) |
| F7 | Campus map (outdoor) |
| F8 | Chatbot |
| F9 | Voice input (ASR) |
| F10 | Language translation |

---

## Section 6 — Open opinions — Student

**Question type:** Paragraph (long text). All optional unless you want them required.

### O1. What did you like most about LECSTU?
- **Type:** Paragraph

### O2. What was most frustrating or confusing?
- **Type:** Paragraph

### O3. Which AI feature was most helpful? Why?
- **Type:** Paragraph

### O4. Which AI feature needs the most improvement? Why?
- **Type:** Paragraph

### O5. Any other comments or suggestions?
- **Type:** Paragraph

### O6. Would you recommend LECSTU to other students?
- **Type:** Multiple choice  
- **Options:** Yes, definitely | Probably yes | Not sure | Probably no | No

---

---

# FORM B — LECTURER QUESTIONNAIRE

**Form title:** LECSTU Usability Study — Lecturer Questionnaire  
**Form description:** Thank you for testing LECSTU. Use your participant ID (e.g. L01, L02). Do not enter your real name.

---

## Section 1 — Participant information (Lecturer)

Same as Student **A1–A3**, then:

### B4. Age range *
- Same options as A4

### B5. Department *
- **Type:** Multiple choice  
- **Options:** CS | ET | CT | BS | Other

### B6. Designation *
- **Type:** Multiple choice  
- **Options:** Lecturer | Senior Lecturer | Head of Department | Other

### B7. Technology familiarity *
- Same as A7

### B8. Primary language *
- Same as A8

### B9. Used LECSTU before this session? *
- Same as A9

---

## Section 2 — Task ratings (Lecturer)

Lecturer tasks match Phase 10 goals but reflect **lecturer workflows** on LECSTU.

---

### Task L1 — View today’s / next teaching schedule

| ID | Question | Scale |
|----|----------|-------|
| L1a | **Ease:** How easy was it to see your teaching schedule? | 1–5 |
| L1b | **Satisfaction:** How satisfied were you with the timetable view? | 1–5 |
| L1c | **Method used** — **Type:** Multiple choice | Manual (My Timetable) / AI (chatbot) / Both |

---

### Task L2 — Check or manage hall / room information

| ID | Question | Scale |
|----|----------|-------|
| L2a | **Ease:** How easy was it to find hall or room information? | 1–5 |
| L2b | **Satisfaction:** How satisfied were you with this task? | 1–5 |
| L2c | **Method used** — **Type:** Multiple choice | Manual / AI / Both / Not applicable |

---

### Task L3 — View or respond to student appointment requests

| ID | Question | Scale |
|----|----------|-------|
| L3a | **Ease:** How easy was it to manage appointment requests? | 1–5 |
| L3b | **Satisfaction:** How satisfied were you with the appointment flow? | 1–5 |
| L3c | **Clarity:** How clear was your weekly availability to students? | 1 = Very unclear → 5 = Very clear |

---

### Task L4 — Update profile, office location, or busy times

| ID | Question | Scale |
|----|----------|-------|
| L4a | **Ease:** How easy was it to update your profile or availability? | 1–5 |
| L4b | **Satisfaction:** How satisfied were you with profile / settings? | 1–5 |

---

### Task L5 — Navigate to office or teaching venue (indoor / campus map)

| ID | Question | Scale |
|----|----------|-------|
| L5a | **Ease:** How easy was it to use maps / navigation? | 1–5 |
| L5b | **Satisfaction:** How satisfied were you with navigation? | 1–5 |
| L5c | **Method used** — **Type:** Multiple choice | Manual / AI / Both / Not applicable |

---

### Task L6 — Use chatbot or voice for schedule queries

| ID | Question | Scale |
|----|----------|-------|
| L6a | **Ease:** How easy was it to ask the chatbot (or voice) about your schedule? | 1–5 |
| L6b | **Satisfaction:** How satisfied were you with the chatbot response? | 1–5 |
| L6c | **Accuracy:** How accurate was the information returned? | 1 = Poor → 5 = Excellent |

---

### Task L7 — Language / translation (if tested)

| ID | Question | Scale |
|----|----------|-------|
| L7a | **Ease:** How easy was it to use translation or language switch? | 1–5 |
| L7b | **Satisfaction:** How satisfied were you with translation? | 1–5 |
| L7c | **Accuracy:** How accurate was the translation? | 1–5 |

*Mark optional if not tested with lecturers.*

---

### Overall task comparison (Lecturer)

| ID | Question | Scale |
|----|----------|-------|
| LC1 | Overall, LECSTU saves me time compared to our old ways (email, paper timetable, etc.). | 1–5 |
| LC2 | AI features are useful for my daily work as a lecturer. | 1–5 |
| LC3 | I would use LECSTU regularly if it were fully adopted by the faculty. | 1–5 |

---

## Section 3 — System Usability Scale (SUS) — Lecturer

Use the **same 10 SUS statements** as Section 3 (Student) — SUS1 through SUS10.

---

## Section 4 — AI trust scale — Lecturer

Use the **same 5 AI statements** as Section 4 (Student) — AI1 through AI5.

Additional lecturer-specific item (optional):

| # | Statement | Scale |
|---|-----------|-------|
| AI6 | I trust LECSTU to show correct availability to students when they book appointments. | 1–5 |

---

## Section 5 — Feature-specific ratings — Lecturer

**Scale:** 1 = Very poor → 5 = Excellent

| ID | Question |
|----|----------|
| LF1 | Lecturer dashboard |
| LF2 | My Timetable (teaching schedule) |
| LF3 | Appointment management (requests / approvals) |
| LF4 | Profile and weekly availability display |
| LF5 | Lecturer directory (if you viewed it as a student would) |
| LF6 | Indoor / campus navigation |
| LF7 | Chatbot for academic queries |
| LF8 | Voice input (ASR) |
| LF9 | Notifications (appointments, timetable changes) |
| LF10 | Overall admin clarity (if you tested admin features: N/A checkbox) |

---

## Section 6 — Open opinions — Lecturer

### OL1. What did you like most about LECSTU as a lecturer?
- **Type:** Paragraph

### OL2. What was most frustrating or confusing?
- **Type:** Paragraph

### OL3. Does the appointment / availability system work well for you and your students? Explain.
- **Type:** Paragraph

### OL4. Which feature would help you most if improved?
- **Type:** Paragraph

### OL5. Would you encourage students to use LECSTU? Why or why not?
- **Type:** Paragraph

### OL6. Any other comments?
- **Type:** Paragraph

### OL7. Would you recommend LECSTU to colleagues?
- **Type:** Multiple choice  
- **Options:** Yes, definitely | Probably yes | Not sure | Probably no | No

---

---

# Quick reference — Task list for facilitator

Give participants these tasks **on LECSTU** before they open the form. Counterbalance Manual vs AI order where both apply.

## Student task script

| Task | Instruction (Manual) | Instruction (AI) |
|------|---------------------|----------------|
| **T1** | Open My Timetable and find your next lecture today. | Ask the chatbot: “What is my next lecture?” |
| **T2** | Use Hall Explorer to find a free hall now. | Use voice or chatbot: “Which hall is free now?” |
| **T3** | Book an appointment with a lecturer from their profile. | Ask chatbot to help book an appointment. |
| **T4** | Use Find My Way to navigate to your next class room indoors. | Use chatbot + guided route to the same room. |
| **T4b** | Find the CS building on the campus map. | Ask chatbot/voice for directions to CS building. |
| **T5** | *(skip manual)* | Ask a question in Sinhala or Tamil using voice. |
| **T6** | *(skip manual)* | Switch UI language and view your timetable. |

## Lecturer task script

| Task | Instruction |
|------|-------------|
| **L1** | Open My Timetable — confirm today’s teaching slots. |
| **L2** | Check hall / room info relevant to your teaching. |
| **L3** | Open Appointments — view or respond to a student request. |
| **L4** | Update profile, office, or mark a busy time slot. |
| **L5** | Use map / Find My Way to a teaching venue or office. |
| **L6** | Ask chatbot: “What is my schedule on Friday?” |
| **L7** | *(optional)* Test translation or Sinhala/Tamil interface. |

---

# Participant ID scheme

| Role | ID format | Example |
|------|-----------|---------|
| Student | P01 – P15 (or P20+) | P07 |
| Lecturer | L01 – L05 | L02 |

Keep a **private master list** (real name ↔ ID) outside Google Forms and outside Git.

---

# Data storage

| Item | Location |
|------|----------|
| Google Form export (CSV) | `research/usability-study/raw-data/` |
| Observer task times | `research/usability-study/raw-data/task-times-*.csv` |
| Consent forms (paper) | `research/usability-study/instruments/` |

Do **not** commit files containing real names or email addresses to Git.

---

# Related documents

- [phases.md](../../phases.md) — Phase 10 full plan  
- [ethics_plan.md](./instruments/ethics_plan.md) — consent and data protection  
- [usability_report_template.md](../templates/usability_report_template.md) — analysis report  
- [problemFacedWhenHosting.md](../../problemFacedWhenHosting.md) — production URL and known issues  

---

*LECSTU Usability Testing Content v1.0 — Phase 10.1 — July 2026*

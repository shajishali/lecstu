# LECSTU — Photos & Screenshots for Thesis

**Purpose:** Central checklist of every figure/image needed for `thesisWriting.md`.  
**How to use:** Copy images into Word. Under each photo, paste the **Thesis note (paste under figure)** text as the caption.  
**Platform:** https://lecstu.com  
**Draft date:** 8 July 2026  
**Project root:** `d:\Reasearch\lecstu\`

---

## Capture rules (read once)

| Rule | Detail |
|---|---|
| Resolution | Prefer 1920×1080 or higher; crop only for focus |
| Consistency | Same browser zoom (100%), same theme, same demo account set |
| Anonymize | Blur real emails, phone numbers, tokens, DB URLs, student IDs |
| Format | PNG for UI/screenshots; SVG/PDF/PNG for diagrams |
| Paste note | Use the **Thesis note** block under each photo as the Word caption |
| Address | Every photo lists **Photo address** (full path). READY = existing file; CREATE/CAPTURE = save new files here |

**Regenerate diagrams:** `python scripts\generate_thesis_diagrams.py`

```
d:\Reasearch\lecstu\photos-for-thesis\
  ch1\
  ch3\
  ch4-asr\          (or use research charts already in repo)
  ch4-nlp\
  ch4-translation\
  ch4-ui\
  appendix\
```

---

## Status legend

| Status | Meaning |
|---|---|
| READY | File already exists — path below is where it is now |
| CREATE | Draw the diagram and save it to the address below |
| CAPTURE | Take screenshot and save it to the address below |
| OPTIONAL | Appendix / evidence only |

---

# Chapter 1 — Introduction

## Figure 1.1 — Problem context diagram

| Field | Detail |
|---|---|
| **Status** | READY |
| **What to create** | Left = fragmented channels (help desk, timetable PDF, directory, map, notices). Right = one LECSTU interface. Arrows converge. |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch1\fig-1-1-problem-context.png` |
| **Filename** | `fig-1-1-problem-context.png` |

**Thesis note (paste under figure):**  
Figure 1.1 — Fragmented university information channels consolidated into the LECSTU platform. Currently, students depend on separate systems for timetables, staff information, maps, and notices. LECSTU unifies these services in a single academic interface.

---

# Chapter 3 — Methodology (diagrams)

## Figure 3.1 — DSR process

| Field | Detail |
|---|---|
| **Status** | READY |
| **What** | Problem → Objectives → Design → Implementation → Component evaluation → Usability evaluation → Refinement |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-1-dsr-process.png` |
| **Filename** | `fig-3-1-dsr-process.png` |

**Thesis note (paste under figure):**  
Figure 3.1 — Design Science Research process adapted for LECSTU. The study builds the platform as a research artifact and evaluates it through ASR, chatbot, translation, and planned usability experiments.

---

## Figure 3.2 — Use-case diagram

| Field | Detail |
|---|---|
| **Status** | READY |
| **Actors** | Student, Lecturer, Administrator; ASR, Rasa, Translation |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-2-use-case.png` |
| **Filename** | `fig-3-2-use-case.png` |

**Thesis note (paste under figure):**  
Figure 3.2 — Primary LECSTU use cases and actors. Students, lecturers, and administrators interact with academic logistics, navigation, and AI-assisted services through role-based access.

---

## Figure 3.3 — System architecture

| Field | Detail |
|---|---|
| **Status** | READY |
| **Show** | React client → Express API → PostgreSQL; Rasa; ASR :8001; Timetable extract :8002; Floor-plan vision :8003; Indoor-nav :8004; Translation |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-3-system-architecture.png` |
| **Filename** | `fig-3-3-system-architecture.png` |
| **Help files** | `d:\Reasearch\lecstu\technologyStack.md`, `d:\Reasearch\lecstu\docs\indoor-navigation\ARCHITECTURE.md` |

**Thesis note (paste under figure):**  
Figure 3.3 — LECSTU system architecture. The React client communicates with an Express REST API and PostgreSQL database, while ASR, translation, floor-plan vision, indoor navigation, and Rasa operate as independent AI microservices.

---

## Figure 3.4 — Deployment diagram

| Field | Detail |
|---|---|
| **Status** | READY |
| **Show** | https://lecstu.com, Nginx, Node/PM2, PostgreSQL, AI services, HTTPS |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-4-deployment.png` |
| **Filename** | `fig-3-4-deployment.png` |
| **Related hosting shots (optional)** | `d:\Reasearch\lecstu\hosting-screenshots\` |

**Thesis note (paste under figure):**  
Figure 3.4 — Production deployment of LECSTU at https://lecstu.com. The figure shows the hosted frontend, backend, database, and supporting AI services under HTTPS, without exposing credentials or internal secrets.

---

## Figure 3.5 — ER diagram

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-5-er-diagram.png` |
| **Filename** | `fig-3-5-er-diagram.png` |
| **Help files** | `d:\Reasearch\lecstu\docs\indoor-navigation\ER-DIAGRAM.md`, `d:\Reasearch\lecstu\server\prisma\schema.prisma` |

**Thesis note (paste under figure):**  
Figure 3.5 — Entity–relationship model of LECSTU. The schema stores users and roles, academic structures, timetables, appointments, notifications, buildings, floor plans, navigation nodes and edges, and QR positioning data.

---

## Figure 3.6 — Chatbot sequence diagram

| Field | Detail |
|---|---|
| **Status** | READY |
| **Flow** | User → ASR (optional) → Rasa → custom action → Express → DB/navigation → English response |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-6-chatbot-sequence.png` |
| **Filename** | `fig-3-6-chatbot-sequence.png` |

**Thesis note (paste under figure):**  
Figure 3.6 — Sequence for text or voice chatbot queries using live institutional data. Predicted intents invoke custom actions that retrieve current timetable, availability, appointment, or navigation information from the backend.

---

## Figure 3.7 — Indoor navigation pipeline

| Field | Detail |
|---|---|
| **Status** | READY |
| **Flow** | Floor-plan upload → OCR/vision → admin correction → graph publish → QR → A*/Dijkstra → route overlay |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-7-indoor-nav-pipeline.png` |
| **Filename** | `fig-3-7-indoor-nav-pipeline.png` |

**Thesis note (paste under figure):**  
Figure 3.7 — Indoor navigation pipeline. Floor-plan analysis assists administrators during setup, while published routes are computed from a reviewed graph using A* (or Dijkstra fallback), QR positioning, and turn-by-turn guidance.

---

# Chapter 4 — ASR results (READY)

## Figure 4.1 — WER by configuration

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-1-wer_by_config.png` |
| **Original source** | `d:\Reasearch\lecstu\research\asr-benchmark\results\wer_by_config.png` |

**Thesis note (paste under figure):**  
Figure 4.1 — Mean English word error rate (WER) by ASR configuration. Whisper medium achieved the lowest mean WER (0.0410), followed by Whisper small and base, while Google Speech-to-Text and the tiny models showed higher error rates.

---

## Figure 4.2 — WER boxplot

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-2-wer_boxplot.png` |
| **Original source** | `d:\Reasearch\lecstu\research\asr-benchmark\results\wer_boxplot.png` |

**Thesis note (paste under figure):**  
Figure 4.2 — Distribution of English WER across ASR configurations. The boxplots show variation and outliers by model size and engine, supporting comparison beyond mean values alone.

---

## Figure 4.3 — Latency by configuration

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-3-latency_by_config.png` |
| **Original source** | `d:\Reasearch\lecstu\research\asr-benchmark\results\latency_by_config.png` |

**Thesis note (paste under figure):**  
Figure 4.3 — Mean English ASR latency by configuration. Smaller Whisper models respond faster, whereas Whisper medium incurs substantially higher latency despite better accuracy, illustrating a practical deployment trade-off.

---

## Figure 4.4 — WER vs latency

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-4-wer_vs_latency.png` |
| **Original source** | `d:\Reasearch\lecstu\research\asr-benchmark\results\wer_vs_latency.png` |

**Thesis note (paste under figure):**  
Figure 4.4 — Accuracy–latency trade-off for English ASR configurations. The plot shows that lower WER is associated with higher mean latency for larger Whisper models, so interactive deployments must balance quality against response time.

---

# Chapter 4 — NLU / Rasa results (READY)

## Figure 4.5 — Intent confusion matrix

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\fig-4-5-intent_confusion_matrix.png` |
| **Original source** | `d:\Reasearch\lecstu\research\nlp-evaluation\results\cv-5fold\intent_confusion_matrix.png` |

**Thesis note (paste under figure):**  
Figure 4.5 — Intent confusion matrix from five-fold cross-validation. Most core academic intents are classified correctly, with notable confusion between appointment booking and lecturer availability requests.

---

## Figure 4.6 — Entity confusion matrix

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\fig-4-6-entity_confusion_matrix.png` |
| **Original source** | `d:\Reasearch\lecstu\research\nlp-evaluation\results\cv-5fold\DIETClassifier_confusion_matrix.png` |

**Thesis note (paste under figure):**  
Figure 4.6 — Entity extraction confusion matrix (DIETClassifier, five-fold CV). Entities such as lecturer name, day, and time are extracted reliably, while course names and building/hall distinctions remain more challenging.

---

## Figure 4.7 — Intent histogram

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\fig-4-7-intent_histogram.png` |
| **Original source** | `d:\Reasearch\lecstu\research\nlp-evaluation\results\cv-5fold\intent_histogram.png` |

**Thesis note (paste under figure):**  
Figure 4.7 — Intent prediction distribution from five-fold cross-validation. The histogram supports per-intent diagnostics and confirms strong overall performance for the domain-specific Rasa model.

---

### Optional NLU extras (Appendix E)

| Extra | Photo address |
|---|---|
| Held-out intent confusion | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\extra-heldout-intent_confusion_matrix.png` |
| Held-out entity confusion | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\extra-heldout-entity_confusion_matrix.png` |
| Held-out intent histogram | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\extra-heldout-intent_histogram.png` |

---

# Chapter 4 — Translation results (READY)

## Figure 4.8 — BLEU by language pair

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\fig-4-8-bleu_by_pair.png` |
| **Original source** | `d:\Reasearch\lecstu\research\translation-eval\results\bleu_by_pair.png` |

**Thesis note (paste under figure):**  
Figure 4.8 — Mean BLEU score by language direction for MarianMT. BLEU values are low for short, morphologically rich academic sentences, so BLEU alone is insufficient for judging translation quality in this study.

---

## Figure 4.9 — Semantic similarity by language pair

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\fig-4-9-similarity_by_pair.png` |
| **Original source** | `d:\Reasearch\lecstu\research\translation-eval\results\similarity_by_pair.png` |

**Thesis note (paste under figure):**  
Figure 4.9 — Mean semantic similarity by language direction for MarianMT. English-to-Sinhala and English-to-Tamil show relatively high similarity, while Sinhala-to-Tamil remains weak and is not treated as production-ready.

---

## Figure 4.10 — Latency by language pair

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\fig-4-10-latency_by_pair.png` |
| **Original source** | `d:\Reasearch\lecstu\research\translation-eval\results\latency_by_pair.png` |

**Thesis note (paste under figure):**  
Figure 4.10 — Mean translation latency by language direction for MarianMT. Pivot translations and hardware warm-up contribute to latency variation across pairs.

---

## Extra A — Human scores boxplot

| Field | Detail |
|---|---|
| **Status** | READY (recommended) |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\extra-A-human_scores_boxplot.png` |
| **Original source** | `d:\Reasearch\lecstu\research\translation-eval\results\human_scores_boxplot.png` |

**Thesis note (paste under figure):**  
Figure 4.A — Human evaluation scores for MarianMT translations. Five blind raters scored fluency, adequacy, and overall quality; mean overall quality was moderate (approximately 3.76/5.0).

---

## Extra B — Automated vs human scatter

| Field | Detail |
|---|---|
| **Status** | READY (recommended) |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\extra-B-automated_vs_human_scatter.png` |
| **Original source** | `d:\Reasearch\lecstu\research\translation-eval\results\automated_vs_human_scatter.png` |

**Thesis note (paste under figure):**  
Figure 4.B — Relationship between automated metrics and human overall scores. Semantic similarity correlates strongly with human ratings, whereas BLEU shows little association with human judgment for these academic sentences.

---

## Extra C — Speed vs quality

| Field | Detail |
|---|---|
| **Status** | READY (recommended) |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\extra-C-speed_vs_quality.png` |
| **Original source** | `d:\Reasearch\lecstu\research\translation-eval\results\speed_vs_quality.png` |

**Thesis note (paste under figure):**  
Figure 4.C — Translation speed–quality trade-off for MarianMT. The plot positions language directions by mean latency and mean semantic similarity, informing interactive versus asynchronous translation use.

---

# Chapter 4 — UI screenshots (CAPTURE)

Save new screenshots to the addresses below (create the folders if missing).

## Figure 4.11 — Login / registration

| Field | Detail |
|---|---|
| **Status** | Ready (interim — registration screen; replace with production login if required) |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-11-login-register.png` |

**Thesis note (paste under figure):**  
Figure 4.11 — Authentication interface of LECSTU. Login and registration enforce role-based access for students, lecturers, and administrators before academic or AI features can be used.

---

## Figure 4.12 — Student dashboard

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-12-student-dashboard.png` |
| **Reference (old shot)** | `d:\Reasearch\lecstu\hosting-screenshots\dev-fix12-dashboard-all-done-greeting.png` |

**Thesis note (paste under figure):**  
Figure 4.12 — Student dashboard summarizing the user’s academic day. The dashboard provides a single entry point to timetable context, campus navigation, and related student services.

---

## Figure 4.13 — Personalized timetable

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-13-timetable.png` |
| **Reference (old shot)** | `d:\Reasearch\lecstu\hosting-screenshots\phase8-04-tomorrow-timetable-test.png` |

**Thesis note (paste under figure):**  
Figure 4.13 — Personalized student timetable generated from master schedule data. The view presents the authenticated student’s enrolled classes rather than a generic faculty-wide document.

---

## Figure 4.14 — Hall availability

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-14-hall-availability.png` |

**Thesis note (paste under figure):**  
Figure 4.14 — Hall availability view for academic space planning. Students and staff can identify free halls without manually checking multiple timetable sources.

---

## Figure 4.15 — Lecturer directory / profile

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-15-lecturer-directory.png` |

**Thesis note (paste under figure):**  
Figure 4.15 — Lecturer directory supporting staff discovery and office location. The interface connects lecturer identity information to availability and appointment workflows.

---

## Figure 4.16 — Appointment booking and notification

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-16-appointment-notification.png` |

**Thesis note (paste under figure):**  
Figure 4.16 — Appointment booking with real-time notification feedback. Students can request meetings with lecturers, and status updates are delivered through the platform’s notification stream.

---

## Figure 4.17 — Campus map

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-17-campus-map.png` |

**Thesis note (paste under figure):**  
Figure 4.17 — Outdoor campus map with building markers. Leaflet-based mapping helps users locate faculty buildings before entering indoor floor-plan navigation.

---

## Figure 4.18 — Indoor guided route

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-18-indoor-guided-route.png` |
| **Reference (old shots)** | `d:\Reasearch\lecstu\hosting-screenshots\dev-fix09-dashboard-indoor-nav-before.png`, `d:\Reasearch\lecstu\hosting-screenshots\dev-fix10-dashboard-places-dropdown.png`, `d:\Reasearch\lecstu\hosting-screenshots\dev-fix11-dashboard-floor-select.png` |

**Thesis note (paste under figure):**  
Figure 4.18 — Indoor guided route with graph-based path overlay. The route is computed on a published navigation graph and shown as step-by-step guidance, including floor transitions where required.

---

## Figure 4.19 — Chatbot with live data

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-19-chatbot-live.png` |
| **Reference (old shots)** | `d:\Reasearch\lecstu\hosting-screenshots\phase8-07-confirm-friday-prompt.png`, `d:\Reasearch\lecstu\hosting-screenshots\phase8-04-tomorrow-timetable-test.png` |

**Thesis note (paste under figure):**  
Figure 4.19 — Domain chatbot answering from live platform data. Unlike a static FAQ bot, LECSTU resolves timetable, availability, appointment, and direction intents through authenticated backend services.

---

## Figure 4.20 — Voice / translation interface

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-20-voice-translation.png` |

**Thesis note (paste under figure):**  
Figure 4.20 — Voice input interface for AI-assisted academic queries. Speech is transcribed through the ASR service and can be forwarded to the chatbot; English is the primary operational language of the deployed system.

---

# Appendix images (OPTIONAL)

## Appendix I.1 — Admin floor plan editor

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\appendix\app-admin-floor-plan.png` |

**Thesis note (paste under figure):**  
Appendix Figure I.1 — Administrator floor-plan management interface. Administrators upload and calibrate building floor plans used by the indoor navigation module.

---

## Appendix I.2 — Admin navigation graph

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\appendix\app-admin-nav-graph.png` |

**Thesis note (paste under figure):**  
Appendix Figure I.2 — Administrator navigation-graph review and publish workflow. Detected rooms and corridors can be corrected before the graph is published for student routing.

---

## Appendix I.3 — Admin master timetable

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\appendix\app-admin-timetable.png` |

**Thesis note (paste under figure):**  
Appendix Figure I.3 — Administrator master timetable management. Master schedule entries form the source data for personalized student timetables and availability calculations.

---

## Appendix I.4 — Lecturer appointments

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\appendix\app-lecturer-appointments.png` |

**Thesis note (paste under figure):**  
Appendix Figure I.4 — Lecturer appointment management view. Lecturers can review and respond to student meeting requests through role-restricted workflows.

---

## Appendix H.1 — Playwright test report

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\appendix\app-playwright-report.png` |

**Thesis note (paste under figure):**  
Appendix Figure H.1 — Summary of automated Playwright end-to-end tests. Critical workflows such as timetable display, enrollment synchronization, floor-plan alignment, and password reset are covered by executable browser tests.

---

## Appendix H.2 — Production HTTPS site

| Field | Detail |
|---|---|
| **Status** | CAPTURE |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\appendix\app-production-https.png` |

**Thesis note (paste under figure):**  
Appendix Figure H.2 — Production deployment of LECSTU served over HTTPS at https://lecstu.com. The live site confirms that the research artifact is operable beyond a local development environment.

---

## Branding — Logo

| Field | Detail |
|---|---|
| **Status** | READY |
| **Photo address** | `d:\Reasearch\lecstu\photos-for-thesis\branding\logo.png` |
| **Original sources** | `d:\Reasearch\lecstu\logo.png`, `d:\Reasearch\lecstu\client\public\logo.png` |

**Thesis note (paste under figure):**  
Figure (Front matter / Appendix) — LECSTU system logo used on the production platform and thesis supplementary materials.

---

# Quick address index (all photos)

| Figure | Full path |
|---|---|
| 1.1 | `d:\Reasearch\lecstu\photos-for-thesis\ch1\fig-1-1-problem-context.png` |
| 3.1 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-1-dsr-process.png` |
| 3.2 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-2-use-case.png` |
| 3.3 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-3-system-architecture.png` |
| 3.4 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-4-deployment.png` |
| 3.5 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-5-er-diagram.png` |
| 3.6 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-6-chatbot-sequence.png` |
| 3.7 | `d:\Reasearch\lecstu\photos-for-thesis\ch3\fig-3-7-indoor-nav-pipeline.png` |
| 4.1 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-1-wer_by_config.png` |
| 4.2 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-2-wer_boxplot.png` |
| 4.3 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-3-latency_by_config.png` |
| 4.4 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-asr\fig-4-4-wer_vs_latency.png` |
| 4.5 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\fig-4-5-intent_confusion_matrix.png` |
| 4.6 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\fig-4-6-entity_confusion_matrix.png` |
| 4.7 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-nlp\fig-4-7-intent_histogram.png` |
| 4.8 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\fig-4-8-bleu_by_pair.png` |
| 4.9 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\fig-4-9-similarity_by_pair.png` |
| 4.10 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\fig-4-10-latency_by_pair.png` |
| Extra A | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\extra-A-human_scores_boxplot.png` |
| Extra B | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\extra-B-automated_vs_human_scatter.png` |
| Extra C | `d:\Reasearch\lecstu\photos-for-thesis\ch4-translation\extra-C-speed_vs_quality.png` |
| 4.11 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-11-login-register.png` |
| 4.12 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-12-student-dashboard.png` |
| 4.13 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-13-timetable.png` |
| 4.14 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-14-hall-availability.png` |
| 4.15 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-15-lecturer-directory.png` |
| 4.16 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-16-appointment-notification.png` |
| 4.17 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-17-campus-map.png` |
| 4.18 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-18-indoor-guided-route.png` |
| 4.19 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-19-chatbot-live.png` |
| 4.20 | `d:\Reasearch\lecstu\photos-for-thesis\ch4-ui\fig-4-20-voice-translation.png` |
| Logo | `d:\Reasearch\lecstu\photos-for-thesis\branding\logo.png` |

---

# Master checklist

### Diagrams — DONE (in `photos-for-thesis\ch1\` and `ch3\`)
- [x] Fig 1.1
- [x] Fig 3.1–3.7

### Charts already ready (open address, insert in Word, paste thesis note)
- [ ] Fig 4.1–4.10 + Extra A/B/C

### UI screenshots → save under `photos-for-thesis\ch4-ui\`
- [x] Fig 4.11–4.20 (interim sources in `photos-for-thesis/ch4-ui/`; re-capture 4.14, 4.18 from production optional)

### Appendix → save under `photos-for-thesis\appendix\`
- [ ] Admin / lecturer / Playwright / HTTPS shots

---

# How to paste in Word

1. Open the **Photo address** in File Explorer.  
2. Insert the image into Word.  
3. Copy the **Thesis note (paste under figure)** text under it.  
4. Keep figure numbers consistent with your List of Figures.

*End of photosForThesis.md*

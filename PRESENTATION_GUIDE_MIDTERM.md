# LECSTU Midterm Progress Review — Presentation Guide

**Project:** Smart Faculty Access & Student Assistant System (LECSTU)  
**Student:** P. Shakiththiyan (CS/2020/063)  
**Supervisor:** Mr. Kesavan Selvarajah

---

## 1. How to Start the Presentation

### Opening (30 seconds)
- **Greet** the panel and introduce yourself.
- **State the project name** clearly: *"Smart Faculty Access & Student Assistant System — LECSTU."*
- **Brief hook:** *"Today I'll present the midterm progress of our AI-integrated university platform that combines speech recognition, NLP chatbot, and multilingual support for faculty and students."*

### Before You Begin
- Ensure the **live demo** is ready (server + client running).
- Have **VS Code** or your IDE open with the project structure visible.
- Keep **research results** (e.g. `wer_vs_latency.png`, benchmark JSON) ready to show if asked.

---

## 2. Slide-by-Slide Presentation Guide

### Slide 1 — Title Slide
**What to say:**
- *"This is the Smart Faculty Access & Student Assistant System, LECSTU. I'm P. Shakiththiyan, supervised by Mr. Kesavan Selvarajah."*
- Keep it short; move to the next slide.

---

### Slide 2 — Introduction & Motivation
**What to say:**
- *"University systems today are fragmented — Moodle for courses, separate systems for timetables, halls, and appointments. There's limited AI-driven automation and no integrated multilingual voice and chatbot support. This creates poor accessibility for students and faculty."*
- **Additional point:** *"LECSTU aims to unify these workflows and add AI capabilities: voice input in English, Tamil, and Sinhala, plus an NLP chatbot for academic queries."*

---

### Slide 3 — Literature Review & Research Gap
**What to say:**
- *"We reviewed Moodle, Google Assistant, Rasa, and mBART. Each addresses part of the problem but none provides a unified AI ecosystem for university use."*
- **Key gap:** *"There is no integrated system combining ASR, NLP chatbot, and multilingual translation in a university context. There's also limited research on English–Tamil–Sinhala AI integration in academic environments."*

---

### Slide 4 — Research Objectives (RO1–RO5)
**What to say:**
- *"We have five research objectives:*
  - *RO1: Evaluate multilingual ASR systems*
  - *RO2: Develop and evaluate the NLP chatbot*
  - *RO3: Compare translation models*
  - *RO4: Measure usability impact*
  - *RO5: Develop the integrated LECSTU platform"*
- **Additional point:** *"RO5 is complete — the platform is built and integrated. RO1 (ASR) is done. RO2 and RO3 are ongoing."*

---

### Slide 5 — Methodology & Research Design
**What to say:**
- *"We use Design Science Research — we design, build, and evaluate an AI-integrated university system."*
- *"The system development includes faculty and student modules, with integration of ASR, NLP chatbot, and multilingual translation."*

---

### Slide 6 — Experimental Evaluation
**What to say:**
- *"ASR is evaluated using Word Error Rate and latency. The chatbot uses accuracy and F1-score. Translation uses BLEU score."*
- *"For usability, we plan a within-subject design with 20+ participants and the System Usability Scale (SUS)."*

---

### Slide 7 — System Development Progress (RO5)
**What to say:**
- *"The LECSTU platform is fully developed. Completed modules include:*
  - *Role-based authentication (Admin, Lecturer, Student)*
  - *Faculty and student dashboards*
  - *Appointment booking with admin approval workflow*
  - *Hall availability module*
  - *Notification system*
  - *Campus map with markers*
  - *Voice Assistant with multi-engine ASR*
  - *Rasa chatbot integration"*
- **Demo:** Show the live app — login, dashboard, appointments, Voice Assistant, chatbot.

---

### Slide 8 — ASR Evaluation (RO1) & NLP Chatbot (RO2)
**What to say:**
- **ASR:** *"We evaluated Whisper (including a fine-tuned model), Google Speech, and Azure Speech. We measured WER, latency, and ran statistical tests. Results show trade-offs between accuracy and speed — I can show the WER vs. latency plot."*
- **NLP:** *"We use Rasa. Intent design is done, the training dataset is prepared, the model is trained, and evaluation is ongoing. Intents include ask_timetable, book_appointment, ask_hall_availability, and more."*

---

### Slide 9 — Progress vs Timeline
**What to say:**
- *"Completed: system development, ASR evaluation. Ongoing: NLP evaluation, translation benchmarking. Remaining: usability study and final statistical validation."*
- **Additional point:** *"We're on schedule. The next major milestone is the usability study with real users."*

---

### Slide 10 — Conclusion
**What to say:**
- *"LECSTU is fully developed with AI modules integrated. ASR evaluation is complete. NLP and translation components are progressing. The project is on schedule. Next steps: complete AI evaluations, run the usability study, and finalize statistical analysis."*

---

### Slide 11 — Thank You
- *"Thank you. I'm happy to answer questions or give a live demo."*

---

## 3. Additional Things to Tell (If Time Permits)

1. **Tech stack:** React + TypeScript (client), Node.js + Express (server), Prisma + PostgreSQL, Rasa (chatbot), Whisper/Google/Azure (ASR).
2. **Multilingual support:** Voice Assistant supports English, Tamil, and Sinhala; chatbot handles academic intents.
3. **Fine-tuned Whisper:** Domain-specific model trained on academic utterances (e.g. `lecstu-whisper-tiny-en-ta-si`).
4. **Appointment workflow:** Student → Admin approval → Lecturer acceptance → Confirmation.
5. **Research rigor:** WER calculator, BLEU calculator, classification metrics, benchmark scripts, and reproducible experiments.

---

## 4. Possible Supervisor Questions & Answers

### System & Architecture

**Q: How does the system architecture work?**  
**A:** *"We have a React frontend, Node.js/Express backend, PostgreSQL via Prisma, and separate AI services: ASR (Python/Whisper/Google/Azure) and Rasa chatbot. The server orchestrates API calls to these services."*

**Q: How is the appointment booking workflow designed?**  
**A:** *"Students request appointments. Admins approve or reject first. Approved requests go to lecturers, who accept or propose a new time. Students get notifications at each step."*

**Q: How do you ensure security?**  
**A:** *"We use JWT-based authentication, role-based access (Admin/Lecturer/Student), and protected routes. Sensitive operations require appropriate roles."*

---

### ASR (RO1)

**Q: What ASR engines did you evaluate?**  
**A:** *"Whisper (base, tiny, small, medium), fine-tuned Whisper for academic domain, Google Cloud Speech, and Azure Speech. We compared WER and latency."*

**Q: What is WER and why use it?**  
**A:** *"Word Error Rate measures transcription accuracy: (substitutions + insertions + deletions) / reference length. Lower WER means better accuracy. It's the standard metric for ASR evaluation."*

**Q: What did the WER vs. latency results show?**  
**A:** *"Some configurations achieve very low WER with low latency (around 1.7–1.8 seconds). Others trade speed for accuracy or vice versa. We use this to choose suitable engines for real-time vs. batch use cases."*

**Q: Why fine-tune Whisper?**  
**A:** *"Academic vocabulary (course names, lecturer names, hall names) is domain-specific. Fine-tuning on our utterances improves recognition for LECSTU use cases."*

---

### NLP Chatbot (RO2)

**Q: What intents does the chatbot support?**  
**A:** *"ask_timetable, ask_hall_availability, ask_lecturer_availability, book_appointment, cancel_appointment, ask_directions, ask_office_location, plus greeting, goodbye, fallback, and out_of_scope."*

**Q: How does the chatbot connect to the platform?**  
**A:** *"Rasa custom actions call our platform API. We use CHATBOT_API_KEY for authentication. The chat widget sends user_id so actions can fetch personalized data (e.g. timetable, appointments)."*

**Q: What entities do you extract?**  
**A:** *"course_name, lecturer_name, hall_name, day, time, building."*

---

### Translation (RO3)

**Q: What translation models are you comparing?**  
**A:** *"mBART and baseline cloud APIs. We have parallel datasets and BLEU/similarity metrics defined. Performance testing is ongoing."*

**Q: What is BLEU score?**  
**A:** *"BLEU measures translation quality using n-gram precision against reference translations. Higher BLEU (0–1) indicates better translation quality."*

---

### Usability (RO4)

**Q: When will the usability study run?**  
**A:** *"After AI evaluations are complete. We plan a within-subject design with 20+ participants and the System Usability Scale (SUS)."*

**Q: What will you measure in the usability study?**  
**A:** *"Task completion, SUS scores, and qualitative feedback on the integrated system, including voice and chatbot features."*

---

### General

**Q: What challenges did you face?**  
**A:** *"Integrating multiple AI services (ASR, Rasa) with the main platform, managing different Python/Node environments, and preparing domain-specific datasets for fine-tuning and evaluation."*

**Q: What is your timeline for completion?**  
**A:** *"Complete NLP and translation evaluations, run the usability study, perform statistical analysis, and write the thesis. We're on track for the planned completion date."*

---

## 5. Files to Showcase (Project Folder Structure)

### High-priority — Show these first

| Path | Purpose |
|------|---------|
| `client/src/App.tsx` | Main app routes, all modules (dashboard, appointments, Voice Assistant, chatbot, etc.) |
| `server/prisma/schema.prisma` | Data model: users, appointments, halls, timetable, notifications |
| `ai-services/asr/README.md` | ASR service: Whisper, Google, Azure; English/Tamil/Sinhala |
| `ai-services/chatbot/README.md` | Rasa chatbot setup, intents, API integration |
| `ai-services/chatbot/domain.yml` | Chatbot intents and entities |
| `client/src/pages/VoiceAssistant.tsx` | Voice Assistant UI with engine/language selection |
| `research/asr-benchmark/results/wer_vs_latency.png` | ASR evaluation: WER vs. latency trade-off |
| `research/asr-benchmark/results/wer_by_config.png` | WER by ASR configuration |
| `package.json` (root) | Monorepo scripts: dev, asr, build |

### NLP Chatbot — Dedicated Showcase (RO2)

**Where to showcase implementation, trained model, and output for the supervisor:**

| What to Show | Path | What It Demonstrates |
|--------------|------|----------------------|
| **1. Domain & Intents** | `ai-services/chatbot/domain.yml` | 11 intents, 6 entities, 7 custom actions, responses |
| **2. NLU Pipeline** | `ai-services/chatbot/config.yml` | DIETClassifier, TEDPolicy, RulePolicy, UnexpecTEDIntentPolicy |
| **3. Training Data** | `ai-services/chatbot/data/nlu.yml` | ~450+ annotated examples with entities |
| **4. Stories & Rules** | `ai-services/chatbot/data/stories.yml`, `data/rules.yml` | Conversation flows and rule-based behavior |
| **5. Custom Actions (API Integration)** | `ai-services/chatbot/actions/actions.py` | 7 actions: timetable, halls, lecturers, appointments, directions, office location |
| **6. Trained Models** | `ai-services/chatbot/models/` | Latest: `20260304-120536-international-stadium.tar.gz` (or newest `.tar.gz`) |
| **7. Chat Widget (Frontend)** | `client/src/components/ChatWidget.tsx` | Text + voice input, Rasa webhook, user context |
| **8. Test Data** | `research/datasets/nlp/test_data.yml` | Held-out 20% for evaluation |
| **9. Classification Metrics** | `research/lib/classification_metrics.py` | Precision, Recall, F1, confusion matrix for RO2 evaluation |
| **10. Live Demo** | Chat bubble on any page | Type: "When is my next lecture?" or "Is Hall B free at 2pm?" |

**Suggested demo flow for supervisor:**
1. Open `domain.yml` → show intents and entities.
2. Open `actions/actions.py` → show one action (e.g. `ActionQueryTimetable`) calling platform API.
3. Open `models/` folder → show trained `.tar.gz` files.
4. Run live: open app, click chat bubble, ask "Show me my timetable" or "Is Dr. Dias free today?"

**To generate evaluation output (if not yet done):**
```bash
cd ai-services/chatbot
rasa test nlu --nlu research/datasets/nlp/test_data.yml --out results/
```
This produces `results/intent_report.json`, `results/entity_report.json`, and optionally `intent_confusion_matrix.png`.

---

### Medium-priority — Show if asked

| Path | Purpose |
|------|---------|
| `server/src/routes/index.ts` | API route definitions |
| `server/src/controllers/chatbotController.ts` | Chatbot API integration |
| `ai-services/asr/engines/whisper_finetuned_engine.py` | Fine-tuned Whisper integration |
| `ai-services/chatbot/actions/actions.py` | Rasa custom actions (API calls) |
| `research/lib/wer_calculator.py` | WER computation for evaluation |
| `research/lib/bleu_calculator.py` | BLEU computation for translation |
| `research/asr-finetuning/README.md` | Whisper fine-tuning pipeline |
| `research/datasets/nlp/training_data.yml` | Chatbot training data |

### Supporting — Reference if needed

| Path | Purpose |
|------|---------|
| `client/src/pages/BookAppointment.tsx` | Appointment booking flow |
| `client/src/pages/HallAvailability.tsx` | Hall availability module |
| `client/src/pages/MyTimetable.tsx` | Student timetable view |
| `server/src/services/timetableParserService.ts` | Timetable parsing logic |
| `research/asr-benchmark/scripts/run_benchmark.py` | ASR benchmark runner |
| `research/asr-benchmark/results/asr_benchmark_*.json` | Raw benchmark results |

---

## 6. Quick Demo Checklist

Before presenting:
- [ ] `npm run dev` (server + client)
- [ ] Rasa: `rasa run --enable-api` + `rasa run actions` (if showing chatbot)
- [ ] ASR: `npm run asr` or Python on PATH (if showing Voice Assistant)
- [ ] Seed data: `npx prisma db seed` (if DB is empty)
- [ ] Test login as Student and Lecturer
- [ ] Open `wer_vs_latency.png` or benchmark results

---

## 7. Presentation Tips

1. **Time:** Aim for ~1–2 minutes per slide; leave 5–10 minutes for Q&A.
2. **Demo:** Do a short live demo (2–3 minutes) — login, dashboard, Voice Assistant, chatbot.
3. **Confidence:** You have a working system and completed ASR evaluation; present that clearly.
4. **Honesty:** If something is ongoing (NLP, translation), say so and explain next steps.
5. **Backup:** Have screenshots or a short video in case the live demo fails.

Good luck with your midterm review.

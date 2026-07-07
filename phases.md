# ════════════════════════════════════════════════════════════════
# LECSTU — AI-Integrated Academic Platform
# RESEARCH-DRIVEN Development Phases (12 Phases, 63 Sub-Phases)
# ════════════════════════════════════════════════════════════════
# STATUS       : REFERENCE DOCUMENT (extended 2026-06-11 — Phase 11 indoor navigation module)
# Created      : 2026-02-18
# Project Type : RESEARCH PROJECT (MSc / Academic Research)
# ════════════════════════════════════════════════════════════════


---

# RESEARCH OVERVIEW

## Research Title
> Design and Evaluation of an AI-Integrated Academic Platform
> for Multilingual University Environments

## Research Problem
University students and staff lack an intelligent, multilingual,
centralized platform to manage academic logistics (timetables,
appointments, navigation). Existing systems do not leverage AI
for voice interaction, natural language understanding, or
real-time multilingual support — creating accessibility and
efficiency barriers in multilingual university environments.

## Research Objectives (RO)

| ID   | Research Objective |
|------|--------------------|
| RO-1 | Develop and evaluate an Automatic Speech Recognition (ASR) pipeline that supports English, Tamil, and Sinhala for academic voice queries |
| RO-2 | Design, train, and evaluate a domain-specific NLP chatbot capable of understanding academic intents and extracting relevant entities |
| RO-3 | Implement and comparatively evaluate machine translation approaches for English–Tamil–Sinhala academic content |
| RO-4 | Conduct a usability study to measure the impact of AI integration on task efficiency, user satisfaction, and accessibility in a university platform |
| RO-5 | Engineer a production-ready academic platform as the research testbed integrating all AI components |

## Research Questions (RQ)

| ID   | Research Question |
|------|--------------------|
| RQ-1 | How does Whisper compare to Google Speech API in terms of Word Error Rate and latency for multilingual academic voice queries? |
| RQ-2 | Can a Rasa-based NLP chatbot achieve acceptable precision and recall for academic intent classification and entity extraction? |
| RQ-3 | How do cloud translation APIs compare to multilingual transformer models in translation quality and speed for English–Tamil–Sinhala pairs? |
| RQ-4 | Does AI integration (voice, chatbot, translation) significantly improve task completion time, satisfaction, and accessibility for university users? |

## Research Hypotheses

| ID   | Hypothesis |
|------|--------------------|
| H1   | Whisper (medium) achieves lower WER than Google Speech API for Tamil and Sinhala academic queries |
| H2   | The Rasa chatbot achieves F1 ≥ 0.85 for core academic intents with sufficient training data |
| H3   | Multilingual transformer models produce higher semantic similarity scores than cloud APIs for Tamil and Sinhala academic text |
| H4   | AI-integrated features reduce average task completion time by ≥ 25% compared to manual navigation |

## Research Methodology
- **Design Science Research (DSR)** — Build artifact (platform), evaluate through experiments
- **Quantitative Evaluation** — WER, F1, BLEU, latency, task time, SUS scores
- **Qualitative Evaluation** — Human translation scoring, usability feedback, thematic analysis
- **Statistical Testing** — t-tests, ANOVA, Wilcoxon, Cohen's kappa for inter-rater reliability


---

# MASTER SUB-PHASE TRACKER

| Sub-Phase | Title | Type | RO | Status |
|-----------|-------|------|----|--------|
| **1.1** | Monorepo & Dev Environment Setup | Engineering | RO-5 | ✅ |
| **1.2** | Database Schema Design & Migration | Engineering | RO-5 | ✅ |
| **1.3** | Research Environment & Experiment Framework | Research | RO-5 | ✅ |
| **2.1** | Backend Auth System (JWT + RBAC) | Engineering | RO-5 | ✅ |
| **2.2** | Frontend Auth UI & State Management | Engineering | RO-5 | ✅ |
| **2.3** | User Profile & File Upload | Engineering | RO-5 | ✅ |
| **3.1** | Admin Dashboard Shell & Layout | Engineering | RO-5 | ✅ |
| **3.2** | Master Timetable Management | Engineering | RO-5 | ✅ |
| **3.3** | Student Group & Hall & Office Management | Engineering | RO-5 | ✅ |
| **3.4** | Faculty Map Data Management (Admin) | Engineering | RO-5 | ✅ |
| **4.1** | Student Timetable Generation Engine | Engineering | RO-5 | ✅ |
| **4.2** | Hall Availability Detection System | Engineering | RO-5 | ✅ |
| **4.3** | Lecturer Availability & Frontend Views | Engineering | RO-5 | ✅ |
| **5.1** | Appointment Booking Backend | Engineering | RO-5 | ✅ |
| **5.2** | Notification System (Backend + Real-time) | Engineering | RO-5 | ✅ |
| **5.3** | Appointment & Notification Frontend | Engineering | RO-5 | ✅ |
| **6.1** | Leaflet Map Integration & Building Markers | Engineering | RO-5 | ✅ |
| **6.2** | Map Search, Navigation & Live Status | Engineering | RO-5 | ✅ |
| **6.3** | Admin Map Tools & Mobile Responsiveness | Engineering | RO-5 | ✅ |
| **6.4** | Floor Plan JPG Pipeline & Image Calibration | Engineering | RO-5 | ✅ |
| **6.5** | Indoor Room & Lecturer Marker Placement | Engineering | RO-5 | ✅ |
| **6.6** | Indoor Navigation Graph & Pathfinding | Engineering | RO-5 | ✅ |
| **6.7** | Student "Today on Campus" Schedule (Multi-Room Day) | Engineering | RO-5 | ✅ |
| **6.8** | Indoor Route API & Guided Map UI (Step-by-Step) | Engineering | RO-5 | ✅ |
| **6.9** | Chatbot + Voice Indoor Guidance (End-to-End) | Engineering | RO-2, RO-5 | ✅ |
| **7.1** | ASR Service Implementation (Whisper + Google + Azure) | Engineering | RO-1 | ✅ |
| **7.2** | ASR Dataset Curation & Ground Truth | Research | RO-1 | ✅ |
| **7.3** | ASR Benchmark Experiments (WER + Latency) | Research | RO-1 | ✅ |
| **7.4** | ASR Statistical Analysis & Report | Research | RO-1 | ✅ |
| **7.5** | Decision: Finetune Whisper (Rationale & Scope) | Research | RO-1 | ✅ |
| **7.6** | Finetuning Dataset Acquisition & Preparation | Research | RO-1 | ✅ |
| **7.7** | Whisper Finetuning Implementation | Engineering | RO-1 | ✅ |
| **7.8** | Finetuned Model Evaluation & Integration | Research + Engineering | RO-1 | ✅ |
| **8.1** | Rasa Chatbot Setup & Intent Design | Engineering | RO-2 | ✅ |
| **8.2** | Chatbot Training Data & Custom Actions | Research | RO-2 | ✅ |
| **8.3** | NLP Evaluation (Cross-validation + Confusion Matrix) | Research | RO-2 | ✅ |
| **8.4** | NLP Error Analysis & Report | Research | RO-2 | ✅ |
| **9.1** | Translation Service Implementation | Engineering | RO-3 | ✅ |
| **9.2** | Parallel Corpus Curation | Research | RO-3 | ✅ |
| **9.3** | Automated Translation Benchmarks (BLEU + Similarity) | Research | RO-3 | ✅ |
| **9.4** | Human Evaluation & Inter-rater Analysis | Research | RO-3 | ✅ |
| **9.5** | Translation Comparative Report | Research | RO-3 | ✅ |
| **10.1** | Usability Instruments & Frontend Instrumentation | Research | RO-4 | ⬜ |
| **10.2** | Usability Study Execution (20+ participants) | Research | RO-4 | ⬜ |
| **10.3** | Usability Statistical Analysis | Research | RO-4 | ⬜ |
| **10.4** | Production Hardening & Security Audit | Engineering | RO-5 | ⬜ |
| **10.5** | Final Combined Research Report | Research | ALL | ⬜ |
| **11.1** | Floor Plan Processing & Structured Location Storage | Engineering | RO-5 | ✅ |
| **11.2** | Navigation Graph Creation & Validation | Engineering | RO-5 | ✅ |
| **11.3** | Same-Floor Navigation | Engineering | RO-5 | ✅ |
| **11.4** | Multi-Floor Navigation | Engineering | RO-5 | ✅ |
| **11.5** | Multi-Building Navigation | Engineering | RO-5 | ✅ |
| **11.6** | Natural Language Guidance (Unified Pipeline) | Engineering | RO-2, RO-5 | ✅ |
| **11.7** | Route Visualization on Floor Plans | Engineering | RO-5 | ✅ |
| **11.8** | Admin Consolidation & Publish Workflow | Engineering | RO-5 | ✅ |
| **11.9** | Active Navigation & QR Positioning | Engineering | RO-5 | ✅ |
| **12.1** | Email Service & SMTP Configuration | Engineering | RO-5 | ✅ |
| **12.2** | Password Reset Data Model & Token Service | Engineering | RO-5 | ✅ |
| **12.3** | Forgot Password Backend API | Engineering | RO-5 | ✅ |
| **12.4** | Frontend Forgot / Reset Password UI | Engineering | RO-5 | ✅ |
| **12.5** | Security, Rate Limiting & Deliverability | Engineering | RO-5 | ✅ |
| **12.6** | Testing, Documentation & Production Cutover | Engineering | RO-5 | ✅ |


---

## SUB-PHASE STATUS AT A GLANCE (updated 2026-06-19)

**Legend:** ✅ Finished (built or report done) · ⬜ Not finished · ⚠️ Partial (started, not closed)

| Count | |
|-------|---|
| **Finished** | **55** sub-phases |
| **Partial** | **0** sub-phases (see notes) |
| **Not finished** | **7** sub-phases |
| **Total** | **63** sub-phases tracked |

### ✅ Finished (55)

| Phase | Sub-phases |
|-------|------------|
| 1 | 1.1, 1.2, 1.3 |
| 2 | 2.1, 2.2, 2.3 |
| 3 | 3.1, 3.2, 3.3, 3.4 |
| 4 | 4.1, 4.2, 4.3 |
| 5 | 5.1, 5.2, 5.3 |
| 6 outdoor + indoor maps | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9 |
| 7 | 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8 |
| 8 | 8.1, 8.2, 8.3, 8.4 |
| 9 | 9.1, 9.2, 9.3 |
| 11 indoor navigation module | 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9 |
| 12 password reset via email | 12.1, 12.2, 12.3, 12.4, 12.5, 12.6 |

**Notes:** Phase 7 — ASR benchmark may need a **full re-run** (hypothesis H1) before thesis submission. Phase 11 — code complete; some admin floors still need walking paths / QR codes for full demo data (content gap, not code).

### ⬜ Not finished (7)

| Phase | Sub-phases | What it is |
|-------|------------|------------|
| **9 Translation research** | 9.4, 9.5 | Human eval, report |
| **10 Usability & wrap-up** | 10.1, 10.2, 10.3, 10.4, 10.5 | User study, hardening, final combined report |

---

# DETAILED PHASE & SUB-PHASE BREAKDOWN

---
---

## PHASE 1 — Project Foundation, Database Architecture & Research Environment

### Research Context
> Before any AI evaluation can happen, we need a reproducible
> research environment and a solid platform foundation (the artifact
> in Design Science Research). This phase establishes both.

---

### Sub-Phase 1.1 — Monorepo & Dev Environment Setup
**Type**: Engineering | **Effort**: ~1 day | **Status**: ✅

- [x] Initialize monorepo with folder structure:
  ```
  lecstu/
    /client              ← Vite + React frontend
    /server              ← Node.js + Express backend (MVC)
    /ai-services         ← AI modules (ASR, chatbot, translation)
    /research            ← Research experiments, datasets, reports
    /shared              ← Shared types/constants
    phases.md            ← This reference document
  ```
- [x] Initialize `/client` with Vite + React + TypeScript
- [x] Initialize `/server` with Express + TypeScript:
  - `/server/src/controllers/`
  - `/server/src/models/`
  - `/server/src/routes/`
  - `/server/src/middleware/`
  - `/server/src/services/`
  - `/server/src/utils/`
  - `/server/src/config/`
- [x] Install core dependencies (both client and server)
- [x] Configure ESLint, Prettier, TypeScript configs
- [x] Setup `.env` management with `.env.example`
- [x] Configure development scripts (`dev`, `build`, `lint`)
- [x] Verify both client and server run in development mode

---

### Sub-Phase 1.2 — Database Schema Design & Migration
**Type**: Engineering | **Effort**: ~1.5 days | **Status**: ✅

- [x] Install and configure PostgreSQL connection
- [x] Install and initialize Prisma ORM
- [x] Design complete database schema:
  - `User` — id, email, password, role (ADMIN/LECTURER/STUDENT), firstName, lastName, profileImage, department, createdAt
  - `Faculty` — id, name, code, description
  - `Department` — id, name, code, facultyId
  - `Course` — id, name, code, departmentId, credits
  - `StudentGroup` — id, name, batchYear, departmentId
  - `LectureHall` — id, name, building, floor, capacity, equipment[], isActive
  - `LecturerOffice` — id, roomNumber, building, floor, lecturerId
  - `MasterTimetable` — id, dayOfWeek, startTime, endTime, courseId, lecturerId, hallId, groupId, semester
  - `Appointment` — id, studentId, lecturerId, dateTime, duration, status, reason, notes
  - `Notification` — id, userId, type, title, message, isRead, createdAt
  - `MapBuilding` — id, name, code, latitude, longitude, floors, metadata
  - `MapMarker` — id, buildingId, floor, type, entityId, x, y, label
- [x] Add composite indexes:
  - `MasterTimetable`: (dayOfWeek, startTime, hallId)
  - `MasterTimetable`: (dayOfWeek, startTime, lecturerId)
  - `MasterTimetable`: (groupId, dayOfWeek)
  - `Appointment`: (lecturerId, dateTime)
  - `Notification`: (userId, isRead)
- [x] Run initial migration
- [x] Create seed script with sample academic data:
  - FCT faculty structure (programs, pathways, departments, lecture halls, map buildings)
  - Users registered via `/register`; dedicated scripts for lecturers/timetable import
- [x] Verify seed data loads correctly

---

### Sub-Phase 1.3 — Research Environment & Experiment Framework
**Type**: Research | **Effort**: ~1 day | **Status**: ✅

- [x] Create research directory structure:
  ```
  /research
    /asr-benchmark/          ← RO-1: ASR experiments
      /scripts/              ← Experiment runner scripts
      /results/              ← Raw experiment output
    /nlp-evaluation/         ← RO-2: NLP experiments
      /scripts/
      /results/
    /translation-eval/       ← RO-3: Translation experiments
      /scripts/
      /results/
    /usability-study/        ← RO-4: Usability experiments
      /instruments/          ← Questionnaires, consent forms
      /raw-data/
    /datasets/               ← Shared test datasets
      /asr/
      /nlp/
      /translation/
    /logs/                   ← Structured experiment logs
    /reports/                ← Generated evaluation reports
  ```
- [x] Build experiment logging module (`/research/lib/logger.js`):
  - Structured JSON log per experiment run
  - Fields: experiment_id, timestamp, model_name, parameters, metrics, hardware_info, duration
  - Auto-generates unique experiment IDs
- [x] Create `research-config.yaml`:
  - Random seeds (42, 123, 456 for 3-run experiments)
  - Model version pinning
  - Dataset paths
  - API key references (not actual keys)
- [x] Create metric calculator templates:
  - `wer_calculator.py` — Word Error Rate
  - `classification_metrics.py` — Precision, Recall, F1
  - `bleu_calculator.py` — BLEU score
  - `latency_profiler.js` — Response latency measurement
- [x] Create experiment report template (Markdown format)
- [x] Document data collection ethics plan (if university requires)

### Phase 1 Checkpoint
> After completing 1.1 + 1.2 + 1.3:
> - ✅ Dev environment running (client + server + database)
> - ✅ Full schema migrated and seeded
> - ✅ Research framework ready for experiments


---
---

## PHASE 2 — Authentication, Authorization & User Management

### Research Context
> Secure multi-role access is essential for the usability study
> (Phase 10), where students, lecturers, and admins perform
> different tasks. The auth system enables role-based experiment
> participant management.

---

### Sub-Phase 2.1 — Backend Auth System (JWT + RBAC)
**Type**: Engineering | **Effort**: ~1 day

- [x] Install: bcrypt, jsonwebtoken, express-validator, cookie-parser
- [x] Create auth configuration (token secrets, expiry times) in `/server/src/config/auth.js`
- [x] Implement password hashing utility (bcrypt, salt rounds: 12)
- [x] Implement JWT token utilities:
  - `generateAccessToken(user)` — 15 min expiry
  - `generateRefreshToken(user)` — 7 day expiry
  - `verifyToken(token)` — decode and validate
- [x] Build auth controller (`/server/src/controllers/authController.js`):
  - `register` — validate input, hash password, create user, return tokens
  - `login` — verify credentials, return tokens in HTTP-only cookies
  - `refresh` — validate refresh token, issue new access token
  - `logout` — clear cookies, invalidate refresh token
  - `getMe` — return current user from token
- [x] Build auth middleware (`/server/src/middleware/auth.js`):
  - `authenticate` — extract and verify JWT from cookie/header
  - `authorize(...roles)` — check user role against allowed roles
- [x] Build validation middleware (`/server/src/middleware/validate.js`):
  - Registration validation rules
  - Login validation rules
  - Sanitization (trim, escape)
- [x] Add rate limiting on auth endpoints (express-rate-limit)
- [x] Global error handling middleware with structured error responses
- [x] Register auth routes:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET  /api/auth/me`

---

### Sub-Phase 2.2 — Frontend Auth UI & State Management
**Type**: Engineering | **Effort**: ~1 day

- [x] Install frontend dependencies: axios, react-router-dom, zustand (or React Context)
- [x] Create auth state management (store/context):
  - State: user, isAuthenticated, isLoading, role
  - Actions: login, register, logout, refreshToken, getMe
- [x] Create API client with interceptors:
  - Attach access token to requests
  - Auto-refresh on 401 response
  - Redirect to login on auth failure
- [x] Build auth pages:
  - **Login page** — email/password form, validation, error display
  - **Register page** — name, email, password, role selection, validation
- [x] Build `ProtectedRoute` wrapper component:
  - Redirect to login if not authenticated
  - Role-based access check (show 403 for unauthorized roles)
- [x] Build app shell layout:
  - Top navbar with user info and logout
  - Role-aware sidebar navigation
- [x] Wire up routing:
  - Public: `/login`, `/register`
  - Protected: `/dashboard` (role-redirected)

---

### Sub-Phase 2.3 — User Profile & File Upload
**Type**: Engineering | **Effort**: ~0.5 day

- [x] Install and configure Multer for file uploads:
  - Storage config (disk or cloud)
  - File type validation (images only)
  - Size limit (5MB)
  - Serve uploaded files via static route
- [x] Build profile controller (`/server/src/controllers/profileController.js`):
  - `GET /api/profile` — get own profile
  - `PATCH /api/profile` — update name, department, etc.
  - `POST /api/profile/avatar` — upload profile image
- [x] Build frontend profile page:
  - View profile information
  - Edit form (name, department)
  - Avatar upload with preview
- [x] Input validation for profile updates

### Phase 2 Checkpoint
> After completing 2.1 + 2.2 + 2.3:
> - ✅ Full auth flow working (register → login → protected routes)
> - ✅ Role-based access on frontend and backend
> - ✅ User profiles with image upload
> - ✅ Multi-role system ready for usability study participants


---
---

## PHASE 3 — Admin Panel: Master Data Management

### Research Context
> The admin panel populates the platform with real academic data.
> Quality of this data directly affects AI evaluation — the chatbot
> queries real timetables, ASR processes real academic terms, and
> the usability study uses real workflows.

---

### Sub-Phase 3.1 — Admin Dashboard Shell & Layout ✅
**Type**: Engineering | **Effort**: ~0.5 day

- [x] Build admin layout component:
  - Sidebar navigation (links to all admin modules)
  - Header with breadcrumbs
  - Main content area
- [x] Build admin dashboard home:
  - Stats cards: total students, lecturers, halls, courses, groups
  - Quick-action buttons
- [x] Admin route guard (only `ADMIN` role can access `/admin/*`)
- [x] Reusable UI components for admin:
  - Data table with pagination, sorting, search
  - Modal for create/edit forms
  - Confirmation dialog for delete
  - Toast notifications for success/error

---

### Sub-Phase 3.2 — Master Timetable Management ✅
**Type**: Engineering | **Effort**: ~2 days

- [x] Build timetable controller (`/server/src/controllers/timetableController.ts`):
  - `POST /api/admin/timetable` — create entry
  - `GET /api/admin/timetable` — list all (paginated, filtered)
  - `GET /api/admin/timetable/:id` — get single
  - `PATCH /api/admin/timetable/:id` — update entry
  - `PATCH /api/admin/timetable/:id/assign-lecturer` — assign lecturer to unassigned slot
  - `DELETE /api/admin/timetable/:id` — delete entry
  - `POST /api/admin/timetable/bulk-import` — CSV or PDF upload
- [x] Timetable conflict detection service:
  - Hall conflict: same hall, same day, overlapping time
  - Lecturer conflict: same lecturer, same day, overlapping time
  - Group conflict: same group, same day, overlapping time
  - Return detailed conflict info on creation/update
- [x] Smart timetable import (CSV + PDF):
  - Flexible column detection (day/dayOfWeek, start/startTime, course/courseCode, etc.)
  - PDF: pdf-parse (getTable + getText fallback) — **no ML**, rule-based extraction via PDF.js
  - Auto-create missing courses, halls, groups
  - Unassigned lecturer placeholder when lecturer not found → manual assignment later
- [x] Frontend timetable management:
  - Data table view (filterable by day, lecturer, hall, group)
  - Weekly calendar grid view (visual timetable)
  - Create/edit form with dropdown selectors (courses, lecturers, halls, groups)
  - Bulk import page: CSV or PDF upload, preview, validation, auto-created stats
  - Assign Lecturer modal for unassigned slots
  - Conflict error display (highlighted cells)

---

### Sub-Phase 3.3 — Student Group, Hall & Office Management ✅
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Student Group management:
  - CRUD API: `POST/GET/PATCH/DELETE /api/admin/groups`
  - Assign students to groups: `POST /api/admin/groups/:id/students`
  - Bulk student assignment via CSV
  - Frontend: group list, create/edit, student assignment UI
- [x] Lecture Hall management:
  - CRUD API: `POST/GET/PATCH/DELETE /api/admin/halls`
  - Fields: name, building, floor, capacity, equipment list, isActive
  - Frontend: hall list with capacity/equipment info, create/edit form
- [x] Lecturer Office management:
  - CRUD API: `POST/GET/PATCH/DELETE /api/admin/offices`
  - Link to lecturer profile
  - Frontend: office list, create/edit, lecturer linking
- [x] Audit logging service:
  - Log admin actions (who did what, when)
  - `AuditLog` table: userId, action, entity, entityId, details, timestamp

---

### Sub-Phase 3.4 — Faculty Map Data Management (Admin) ✅
**Type**: Engineering | **Effort**: ~1 day

- [x] Map data APIs:
  - `POST/GET/PATCH/DELETE /api/admin/buildings` — building CRUD
  - `POST/GET/PATCH/DELETE /api/admin/markers` — marker CRUD
  - `POST /api/admin/buildings/:id/floorplan` — upload floor plan image
- [x] Link map markers to database entities:
  - Marker type: `HALL`, `OFFICE`, `LAB`, `AMENITY`, `ENTRANCE`
  - Each marker references an entityId (hallId or officeId)
- [x] Frontend admin map tools:
  - Building list with coordinate entry (lat/lng)
  - Floor plan image upload per building per floor
  - Marker list with entity linking dropdowns
  - Preview: simple Leaflet map showing marker positions

### Phase 3 Checkpoint
> After completing 3.1 + 3.2 + 3.3 + 3.4:
> - ✅ Full admin panel operational
> - ✅ Timetable with conflict detection working
> - ✅ All academic data manageable through UI
> - ✅ Map data stored and linked to real entities
> - ✅ Platform populated for AI experiments


---
---

## PHASE 4 — Timetable Engine & Hall Availability System

### Research Context
> These are the core APIs that the chatbot (Phase 8) will query.
> The chatbot intent `ask_timetable` and `ask_hall_availability`
> call these endpoints. Quality of these APIs directly impacts
> the end-to-end chatbot evaluation.

---

### Sub-Phase 4.1 — Student Timetable Generation Engine
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Build timetable generation service (`/server/src/services/timetableService.ts`):
  - Input: studentId → find group(s) → query master timetable for those groups
  - Output: structured weekly timetable (array of day → slots)
  - Handle edge cases: student in multiple groups, elective courses
- [x] API endpoints:
  - `GET /api/timetable/my` — current user's timetable (student or lecturer)
  - `GET /api/timetable/student/:id` — specific student (admin only)
  - `GET /api/timetable/lecturer/:id` — specific lecturer schedule
  - `POST /api/timetable/cache/invalidate` — admin-only cache flush
- [x] Caching layer:
  - In-memory cache with 5-minute TTL
  - Invalidate when master timetable changes (create/update/delete/bulk-import)
  - X-Cache response header (HIT/MISS)
- [x] Frontend student timetable view:
  - Weekly grid layout (Monday–Friday, time slots)
  - Color-coded by course
  - Click slot → show details (hall, lecturer, room, group, capacity)
  - Current time indicator line (red, updates every minute)
  - Print/export CSV option

---

### Sub-Phase 4.2 — Hall Availability Detection System
**Type**: Engineering | **Effort**: ~1 day

- [x] Build hall availability service (`/server/src/services/hallAvailabilityService.ts`):
  - Query master timetable for hall occupancy per day
  - Compute free slots (gap detection between 08:00–18:00)
  - "Available right now" — compare current time against schedule
  - Filter options endpoint (buildings, equipment)
- [x] API endpoints:
  - `GET /api/halls/available` — query: day, startTime, endTime, minCapacity, building, equipment
  - `GET /api/halls/:id/schedule` — full day schedule for a hall (occupied + free slots)
  - `GET /api/halls/available-now` — halls free at this moment
  - `GET /api/halls/filters` — distinct buildings & equipment for filter dropdowns
- [x] Frontend hall availability explorer:
  - Filter panel: day, time range, capacity, building, equipment
  - Results cards: hall name, building, capacity, equipment, free slot badges
  - "Available Now" tab with live pulse indicator
  - Visual timeline bar (occupied=red, free=green) on expand
  - Schedule detail rows (time, course, lecturer, group)

---

### Sub-Phase 4.3 — Lecturer Availability & Frontend Views
**Type**: Engineering | **Effort**: ~1 day

- [x] Build lecturer availability service (`/server/src/services/lecturerAvailabilityService.ts`):
  - Derive free slots from timetable (inverse of teaching schedule)
  - Exclude existing accepted/pending appointments
  - Weekly availability (Mon–Fri) with per-day teaching, appointments, and free slots
  - Specific date availability query
- [x] API endpoints:
  - `GET /api/lecturers/:id/availability` — weekly free slots
  - `GET /api/lecturers/:id/availability?date=` — specific date free slots
  - `GET /api/lecturers` — list all lecturers (search, department filter)
  - `GET /api/lecturers/:id` — lecturer profile (courses, office, department)
  - `GET /api/lecturers/departments` — department list for filters
- [x] Frontend lecturer views:
  - Lecturer directory (searchable card grid with department filter)
  - Lecturer profile card (avatar, email, phone, department, office, course badges)
  - Availability grid (green=free, blue=teaching, red=booked) with hover tooltips
  - Daily breakdown with free slot badges
- [x] Performance optimization:
  - All timetable queries use indexed columns (dayOfWeek+startTime+hallId, dayOfWeek+startTime+lecturerId)
  - Appointment queries use lecturerId+dateTime index

### Phase 4 Checkpoint
> After completing 4.1 + 4.2 + 4.3:
> - ✅ Auto-generated student timetables working
> - ✅ Real-time hall availability detection operational
> - ✅ Lecturer availability computed from timetable
> - ✅ All APIs ready for chatbot integration (Phase 8)


---
---

## PHASE 5 — Appointment Booking & Notification System

### Research Context
> The appointment flow is a key usability study task (Phase 10):
> "Book an appointment with a lecturer." It is also a chatbot
> intent (`book_appointment`). This phase creates the workflow
> that both human and AI interactions will use.

---

### Sub-Phase 5.1 — Appointment Booking Backend
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Build appointment controller (`/server/src/controllers/appointmentController.ts`):
  - `POST /api/appointments` — student creates request (lecturerId, dateTime, duration, reason)
  - `GET /api/appointments` — list own appointments (filtered by status, date range)
  - `GET /api/appointments/:id` — single appointment details
  - `PATCH /api/appointments/:id/accept` — lecturer accepts
  - `PATCH /api/appointments/:id/reject` — lecturer rejects (with reason)
  - `PATCH /api/appointments/:id/reschedule` — propose new time
  - `DELETE /api/appointments/:id` — cancel (by student or lecturer)
- [x] Booking validation service:
  - Check lecturer is free at requested time (no teaching, no other appointment)
  - Check student has no conflicting appointment
  - Prevent booking in the past
  - Enforce minimum notice period (e.g., 24 hours ahead)
- [x] Status flow enforcement:
  - `PENDING → ACCEPTED | REJECTED`
  - `ACCEPTED → COMPLETED | CANCELLED`
  - `PENDING → CANCELLED` (by requester)
  - Only valid transitions allowed

---

### Sub-Phase 5.2 — Notification System (Backend + Real-time)
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Build notification service (`/server/src/services/notificationService.ts`):
  - `createNotification(userId, type, title, message, metadata?)` — store in DB
  - Notification types enum: `APPOINTMENT_REQUEST`, `APPOINTMENT_ACCEPTED`, `APPOINTMENT_REJECTED`, `APPOINTMENT_CANCELLED`, `TIMETABLE_CHANGE`, `ANNOUNCEMENT`
- [x] Notification API endpoints:
  - `GET /api/notifications` — list (paginated, newest first)
  - `GET /api/notifications/unread-count` — badge count
  - `PATCH /api/notifications/:id/read` — mark single as read
  - `POST /api/notifications/mark-all-read` — mark all as read
- [x] Real-time delivery via Server-Sent Events (SSE):
  - `GET /api/notifications/stream` — SSE endpoint
  - Push new notifications to connected clients
  - Auto-reconnect on client side
- [x] Trigger notifications automatically on:
  - Appointment created → notify lecturer
  - Appointment accepted/rejected → notify student
  - Appointment cancelled → notify other party
  - Timetable updated by admin → notify affected students

---

### Sub-Phase 5.3 — Appointment & Notification Frontend
**Type**: Engineering | **Effort**: ~1 day

- [x] Appointment booking flow (student view):
  - Step 1: Select lecturer (from directory)
  - Step 2: View availability grid, pick time slot
  - Step 3: Enter reason/notes, confirm booking
  - Success confirmation with details
- [x] Appointment management (student view):
  - List of my appointments (filterable by status)
  - Cancel pending/accepted appointments
- [x] Appointment management (lecturer view):
  - Incoming requests list
  - Accept/reject with one click (reject with reason)
  - Reschedule option (propose new time)
  - Upcoming accepted appointments list
- [x] Notification center:
  - Bell icon in navbar with unread count badge
  - Dropdown panel showing recent notifications
  - Full notification page with all history
  - Click notification → navigate to related entity
  - SSE listener for real-time updates

### Phase 5 Checkpoint
> After completing 5.1 + 5.2 + 5.3:
> - ✅ End-to-end appointment booking with status management
> - ✅ Real-time notifications working
> - ✅ Appointment API ready for chatbot `book_appointment` intent
> - ✅ Usability study task "Book appointment" is testable


---
---

## PHASE 6 — Interactive Faculty Map with Leaflet

### Research Context
> Map navigation is a usability study task (Phase 10):
> "Navigate to a location using the map." It also connects
> to chatbot intent `ask_directions` and voice query
> "Where is Hall B?" — creating cross-module integration points.

---

### Sub-Phase 6.1 — Leaflet Map Integration & Building Markers
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Install react-leaflet and leaflet
- [x] Create map container component:
  - Base tile layer (OpenStreetMap or custom campus tiles)
  - Centered on university campus coordinates
  - Zoom constraints (min/max appropriate for campus)
- [x] Building markers layer:
  - Fetch buildings from `/api/map/buildings`
  - Custom marker icons per building type
  - Popup on click: building name, code, floor count
- [x] Indoor floor plan overlay:
  - Image overlay per building per floor
  - Bounds mapping (image corners to lat/lng)
  - Floor switcher control (floor 1, 2, 3...)
- [x] Room markers layer:
  - Fetch markers from `/api/map/markers?buildingId=&floor=`
  - Different icons: halls (blue), offices (green), labs (orange), amenities (gray)
  - Popup: room name, type, linked entity info

---

### Sub-Phase 6.2 — Map Search, Navigation & Live Status
**Type**: Engineering | **Effort**: ~1 day

- [x] Map search bar:
  - Search by: building name, hall name, lecturer name, room number
  - API: `GET /api/map/search?q=` — returns matching entities with coordinates
  - Autocomplete dropdown as user types
  - Select result → fly/zoom to location, open popup
- [x] Live status integration:
  - Hall markers show real-time status:
    - 🟢 Green = free now
    - 🔴 Red = occupied now
    - Next available slot in popup
  - Office markers show:
    - Lecturer name and department
    - Current availability status
    - "Book Appointment" button in popup → links to booking flow
- [x] Legend and filter controls:
  - Toggle marker categories on/off (halls, offices, labs, amenities)
  - Legend explaining color codes
- [x] Map API endpoints:
  - `GET /api/map/buildings` — all buildings with coordinates
  - `GET /api/map/markers` — markers filtered by building, floor, type
  - `GET /api/map/search` — search entities by name
  - `GET /api/map/live-status` — hall free/occupied + next slot, office availability

---

### Sub-Phase 6.3 — Admin Map Tools & Mobile Responsiveness
**Type**: Engineering | **Effort**: ~0.5 day

- [x] Admin map editing mode:
  - Toggle edit mode (admin only)
  - Click on map to place new marker → form to set type, link entity
  - Drag existing markers to adjust position
  - Delete markers
- [x] Mobile responsiveness:
  - Touch-friendly controls (pinch zoom, drag)
  - Bottom sheet for popups instead of small popups
  - Collapsible search bar
  - Responsive floor switcher
- [x] Performance: marker clustering for zoomed-out views

### Phase 6 Checkpoint (outdoor map — baseline)
> After completing 6.1 + 6.2 + 6.3:
> - ✅ Outdoor campus map, search, live hall status, admin tools
> - ⬜ **Indoor guidance (6.4–6.9) required for full student navigation story**

---

## PHASE 6B — Indoor Guidance: Today's Lectures + Chatbot Navigation (JPG Floor Plans)

### Faculty campus structure (your buildings)

The faculty has **three main buildings**. Each building has **about 9–11 floors**; **each floor has its own rooms**. Upload **one JPG floor map per building per floor** when ready (30 maps total in default config).

| Building | Code | Floors (default) | Rooms on typical floors |
|----------|------|------------------|-------------------------|
| **Academic Building** | `ACAD` | **12** (Ground + 11) | Lecture halls, classrooms, tutorial/seminar rooms |
| **Administration Building** | `ADMIN` | **11** (Ground + 10) | Lecturer offices, department offices, meeting rooms, admin rooms |
| **Laboratory Building** | `LAB` | **10** (Ground + 9) | Computer labs, engineering labs, practical/workshop labs |

**Floor map files:** Ground = `ACAD_floor0.jpg` or `ACAD_ground.jpg`; then `ACAD_floor1.jpg` … `ACAD_floor11.jpg` (same pattern for ADMIN, LAB).

Edit floor counts in `server/src/constants/facultyBuildings.ts` if your building has a different number of levels, then run `npm run db:seed-faculty-buildings`.

**Data model (already in system):**

- `MapBuilding` — one row per building (Academic / Administration / Laboratory)
- `FloorPlan` — one JPG per floor per building
- `MapMarker` — room position on that floor’s JPG (linked to `LectureHall` or `LecturerOffice`)
- `LectureHall.building` — text field; should match building name when halls are created/imported

**Setup order (when you have JPGs):**

1. Admin creates or seeds **3 buildings** in Map → Buildings (6.4).
2. Upload JPGs floor by floor for each building (6.4).
3. Place a marker for **each room** used in timetables on the correct floor (6.5).
4. Draw paths between rooms (6.6) — especially when a student moves **Academic → Laboratory** same day.

**Cross-building navigation:** Student’s “today” list may show class in Academic then Lab in Laboratory; route API (6.8) should support **building A → exit → building B** (outdoor segment optional on campus map + indoor segment per building).

---

### Feature goal (student scenario)

> A student arrives at the faculty. **Today they have lectures with different lecturers in different rooms** (e.g. Hall A floor 2, then Lab B floor 1). They open the **chatbot**, see **today's classes and lecturers**, then ask **"How do I go to [lecture room]?"** or **"Guide me to my next class."** The system shows **step-by-step indoor directions** on the **JPG floor plan** you already have.

### Technology approach (uses what you have)

| Layer | Approach |
|-------|----------|
| **Floor plans** | Your JPG files → upload via admin (existing `FloorPlan` model) → show as image overlay on map |
| **Room positions** | Click-to-place markers on the JPG (`MapMarker.x`, `MapMarker.y` = position on image, 0–1 normalized) |
| **Walking paths** | Navigation graph per building/floor (nodes + edges), **A\*** pathfinding — not GPS indoors |
| **Today's schedule** | Existing `GET /api/timetable/my` filtered to **today** + hall/building/floor |
| **Chatbot** | New intents + custom actions → call route API → reply with steps + **"Open guided map"** link |
| **Floor plan AI (optional)** | **EasyOCR + OpenCV** (`ai-services/floorplan-vision`, port 8003) — on JPG upload, auto room markers + corridor graph |
| **Manual fallback** | Rule-based graph + admin room editor still available if OCR misses a label |

### Recommended JPG preparation (before 6.5)

1. One JPG **per building per floor** — e.g. `ACAD_floor1.jpg`, `LAB_floor2.jpg` (see table above).
2. Same orientation for all floors in one building (north/up consistent).
3. Resolution: **1500–3000 px** wide (readable on phone; file &lt; 5 MB).
4. Store originals locally; upload later via admin **Building → Floor Plans** (no need to upload all at once).
5. **Rooms on the map** must exist in **Halls / Offices** admin first (or timetable import), then markers link to them (6.5).

---

### Sub-Phase 6.4 — Floor Plan JPG Pipeline & Image Calibration ✅
**Type**: Engineering | **Effort**: ~1 day | **Depends on**: 6.3

- [x] Register three faculty buildings in `MapBuilding`:
  - Academic (`ACAD`), Administration (`ADMIN`), Laboratory (`LAB`) — `npm run db:seed-faculty-buildings`
- [x] Floor plan storage: `server/uploads/floorplans/{CODE}_floor{N}.jpg` — see `docs/floorplans/README.md`
- [x] Admin single + **bulk upload** (filename `ACAD_floor1.jpg` auto-matches building/floor)
- [x] Calibrate `FloorPlan.bounds` in Admin → Buildings → Edit bounds (south/west/north/east)
- [x] Validation: building code, floor range, image type/size
- [x] CLI import: `npm run db:import-floorplans` from `uploads/floorplans/import/`

---

### Sub-Phase 6.4b — Floor Plan AI (image recognition) ✅
**Type**: AI / Engineering | **Depends on**: 6.4

- [x] Python service `ai-services/floorplan-vision` — EasyOCR room labels + OpenCV door heuristics
- [x] On admin upload (or **AI** button): create `MapMarker` pins + sync nav nodes + auto corridor/entrance edges
- [x] API: `POST /api/admin/buildings/:id/floorplan/:floor/analyze-ai`
- [x] Run: `.\run_vision.ps1` or `npm run floorplan-vision` (port **8003**)

---

### Sub-Phase 6.5 — Indoor Room & Lecturer Marker Placement on Floor Plans ✅
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 6.4, 3.3 (halls/offices in DB)

- [x] Admin **indoor editor** (`/admin/indoor-markers`): floor plan JPG, click to place, drag pins
- [x] Position stored as **0–100%** on image (compatible with Campus Map)
- [x] Link markers: `HALL` → `LectureHall`, `OFFICE` → `LecturerOffice`, `LAB`, `ENTRANCE`, `AMENITY`
- [x] Checklist: timetable halls / halls on floor without markers
- [x] API: `GET /api/admin/map/indoor-markers/editor`, `POST`, `PATCH`, `PATCH …/position`, `DELETE`
- [x] Link from Admin → Buildings → Floor Plans → **Place rooms on this floor**

---

### Sub-Phase 6.6 — Indoor Navigation Graph & Pathfinding
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 6.5

- [x] Extend schema (Prisma):
  - `NavNode` — id, buildingId, floor, label, x, y, type (`ROOM`, `CORRIDOR`, `STAIRS`, `LIFT`, `ENTRANCE`)
  - `NavEdge` — fromNodeId, toNodeId, weight, bidirectional, optional label (stairs/lift)
- [x] Admin tool: **Admin → Walking paths** (`/admin/indoor-nav`) — add nodes, connect segments, sync from room markers, test A* route
- [x] Pathfinding service (`indoorNavigationService.ts`):
  - **A\*** on building-wide graph (multi-floor via stair/lift edges)
  - Default start: `ENTRANCE` on ground, else first entrance / corridor
- [x] API:
  - `GET /api/map/nav-graph?buildingId=&floor=`
  - `GET /api/map/nav-route?buildingId=&toHallId=&fromNodeId=`
  - `GET/POST /api/admin/map/nav-graph/*` — editor, nodes, edges, sync-markers

---

### Sub-Phase 6.7 — Student "Today on Campus" Schedule (Multi-Room Day)
**Type**: Engineering | **Effort**: ~1 day | **Depends on**: 4.1, 6.5

- [x] API `GET /api/timetable/my/today`:
  - Today's slots only (server date + student group timetable)
  - Each slot: time, course, **lecturer name**, **hall name**, building, floor, `hallId`, `markerId`
  - Flag `hasMultipleLocations` when 2+ classes in different halls/buildings
  - Sort by `startTime`
- [x] `GET /api/timetable/my/today/next` — current or next upcoming class
- [x] Frontend **Today on campus** widget (student dashboard + My Timetable) with **Navigate** → Campus Map guided route

---

### Sub-Phase 6.8 — Indoor Route API & Guided Map UI (Step-by-Step)
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 6.6, 6.7

- [x] Route API:
  - `GET /api/map/indoor-route` — single destination (`toHallId`, `toMarkerId`, `q`, `fromNodeId`)
  - `GET /api/map/indoor-route/today` — multi-leg routes in **timetable order** (chains within same building)
  - `GET /api/map/nav-route` — alias (same response)
- [x] Response: `steps[]`, `segments[]`, `deepLink` (`/map/guide?...`), `adminFix` on errors
- [x] **Guided Map** (`/map/guide`) — floor JPG, path overlay, destination pin, Previous/Next steps, floor switcher
- [x] **Today mode** (`/map/guide?today=1`) — tab per class; **Guide all today** on dashboard widget
- [x] Edge cases: missing marker/graph → message + links to Room map editor / Walking paths / Buildings

---

### Sub-Phase 6.9 — Chatbot + Voice Indoor Guidance (End-to-End)
**Type**: Engineering | **Effort**: ~1.5 days | **Depends on**: 6.7, 6.8, 8.2

- [x] New chatbot intents (`data/nlu.yml`, `domain.yml`):
  | Intent | Example |
  |--------|---------|
  | `ask_todays_classes` | "Who are my lecturers today?", "What classes do I have today?" |
  | `guide_to_lecture_room` | "How do I go to hall B?", "Take me to ENPR lab" |
  | `guide_to_next_class` | "Where is my next lecture?", "Guide me to my next class" |
- [x] Custom actions (`actions/actions.py`):
  - `ActionTodayOnCampus` → `GET /api/timetable/my/today`
  - `ActionGuideToRoom` → `GET /api/map/indoor-route` + `/map/guide` deep link
  - `ActionGuideToNextClass` → `GET /api/timetable/my/today/next` + route
  - `ActionGetDirections` — indoor route for halls/rooms
- [x] Chat widget: clickable **Open guided map** links (`ChatBotMessage.tsx`)
- [x] Voice: mic in chat widget sends transcript to same Rasa intents
- [x] NLU examples in `data/nlu.yml` + `research/datasets/nlp/`
- [x] Manual test checklist: `docs/indoor-chatbot-test.md`

### Phase 6B Checkpoint (final target for this feature)
> Indoor navigation feature set (6.4–6.9) is **implemented**. Operational checklist:
> - Upload & calibrate JPG floor plans (6.4)
> - Place rooms + draw walking paths (6.5–6.6)
> - Student: **Today on campus** widget + chatbot `ask_todays_classes`
> - Student: **Guide to room / next class** → chatbot steps + **/map/guide** yellow path
> - Multi-room days: `/map/guide?today=1` or **Guide all today**
> - Usability study: `docs/indoor-chatbot-test.md`


---
---

## ═══════════════════════════════════════════════════════════
## RESEARCH EXPERIMENTATION BEGINS (Phases 7–10)
## ═══════════════════════════════════════════════════════════

---
---

## PHASE 7 — ASR Benchmarking, Voice Interface & Whisper Finetuning
### → Addresses: RO-1, RQ-1, H1

### Research Objective
> **RO-1**: Develop and evaluate an ASR pipeline supporting
> English, Tamil, and Sinhala for academic voice queries.

### Research Question
> **RQ-1**: How does Whisper compare to Google Speech API in
> terms of WER and latency for multilingual academic queries?

### Hypothesis Under Test
> **H1**: Whisper (medium) achieves lower WER than Google Speech
> API for Tamil and Sinhala academic queries.

---

### Sub-Phase 7.1 — ASR Service Implementation (Whisper + Google + Azure)
**Type**: Engineering | **Effort**: ~2 days

- [x] Create ASR service module (`/ai-services/asr/`):
  ```
  /ai-services/asr/
    /engines/
      whisper_engine.py       ← OpenAI Whisper wrapper
      google_engine.py        ← Google Speech API wrapper
      azure_engine.py         ← Azure Speech Services wrapper
    /preprocessing/
      audio_processor.py      ← Noise reduction, format normalization
    asr_service.py            ← Unified interface
    requirements.txt
  ```
- [x] Implement Whisper engine:
  - Load models: tiny, base, small, medium
  - `transcribe(audio_path, language, model_size)` → `{ text, confidence, latency_ms }`
  - GPU/CPU detection and configuration
- [x] Implement Google Speech engine:
  - Configure Google Cloud credentials
  - `transcribe(audio_path, language)` → `{ text, confidence, latency_ms }`
  - Handle streaming vs. batch recognition
- [x] Implement Azure Speech engine:
  - Configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION
  - `transcribe(audio_path, language)` → `{ text, confidence, latency_ms }`
  - See ai-services/asr/README.md for activation guide
- [x] Build unified ASR interface:
  - `transcribe(audio_buffer, language, engine_name)` → standardized output
  - Automatic latency measurement (start-to-finish timer)
- [x] Audio preprocessing pipeline:
  - Format normalization (convert to 16kHz WAV mono)
  - Optional noise reduction (noisereduce library)
  - Silence trimming
- [x] REST API wrapper for ASR service:
  - `POST /api/ai/asr/transcribe` — accepts audio file + language + engine
  - Returns: `{ text, confidence, latency_ms, engine }`
- [x] Frontend voice input component:
  - Microphone record button (MediaRecorder API)
  - Recording indicator with waveform
  - Send audio to ASR endpoint
  - Display transcription result
  - Language selector (English, Tamil, Sinhala)

---

### Sub-Phase 7.2 — ASR Dataset Curation & Ground Truth
**Type**: Research | **Effort**: ~1.5 days

- [x] Define dataset requirements:
  - **50 utterances per language** (English, Tamil, Sinhala) = 150 total
  - Academic domain queries covering platform features:
    - Timetable: "When is my next Data Structures lecture?"
    - Halls: "Is Hall B available at 2pm?"
    - Appointments: "I want to book an appointment with Dr. Dias"
    - Directions: "Where is the Computer Science building?"
    - General: "What are today's lectures for Group B?"
  - Recording conditions:
    - Clean studio (baseline)
    - Moderate noise (classroom ambient)
    - Light accent variation
- [x] Record or collect audio samples:
  - Recruit 3–5 speakers per language (diverse accents)
  - Record in controlled environment + noisy environment
  - Format: 16kHz WAV mono
- [x] Create ground truth transcriptions:
  - Manual transcription by native speakers
  - Double-verified by second transcriber
  - Store in `/research/datasets/asr/ground_truth/`
- [x] Document dataset metadata:
  - `dataset_manifest.json`: speaker_id, language, text, audio_path, noise_level, duration
  - Recording equipment and conditions
  - Transcription methodology

---

### Sub-Phase 7.3 — ASR Benchmark Experiments (WER + Latency)
**Type**: Research | **Effort**: ~1 day

- [x] Build experiment runner (`/research/asr-benchmark/scripts/run_benchmark.py`):
  - Load dataset manifest
  - For each audio file × each engine × each model size:
    - Run transcription
    - Compute WER against ground truth
    - Compute CER against ground truth
    - Record latency
  - 3 repetitions per configuration (for variance)
  - Log all results to experiment log
- [ ] Experiment matrix:
  | Engine | Model | Languages | Runs |
  |--------|-------|-----------|------|
  | Whisper | tiny | En, Ta, Si | 3 each |
  | Whisper | base | En, Ta, Si | 3 each |
  | Whisper | small | En, Ta, Si | 3 each |
  | Whisper | medium | En, Ta, Si | 3 each |
  | Google Speech | default | En, Ta, Si | 3 each |
  | Azure Speech | default | En, Ta, Si | 3 each |
  | **Total** | | | **54 configs × 50 utterances × 3 runs** |
- [x] Execute full benchmark
- [x] Store raw results in `/research/asr-benchmark/results/`

---

### Sub-Phase 7.4 — ASR Statistical Analysis & Report
**Type**: Research | **Effort**: ~1 day

- [x] Compute descriptive statistics:
  - Mean, median, std deviation for WER per (engine × language)
  - Mean, median, std deviation for latency per (engine × language)
- [x] Run inferential statistics:
  - Paired t-test or Wilcoxon signed-rank: Whisper(medium) vs. Google per language
  - Report p-values, test statistics
  - 95% confidence intervals for WER differences
  - Effect size: Cohen's d
- [x] Generate visualizations:
  - Bar chart: WER by engine × language (with error bars)
  - Box plot: WER distribution per engine
  - Bar chart: Latency comparison
  - Scatter: WER vs. latency trade-off
- [x] Write ASR Benchmark Report:
  - Introduction and methodology
  - Dataset description
  - Results tables (WER, CER, latency)
  - Statistical test results
  - Visualizations
  - Discussion: which engine is best for which language and why
  - **Conclusion: Accept or reject H1**
- [x] Save report to `/research/reports/asr_benchmark_report.md`

---

### Sub-Phase 7.5 — Decision: Finetune Whisper (Rationale & Scope)
**Type**: Research | **Effort**: ~0.5 day

- [x] Document decision rationale:
  - **Why finetune**: Improve WER for academic domain (timetable, halls, appointments, directions) in En/Ta/Si
  - **Alternatives considered**:
    - Cloud APIs (Google, Azure): Retained for future use; Azure blocked on Azure for Students subscription
    - Train from scratch: Not feasible (requires 100s–1000s of hours per language)
    - Finetune Whisper: Best balance of effort vs. improvement
  - **Scope**: Finetune Whisper base/small on public datasets + Phase 7.2 academic utterances
- [x] Define success criteria:
  - WER improvement over base Whisper on Phase 7.2 benchmark (target: ≥10% relative reduction)
  - Latency acceptable for real-time voice input (<5s for typical utterance)
- [x] Note: **Cloud engines (Google, Azure) remain in the ASR service** — not removed; available for future comparison and fallback

---

### Sub-Phase 7.6 — Finetuning Dataset Acquisition & Preparation
**Type**: Research | **Effort**: ~2–3 days

- [x] Acquire public datasets per language:
  - **English**: LibriSpeech (openslr.org/12) or Mozilla Common Voice
  - **Tamil**: IISc-MILE Tamil (SLR127, ~150 hrs) or Crowdsourced Tamil (SLR65)
  - **Sinhala**: Large Sinhala ASR (SLR52) or sinscribe-sinhala-stt (Hugging Face)
- [x] Prepare unified manifest format:
  - `{ audio_path, text, language }` per utterance
  - 16 kHz WAV mono (or convert)
  - Train/validation split (e.g. 90/10)
- [x] Merge with Phase 7.2 academic dataset:
  - Add 150 academic utterances to training/validation
  - Ensures domain coverage for timetable, halls, appointments, directions
- [x] Store in `/research/datasets/asr/finetuning/`:
  ```
  finetuning/
    train_manifest.json
    val_manifest.json
    audio/           ← symlinks or copies to downloaded datasets
  ```
- [x] Document dataset sources and licenses in `FINETUNING_DATASETS.md`

---

### Sub-Phase 7.7 — Whisper Finetuning Implementation
**Type**: Engineering | **Effort**: ~3–5 days

- [x] Set up finetuning environment:
  - Hugging Face `transformers` + `datasets`
  - GPU required (local or Colab/Kaggle)
  - Dependencies: `pip install transformers datasets accelerate peft`
- [x] Create finetuning script (`/research/asr-finetuning/train_whisper.py`):
  - Load Whisper base or small as starting checkpoint
  - Load train/val manifests
  - Fine-tune with LoRA or full fine-tuning (configurable)
  - Save checkpoints and best model
- [x] Training config:
  - Batch size, learning rate, epochs (tune for GPU memory)
  - Gradient accumulation if needed
  - Early stopping on validation WER
- [x] Output:
  - Finetuned model saved to `/research/asr-finetuning/models/lecstu-whisper-{base|small}-en-ta-si/`
  - Training logs and curves (TensorBoard)

---

### Sub-Phase 7.8 — Finetuned Model Evaluation & Integration
**Type**: Research + Engineering | **Effort**: ~2 days

- [x] Add finetuned Whisper engine to ASR service:
  - Create `engines/whisper_finetuned_engine.py` (or extend `whisper_engine.py` with model path option)
  - Load from `/research/asr-finetuning/models/` or configurable path
  - Same interface: `transcribe(audio_path, language)` → `{ text, confidence, latency_ms }`
- [x] Integrate into `asr_service.py`:
  - New engine name: `whisper-finetuned` (or `whisper_ft`)
  - Keep existing engines: `whisper`, `google`, `azure` (unchanged)
- [x] Run benchmark on Phase 7.2 dataset:
  - Compare: Whisper base vs. Whisper finetuned (WER, CER, latency)
  - Update `run_benchmark.py` to support `--engine whisper-finetuned`
- [x] Update ASR Benchmark Report:
  - Add finetuned model results
  - Discuss improvement (or lack thereof) and limitations
- [x] Update Voice Assistant UI:
  - Add "Whisper (Finetuned)" option to engine dropdown (optional)

---

### Phase 7 Checkpoint
> After completing 7.1 + 7.2 + 7.3 + 7.4 + 7.5 + 7.6 + 7.7 + 7.8:
> - ✅ Voice input working in the platform (Whisper, Google, Azure engines)
> - ✅ ASR benchmark dataset documented and versioned (150 utterances)
> - ✅ Benchmark experiments executed; statistical analysis and report generated
> - ✅ **Decision to finetune Whisper** documented (7.5)
> - ✅ Finetuning datasets acquired and prepared (7.6)
> - ✅ Whisper finetuned on En/Ta/Si (7.7)
> - ✅ Finetuned model integrated, benchmarked, and reported (7.8)
> - ✅ **Cloud engines (Google, Azure) retained** for future comparison


---
---

## PHASE 8 — NLP Chatbot Training & Evaluation
### → Addresses: RO-2, RQ-2, H2

### Research Objective
> **RO-2**: Design, train, and evaluate a domain-specific NLP
> chatbot for academic intent classification and entity extraction.

### Research Question
> **RQ-2**: Can a Rasa-based chatbot achieve acceptable precision
> and recall for academic intent classification and entity extraction?

### Hypothesis Under Test
> **H2**: The Rasa chatbot achieves F1 ≥ 0.85 for core academic
> intents with sufficient training data.

---

### Sub-Phase 8.1 — Rasa Chatbot Setup & Intent Design
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Initialize Rasa project (`/ai-services/chatbot/`):
  ```
  /ai-services/chatbot/
    /data/
      nlu.yml              ← Training examples
      stories.yml          ← Conversation flows
      rules.yml            ← Deterministic rules
    /actions/
      actions.py           ← Custom actions (API calls)
    /models/               ← Trained model files
    config.yml             ← NLU pipeline config
    domain.yml             ← Intents, entities, responses
    endpoints.yml          ← Action server config
  ```
- [x] Define intent taxonomy:
  | Intent | Example | Entities Expected |
  |--------|---------|-------------------|
  | `ask_timetable` | "When is my next lecture?" | course_name, day |
  | `ask_hall_availability` | "Is Hall B free at 2pm?" | hall_name, time |
  | `ask_lecturer_availability` | "Is Dr. Dias free tomorrow?" | lecturer_name, day |
  | `book_appointment` | "I want to meet Dr. Rajapaksha on Monday" | lecturer_name, day, time |
  | `cancel_appointment` | "Cancel my appointment with Dr. Dias" | lecturer_name |
  | `ask_directions` | "Where is the CS building?" | building |
  | `ask_office_location` | "Where is Dr. Dias's office?" | lecturer_name |
  | `greeting` | "Hi", "Hello" | — |
  | `goodbye` | "Bye", "Thanks" | — |
  | `fallback` | (low confidence) | — |
  | `out_of_scope` | "What's the weather?" | — |
- [x] Define entity types: `course_name`, `lecturer_name`, `hall_name`, `day`, `time`, `building`
- [x] Configure NLU pipeline in `config.yml`:
  - WhitespaceTokenizer → CountVectorsFeaturizer → DIETClassifier
  - EntityExtractor settings
- [x] Build frontend chat widget:
  - Floating chat bubble (bottom-right corner)
  - Chat window with message history
  - Text input + send button
  - Bot typing indicator
  - Minimize/maximize toggle
  - Connect to Rasa REST API

---

### Sub-Phase 8.2 — Chatbot Training Data & Custom Actions
**Type**: Research | **Effort**: ~2 days

- [x] Write NLU training examples (`data/nlu.yml`):
  - **30+ examples per intent** (varied phrasing)
  - Entity annotations in examples
  - Include synonyms and common misspellings
  - Examples reflecting Sri Lankan English patterns
- [x] Write conversation stories (`data/stories.yml`):
  - Happy paths for each intent
  - Multi-turn conversations (e.g., ask timetable → follow up with booking)
  - Fallback handling stories
- [x] Write rules (`data/rules.yml`):
  - Greeting → respond with greeting
  - Goodbye → respond with goodbye
  - Low confidence → trigger fallback
  - Out of scope → polite redirect
- [x] Implement custom actions (`actions/actions.py`):
  - `ActionQueryTimetable` → call `GET /api/timetable/my` → format response
  - `ActionCheckHallAvailability` → call `GET /api/halls/available` → format response
  - `ActionCheckLecturerAvailability` → call `GET /api/lecturers/:id/availability` → format
  - `ActionBookAppointment` → call `POST /api/appointments` → confirm booking
  - `ActionGetDirections` → call `GET /api/map/search` → return location info
- [x] Train initial Rasa model
- [x] Test end-to-end: chat widget → Rasa → custom action → platform API → response
- [x] Create train/test split:
  - 80% training, 20% held-out test
  - Stratified by intent
  - Store in `/research/datasets/nlp/`

---

### Sub-Phase 8.3 — NLP Evaluation (Cross-validation + Confusion Matrix)
**Type**: Research | **Effort**: ~1 day

- [x] Run Rasa NLU 5-fold cross-validation:
  - `rasa test nlu --cross-validation --folds 5`
  - Collect per-fold metrics
- [x] Run held-out test set evaluation:
  - `rasa test nlu --nlu test_data.yml`
  - Generate `intent_report.json` and `entity_report.json`
- [x] Extract metrics:
  - Per-intent: precision, recall, F1 score, support
  - Per-entity: precision, recall, F1 score
  - Overall weighted F1
- [x] Generate confusion matrix:
  - `rasa test nlu` → `intent_confusion_matrix.png`
  - Identify top confused intent pairs
- [ ] Confidence threshold analysis:
  - Sweep threshold from 0.3 to 0.9 (step 0.1)
  - Plot: accuracy vs. threshold
  - Plot: fallback rate vs. threshold
  - Determine optimal threshold (maximize accuracy, acceptable fallback rate)

---

### Sub-Phase 8.4 — NLP Error Analysis & Report
**Type**: Research | **Effort**: ~1 day

- [x] Error analysis:
  - List all misclassified examples from test set
  - Categorize errors:
    - Ambiguous phrasing (could be multiple intents)
    - Insufficient training examples
    - Entity extraction failure
    - Genuine model limitation
  - Identify most problematic intents
- [x] Generate visualizations:
  - Confusion matrix heatmap
  - Per-intent F1 bar chart
  - Per-entity F1 bar chart
  - Confidence distribution histogram
  - Threshold vs. accuracy curve
- [x] Write NLP Evaluation Report:
  - Introduction and methodology
  - Training data description and statistics
  - Pipeline configuration
  - Cross-validation results
  - Held-out test results
  - Confusion matrix analysis
  - Entity extraction performance
  - Error analysis findings
  - Confidence threshold recommendation
  - **Conclusion: Accept or reject H2 (F1 ≥ 0.85)**
- [x] Save report to `/research/reports/nlp_evaluation_report.md`

### Phase 8 Checkpoint
> After completing 8.1 + 8.2 + 8.3 + 8.4:
> - ✅ Chatbot integrated into platform and functional
> - ✅ Training data documented (30+ examples × 11 intents)
> - ✅ 5-fold cross-validation + held-out test completed
> - ✅ Confusion matrix and error analysis done
> - ✅ **NLP Evaluation Report generated → answers RQ-2, tests H2**


---
---

## PHASE 9 — Translation System & Comparative Evaluation
### → Addresses: RO-3, RQ-3, H3

### Research Objective
> **RO-3**: Implement and comparatively evaluate machine translation
> approaches for English–Tamil–Sinhala academic content.

### Research Question
> **RQ-3**: How do cloud translation APIs compare to multilingual
> transformer models in quality and speed for En–Ta–Si pairs?

### Hypothesis Under Test
> **H3**: Multilingual transformer models produce higher semantic
> similarity scores than cloud APIs for Tamil and Sinhala academic text.

---

### Sub-Phase 9.1 — Translation Service Implementation
**Type**: Engineering | **Effort**: ~1.5 days

- [x] Create translation service module:
  ```
  /ai-services/translation/
    /engines/
      cloud_translator.py      ← Google Translate / Azure wrapper
      transformer_engine.py   ← MarianMT wrapper
    translation_service.py    ← Unified interface
    run_translate.py          ← CLI entry
    requirements.txt
  ```
- [x] Implement cloud translation engine:
  - Configure Google Translate API (or Azure Translator)
  - `translate(text, src_lang, tgt_lang)` → `{ translated_text, latency_ms }`
- [x] Implement transformer translation engine:
  - Load Helsinki-NLP MarianMT (opus-mt-en-inc, opus-mt-inc-en, etc.)
  - `translate(text, src_lang, tgt_lang)` → `{ translated_text, latency_ms }`
  - GPU/CPU detection
- [x] Unified translation interface:
  - `translate(text, src, tgt, engine)` → standardized output
  - Automatic latency measurement
- [x] Language pairs: En↔Ta, En↔Si, Ta↔Si
- [x] REST API wrapper:
  - `POST /api/ai/translation/translate` — text + source + target + engine
- [x] Platform integration:
  - UI language switcher component (English / Tamil / Sinhala)
  - Apply translation to chatbot responses
  - Apply to timetable display content
  - Apply to notification text

---

### Sub-Phase 9.2 — Parallel Corpus Curation
**Type**: Research | **Effort**: ~1.5 days | **Status**: ✅

- [x] Build parallel test corpus:
  - **100 sentence pairs per language pair** (En-Ta, En-Si, Ta-Si) = 300 pairs
  - Academic domain content categories:
    - Timetable queries and responses
    - Appointment-related sentences
    - Navigation/direction instructions
    - Notification messages
    - General academic phrases
  - Sentence complexity levels: simple, moderate, complex
- [x] Obtain human reference translations:
  - Native speaker translations for each sentence
  - Double-checked by second translator
- [x] Document corpus metadata:
  - `corpus_manifest.json`: id, source_text, target_text, language_pair, category, complexity
  - Methodology for corpus creation
- [x] Store in `/research/datasets/translation/`

---

### Sub-Phase 9.3 — Automated Translation Benchmarks (BLEU + Similarity)
**Type**: Research | **Effort**: ~1 day | **Status**: ✅

- [x] Build benchmark runner (`/research/translation-eval/scripts/run_benchmark.py`):
  - For each sentence pair × each engine:
    - Run translation
    - Compute BLEU score against human reference
    - Compute semantic similarity (cosine, using multilingual sentence-BERT)
    - Record latency
  - 3 repetitions per configuration
- [x] Experiment matrix:
  | Engine | Language Pairs | Sentences | Runs |
  |--------|---------------|-----------|------|
  | Cloud API | En→Ta, Ta→En, En→Si, Si→En, Ta→Si, Si→Ta | 100 each | 3 *(implemented; pending credentials for full run)* |
  | Transformer | En→Ta, Ta→En, En→Si, Si→En, Ta→Si, Si→Ta | 100 each | 3 |
  | **Executed** | Transformer all 6 directions | **100 sentence sets × 6 directions × 3 runs = 1800 rows** | |
- [x] Execute full transformer benchmark (`translation_benchmark_20260617_132336.json`, 1800 rows, 0 errors)
- [x] Store raw results in `/research/translation-eval/results/`
- [x] Store structured experiment log in `/research/logs/translation_benchmark_20260617_132336.json`
- [x] Add automated benchmark summary report: `/research/reports/translation_automated_benchmark_report.md`

---

### Sub-Phase 9.4 — Human Evaluation & Inter-rater Analysis
**Type**: Research | **Effort**: ~1.5 days | **Status**: ✅ (instrument + analysis tooling ready; awaiting evaluator ratings)

- [ ] Recruit **5–10 bilingual evaluators** (university staff/students) *(operational task — pending)*
- [x] Prepare evaluation instrument (`research/translation-eval/scripts/build_human_eval.py`):
  - Randomized, blind sentence presentation (engines interleaved, opaque item IDs)
  - Rating rubric captured in generated `INSTRUCTIONS.md`:
    - Fluency (1–5): Does it read naturally in the target language?
    - Adequacy (1–5): Is the original meaning fully preserved?
    - Overall Quality (1–5): General quality assessment
  - Spreadsheet form (`human_eval_form.csv`) + per-rater template (`rater_template.csv`)
- [x] Select evaluation subset:
  - 30 sentences per language pair × available engines
  - Balanced across complexity levels (simple/moderate/complex round-robin)
- [ ] Run human evaluation sessions *(operational task — pending)*
- [x] Compute inter-rater reliability (`analyze_human_eval.py` + `research/lib/agreement_metrics.py`):
  - Krippendorff's alpha (ordinal, multi-rater) + mean pairwise weighted Cohen's kappa + within-1 agreement
  - Flags and lists low-agreement items for investigation
- [x] Store instrument + summary in `/research/datasets/translation/human-eval/`
  (`human_eval_form.*`, `answer_key.json`, `human_eval_summary.json`)

> Engineering deliverables for 9.4 are complete and verified. Full statistical
> outputs populate automatically once bilingual evaluators submit `ratings_*.csv`.

---

### Sub-Phase 9.5 — Translation Comparative Report
**Type**: Research | **Effort**: ~1 day | **Status**: ✅ (report generator + report produced; H3 currently DEFERRED pending cloud + human data)

- [x] Compile all results (`research/translation-eval/scripts/generate_comparative_report.py`):
  - Automated metrics: BLEU, semantic similarity, latency per engine per pair
  - Human scores: fluency, adequacy, overall per engine per pair (auto-populated when collected)
- [x] Statistical analysis:
  - Paired t-test + Wilcoxon: Cloud vs. Transformer per language pair
  - Correlation: BLEU vs. human scores (Pearson/Spearman)
  - Correlation: semantic similarity vs. human scores
  - Effect size (Cohen's d) for quality differences
- [x] Generate visualizations (→ `research/translation-eval/results/`):
  - BLEU comparison bar chart (engine × language pair)
  - Semantic similarity comparison
  - Latency comparison bar chart
  - Human evaluation score comparison (box plots — when human data present)
  - Scatter plot: automated metric vs. human score correlation (when human data present)
  - Speed vs. quality trade-off plot
- [x] Write Translation Evaluation Report (sections: introduction/methodology, corpus,
  automated results, human results + inter-rater reliability, correlation, speed vs.
  quality, per-language-pair recommendation, **H3 conclusion**)
- [x] Save report to `/research/reports/translation_evaluation_report.md`

> Report currently records **H3 = DEFERRED**: only the transformer engine (marian)
> produced valid data (the Google cloud run failed on rate-limit/credentials). The
> decision flips to ACCEPT/REJECT automatically once a cloud benchmark run and human
> ratings are added and the report is regenerated.

### Phase 9 Checkpoint
> After completing 9.1 + 9.2 + 9.3 + 9.4 + 9.5:
> - ✅ Multilingual platform with language switching
> - ✅ Parallel corpus curated (300 sentence pairs)
> - ✅ Automated benchmarks executed (BLEU, similarity, latency)
> - ✅ Human evaluation instrument + inter-rater reliability tooling ready (awaiting evaluator ratings)
> - ✅ **Translation Evaluation Report generated → answers RQ-3, tests H3 (currently DEFERRED pending cloud run + human ratings)**


---
---

## PHASE 10 — Usability Study, Statistical Analysis & Final Integration
### → Addresses: RO-4, RQ-4, H4

### Research Objective
> **RO-4**: Measure the impact of AI integration on task efficiency,
> user satisfaction, and accessibility in a university platform.

### Research Question
> **RQ-4**: Does AI integration significantly improve task completion
> time, satisfaction, and accessibility for university users?

### Hypothesis Under Test
> **H4**: AI-integrated features reduce average task completion time
> by ≥ 25% compared to manual navigation.

---

### Sub-Phase 10.1 — Usability Instruments & Frontend Instrumentation
**Type**: Research | **Effort**: ~2 days

- [ ] Design study protocol document:
  - Study objectives
  - Participant criteria: university students, lecturers, admins
  - Target: minimum **20 participants** (stratified by role)
  - Within-subjects design: each participant uses BOTH manual and AI
  - Task randomization order (counterbalanced to avoid learning effects)
  - Session duration estimate (~45 min per participant)
  - Ethics approval documentation (if required)
- [ ] Define usability tasks:
  | # | Task Description | Manual Condition | AI Condition |
  |---|-----------------|-----------------|--------------|
  | T1 | Find your next lecture | Browse timetable UI | Ask chatbot |
  | T2 | Find a free hall right now | Browse hall explorer | Voice query |
  | T3 | Book appointment with lecturer | Navigate booking UI | Ask chatbot |
  | T4 | Navigate to next lecture room (indoor) | Browse map manually | Chatbot + guided floor plan (6.9) |
  | T4b | Navigate to CS building on map (outdoor) | Browse map manually | Voice/chat query |
  | T5 | Ask question in Sinhala/Tamil | Not available manually | Voice ASR + translation |
  | T6 | Switch language, find timetable | Not available manually | Translation + UI |
- [ ] Build frontend instrumentation:
  - Event logger service:
    - Track: page views, clicks, navigation, search queries
    - Timestamps for all events
    - Session ID + participant ID tagging
  - Task timer component:
    - Admin starts task timer for participant
    - Auto-records start time, end time, duration
    - Task success/failure recording
  - Error counter (track user errors per task)
- [ ] Build questionnaire forms (in-app):
  - Pre-study demographic form (age, role, tech familiarity)
  - Post-task rating (per task): satisfaction (1–5), difficulty (1–5)
  - System Usability Scale (SUS) — standard 10-item questionnaire
  - AI Trust Scale — custom 5-item:
    1. I trust the voice recognition to understand me correctly
    2. I trust the chatbot to give accurate information
    3. I trust the translation to be accurate
    4. I would use AI features regularly
    5. AI features made the platform more accessible
  - Open-ended feedback: "What did you like?", "What was frustrating?"
- [ ] Prepare consent forms and participant information sheets
- [ ] Data export pipeline: collect all data → JSON → CSV for analysis

---

### Sub-Phase 10.2 — Usability Study Execution (20+ participants)
**Type**: Research | **Effort**: ~2 days

- [ ] Pilot test with 2–3 participants:
  - Identify issues with tasks, timing, instruments
  - Refine task descriptions and questionnaires
  - Fix any platform bugs discovered
- [ ] Recruit 20+ participants:
  - ~10 students, ~7 lecturers, ~3 admins (minimum)
  - Ensure diversity: departments, age, tech familiarity
- [ ] Run usability sessions:
  - Brief participant (consent, overview)
  - Participant completes tasks in counterbalanced order
  - Record: task times, success, errors (via instrumentation)
  - Participant fills post-task ratings
  - Participant fills SUS + AI Trust + open feedback
  - Debrief participant
- [ ] Collect and organize all raw data:
  - Task completion times (CSV)
  - Task success rates (CSV)
  - Error counts (CSV)
  - SUS responses (CSV)
  - AI trust responses (CSV)
  - Satisfaction ratings (CSV)
  - Qualitative feedback (text file)
- [ ] Store in `/research/usability-study/raw-data/`

---

### Sub-Phase 10.3 — Usability Statistical Analysis
**Type**: Research | **Effort**: ~1.5 days

- [ ] Descriptive statistics:
  - Mean, median, std for task completion time (per task, per condition)
  - Task success rates
  - Mean SUS score + interpretation (above 68 = above average)
  - Mean AI trust scores per item
- [ ] Inferential statistics:
  | Comparison | Test |
  |-----------|------|
  | Task time: AI vs. manual (per task) | Paired t-test or Wilcoxon |
  | Task time across roles | One-way ANOVA or Kruskal-Wallis |
  | Satisfaction: AI vs. manual | Wilcoxon signed-rank |
  | AI trust ↔ task success correlation | Pearson or Spearman |
  | Effect size for all comparisons | Cohen's d |
  | 95% confidence intervals | For all mean differences |
- [ ] Qualitative analysis:
  - Thematic analysis of open-ended feedback
  - Code responses into themes
  - Count theme frequency
- [ ] Generate visualizations:
  - Task completion time comparison (AI vs. manual, grouped bar chart)
  - SUS score box plot
  - AI trust item scores bar chart
  - Satisfaction comparison per task
  - Time reduction percentage per task
- [ ] Write Usability Study Report:
  - Study design and methodology
  - Participant demographics
  - Task completion time results (AI vs. manual)
  - Task success rate results
  - SUS score interpretation
  - AI trust analysis
  - Qualitative feedback themes
  - Statistical test results (all p-values, effect sizes)
  - **Conclusion: Accept or reject H4 (≥25% time reduction)**
- [ ] Save report to `/research/reports/usability_study_report.md`

---

### Sub-Phase 10.4 — Production Hardening & Security Audit
**Type**: Engineering | **Effort**: ~1.5 days

- [ ] End-to-end integration testing:
  - Auth flows (register, login, protected routes)
  - Timetable generation and display
  - Hall availability queries
  - Appointment full lifecycle
  - Notification delivery
  - Map search and navigation
  - Voice input → ASR → chatbot → response
  - Language switching + translation
- [ ] API documentation (Swagger/OpenAPI):
  - Document all endpoints with request/response schemas
  - Authentication requirements noted
- [ ] Security audit:
  - SQL injection: verify Prisma parameterized queries
  - XSS: verify input sanitization, output encoding
  - CORS: proper origin configuration
  - Rate limiting: all public endpoints (including `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/registration/*`)
  - Email verification: bcrypt-hashed codes, single-use tokens, generic forgot-password responses, HTTPS in production, audit logging (`emailVerificationAudit.ts`); run `npx tsx scripts/audit-phase-12-5-security.ts`
  - JWT: verify secure storage, rotation
  - File upload: verify type/size validation
- [ ] Performance optimization:
  - Database query profiling (slow query log)
  - Frontend bundle size analysis (vite-plugin-visualizer)
  - Lazy loading for routes and heavy components
  - Image optimization
- [ ] Deployment:
  - Dockerfile for client, server, AI services
  - docker-compose for full stack
  - Environment variable management for production
  - Database migration strategy

---

### Sub-Phase 10.5 — Final Combined Research Report
**Type**: Research | **Effort**: ~1 day

- [ ] Compile combined evaluation summary:
  | RO | Research Question | Hypothesis | Result | Evidence |
  |----|------------------|------------|--------|----------|
  | RO-1 | RQ-1 (ASR) | H1 | Accept/Reject | Phase 7 report |
  | RO-2 | RQ-2 (NLP) | H2 | Accept/Reject | Phase 8 report |
  | RO-3 | RQ-3 (Translation) | H3 | Accept/Reject | Phase 9 report |
  | RO-4 | RQ-4 (Usability) | H4 | Accept/Reject | Phase 10 report |
  | RO-5 | Platform artifact | — | Complete | Engineering phases |
- [ ] Cross-cutting analysis:
  - How ASR quality affected chatbot usability
  - How translation quality affected multilingual task completion
  - End-to-end AI pipeline performance
  - Recommendations for production configuration
- [ ] Limitations and future work
- [ ] Final conclusions addressing all research objectives
- [ ] Save to `/research/reports/final_combined_report.md`

### Phase 10 Checkpoint
> After completing 10.1 + 10.2 + 10.3 + 10.4 + 10.5:
> - ✅ Usability study executed with 20+ participants
> - ✅ All statistical analyses completed
> - ✅ Platform production-ready and deployed
> - ✅ **Usability Study Report generated → answers RQ-4, tests H4**
> - ✅ **Final Combined Research Report generated**
> - ✅ **ALL 5 research objectives addressed with evidence**


---
---

## PHASE 11 — Indoor Navigation Module (Intelligent Faculty Routing)

### Research Context
> Phase 6B (6.4–6.9) delivered the indoor navigation **foundation**: floor plan upload,
> AI vision, markers, graph pathfinding, guided map, and chatbot hooks.
> Phase 11 completes the **intelligent navigation module** as an independent,
> production-ready feature — scalable to 3 buildings × 9+ floors without changing core routing logic.

**Detailed plan:** `docs/indoor-navigation/PHASE-11-PLAN.md`

### Faculty campus structure

| Building | Code | Current floors | Future |
|----------|------|----------------|--------|
| Administration | `ADMIN` | Ground, First | More floors later |
| Academic | `ACAD` | Ground, First | More floors later |
| Laboratory | `LAB` | Ground, First | More floors later |

**Connections:** ADMIN ↔ ACAD (direct) · ACAD ↔ LAB (direct) · ADMIN ↔ LAB (must route through ACAD)

### Design principles

1. **Building-agnostic core** — routing uses `MapBuilding.id`, `FloorPlan.floor`, graph topology only
2. **Floor-scalable** — new floor = upload JPG + analyze + markers + vertical links; no routing code changes
3. **Graph-first runtime** — AI runs at admin time; student routing reads `NavNode` + `NavEdge` only
4. **Module boundary** — APIs under `/api/indoor-nav/*` and `server/src/modules/indoor-navigation/`
5. **Progressive enhancement** — rule-based directions first; AI polish optional via engine :8004

### Functional requirement mapping

| Sub-Phase | Title | Requirement area |
|-----------|-------|------------------|
| 11.1 | Floor Plan Processing | Phase 1 — detect & store locations |
| 11.2 | Navigation Graph Creation | Phase 2 — nodes & edges model |
| 11.3 | Same-Floor Navigation | Phase 3 — within-floor routing |
| 11.4 | Multi-Floor Navigation | Phase 4 — vertical movement |
| 11.5 | Multi-Building Navigation | Phase 5 — cross-building routing |
| 11.6 | Natural Language Guidance | Phase 6 — human-friendly steps |
| 11.7 | Route Visualization | Phase 7 — path on floor plan |
| 11.8 | Admin Consolidation | Cross-cutting — operable without dev |
| 11.9 | Active Navigation & QR | Future-ready — live positioning |

---

### Sub-Phase 11.1 — Floor Plan Processing & Structured Location Storage
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 6.4, 6.4b | **Status**: ✅ (code) · ⚠️ (admin data — 32 floors uploaded; some locations unmarked where faculty gave no sectors)

- [x] Register 3 faculty buildings (`ADMIN`, `ACAD`, `LAB`) with floor metadata — seed + setup status API
- [x] Upload Ground + First floor JPG for each building (6 floor plans minimum) — **32 in-scope floor plans** (ACAD G–F9, ADMIN G–F9, LAB G–F11)
- [x] Calibrate each floor plan: `bounds`, `drawableRegion`, `scaleMetersPerUnit` — admin UI + `PATCH …/calibration`
- [x] Run AI analyze per floor (`analyze-ai` on upload or manual)
- [x] Mark **building connection points** as `ENTRANCE`/`EXIT` on ACAD↔ADMIN and ACAD↔LAB doorways — click-to-place UI
- [x] Admin review screen: approve / edit / delete auto-detected locations before publish
- [x] Link markers to real entities (`LectureHall`, `LecturerOffice`, labs)
- [x] Document floor-add procedure: `docs/indoor-navigation/ADD-FLOOR.md`

**Checkpoint:** All 6 current floors have reviewed markers including entrances, stairs, lifts, and inter-building connection points.

---

### Sub-Phase 11.2 — Navigation Graph Creation & Validation
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 11.1 | **Status**: ✅ (DB audit 2026-06-14: **32 / 32 in-scope floors healthy**)

- [x] Sync `MapMarker` → `NavNode` for all approved markers (`syncNavNodesFromMarkers`) — code + auto on lock/publish
- [x] Add **corridor junction** nodes at hallway intersections — manual path points + Connect on all in-scope floors
- [x] Place **STAIRS** and **LIFT** nodes on each floor where vertical movement exists — stairs/lift markers connected on in-scope floors (multi-floor pairing = 11.4)
- [x] Connect walkable edges along corridors (bidirectional, distance-weighted) — all in-scope floors connected
- [x] Attach edge metadata: `buildingId`, `floor`, direction (computed at route time) — implemented
- [x] Import or merge Python engine `nodes`/`edges` from analyze response into DB — implemented (`buildFloorNavigationGraph`; manual paths take precedence)
- [x] Graph validation: orphan nodes, disconnected components, missing entrance — implemented (`validateFloorNavGraph`; run `npx tsx scripts/check-phase-11-2.ts`)
- [x] Test same-floor preview route in admin editor — reliable on all 32 in-scope floors

**Audit 2026-06-14 (in-scope healthy — 32 floors):** ACAD G–F9 (10) · ADMIN G–F9 (10) · LAB G–F11 (12)

**Checkpoint:** Every in-scope floor has a connected graph; no orphan rooms; stairs/lifts exist as nodes. ✅ Met.

---

### Sub-Phase 11.3 — Same-Floor Navigation
**Type**: Engineering | **Effort**: ~1 day | **Depends on**: 11.2 | **Status**: ✅

- [x] Resolve start/end: marker ID, hall ID, office ID, or NL query → `NavNode`
- [x] Run A* (Dijkstra fallback) on single-floor subgraph
- [x] Generate turn-by-turn steps: exit room → walk straight → turn left/right → destination
- [x] Compute `distanceMeters` and `estimatedMinutes` from scale
- [x] Unify API responses: `POST /api/indoor-nav/route` and `GET /api/map/indoor-route`
- [x] Handle edge cases: same room, blocked graph, missing marker
- [x] Integration test: Lecture Hall A → Lecture Hall B (each building)

**Checkpoint:** Same-floor routing works for all buildings with human-readable steps.

---

### Sub-Phase 11.4 — Multi-Floor Navigation
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 11.3 | **Status**: ✅

- [x] **Vertical connector wizard** (admin): pair STAIRS/LIFT nodes across floors
- [x] Create bidirectional cross-floor `NavEdge` with labels (`stairs`, `lift`)
- [x] Extend pathfinding: prefer labeled vertical edges; apply floor-change penalty
- [x] Turn-by-turn: "Walk to staircase" → "Go up one floor" → "Exit staircase" → continue
- [x] Route response: `segments[]` per floor with `floor`, `buildingId`, `polyline`
- [x] UI floor switcher: auto-switch floor when step crosses boundary
- [x] Test: Ground floor entrance → First floor room (each building)

**Checkpoint:** Any two floors within one building route correctly with floor transition instructions.

---

### Sub-Phase 11.5 — Multi-Building Navigation
**Type**: Engineering | **Effort**: ~3 days | **Depends on**: 11.4 | **Status**: ✅

- [x] Define **campus connector model**: outdoor waypoints OR indoor exit→enter pairs
- [x] Pair ACAD↔ADMIN and ACAD↔LAB connection nodes (4 pairs minimum)
- [x] Implement **multi-leg router**: ADMIN→LAB = ADMIN→ACAD + ACAD→LAB (`legs[]` in route response)
- [x] Enforce topology: reject direct ADMIN→LAB path; ACAD as intermediary only
- [x] Building transition steps: "Exit Administration" → "Enter Academic" → … → "Enter Laboratory"
- [x] Chained timetable routes: class in ADMIN then LAB → full day route
- [x] Test: Administration office → Laboratory (via Academic)

**Checkpoint:** Any two locations in the faculty complex route correctly, respecting building topology. ✅ Met.

---

### Sub-Phase 11.6 — Natural Language Guidance (Unified Pipeline)
**Type**: Engineering | **Effort**: ~1.5 days | **Depends on**: 11.3 | **Status**: ✅

- [x] Single NL entry point: `/api/indoor-nav/navigation` and `/api/navigation/query` share logic
- [x] Intent detection: "Take me to X", "From A to B", "Guide me to next class"
- [x] Entity resolution: room names, halls, lecturers, buildings → `NavNode`
- [x] Always attach `polyline` + `steps` when graph exists; story text as supplement only
- [x] Standardize step vocabulary: walk straight, turn left/right, enter corridor, use staircase, enter {building}, destination reached
- [x] Optional AI polish via engine :8004 `/directions/generate` (graceful fallback)
- [x] Chatbot actions: `ActionGuideToRoom`, `ActionGuideToNextClass` use unified API
- [x] Voice: ASR transcript → same NL pipeline

**Checkpoint:** One query path produces consistent steps + map geometry for chatbot, voice, and web UI. ✅ Met.

---

### Sub-Phase 11.7 — Route Visualization on Floor Plans
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 11.3, 11.6 | **Status**: ✅

- [x] Merge map layer into primary student page (`/navigate` / `SimpleIndoorGuide`)
- [x] Draw start pin (green), destination pin (red), path polyline on floor plan JPG
- [x] Floor switcher: tabs or dropdown per `segments[].floor`
- [x] Building transition banner between legs ("Now entering Academic Building")
- [x] Step list synced with map: highlight current step; Previous / Next navigation
- [x] Deep links: `/map/guide?buildingId=&toHallId=` and chatbot links
- [x] Mobile: responsive floor plan, pinch zoom, bottom sheet for steps
- [x] Today mode: tab per class with chained multi-building visualization

**Checkpoint:** Student sees full route on floor plan with steps, floor switches, and building transitions.

---

### Sub-Phase 11.8 — Admin Consolidation & Publish Workflow
**Type**: Engineering | **Effort**: ~1.5 days | **Depends on**: 11.2 (parallel) | **Status**: ✅

- [x] Re-mount admin tools in `/admin/navigation`: Setup | Markers | Walking Paths | Vertical Links
- [x] Wire `IndoorMarkerEditor`, `IndoorNavGraphEditor` routes (currently orphaned)
- [x] Per-floor **publish status**: draft → reviewed → published (students see published only)
- [x] Health dashboard: vision engine 8003, nav engine 8004, graph connectivity
- [x] Seed / migration script for 3 buildings × 2 floors demo data

**Checkpoint:** Admin can set up a new floor end-to-end without touching code.

---

### Sub-Phase 11.9 — Active Navigation & QR Positioning (Future-Ready)
**Type**: Engineering | **Effort**: ~2 days | **Depends on**: 11.7 | **Status**: ✅

- [x] Re-enable `QrScanPage` at `/navigate/scan` or `/map/scan`
- [x] QR scan → `POST /api/indoor-nav/position/qr` → update session `currentNodeId`
- [x] Re-route from scanned position to destination
- [x] Step index advances on floor change / QR rescan
- [x] Stub `BLE_BEACON` / `UWB` providers behind `PositionProvider` interface

**Checkpoint:** QR-based "you are here" with rerouting works on one test floor.

### Phase 11 Checkpoint (final target)
> After completing 11.1–11.9:
> - ✅ Floor plans processed with reviewed locations and connection points
> - ✅ Navigation graph validated across all floors and buildings
> - ✅ Same-floor, multi-floor, and multi-building routing with step-by-step instructions
> - ✅ Unified NL guidance via chatbot, voice, and web
> - ✅ Full route visualization on floor plans
> - ✅ Admin can add new floors without code changes
> - ✅ QR active navigation ready for usability study (Phase 10, task T4)

### Recommended execution order

```
11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7 → 11.9
         ↑
       11.8 (admin, parallel with 11.2–11.4)
```

**MVP milestone:** 11.1 → 11.3 (same-floor navigation with map, ~5 days)


---
---

## PHASE 12 — Self-Service Password Reset via Email

### Research Context
> Phase 2 delivered JWT auth, registration, and admin-only password reset.
> Users (student, lecturer, admin) who forget their password currently have
> no self-service recovery path. Phase 12 adds **email-based verification codes**
> so any registered user can reset their password without admin intervention.

### Design principles

1. **One system sender** — the server sends mail using **one** configured mailbox (Gmail, Outlook/Office 365, or transactional API). User mailboxes (Gmail, Outlook, `@kln.ac.lk`, etc.) are **recipients only** — no per-user SMTP credentials.
2. **Registered email only** — lookup uses `User.email` from registration (same field for all roles).
3. **No account enumeration** — API always returns a generic success message whether or not the email exists.
4. **Short-lived codes** — 6-digit (or secure token) with expiry (e.g. 10–15 minutes), single use, hashed at rest.
5. **Server-only secrets** — SMTP/API credentials live in `server/.env`, never in the React client.

### Email flow (how mail reaches the user)

```
User clicks "Forgot password?" → enters registered email
        ↓
Server finds active user (if any) → generates code → stores hash + expiry
        ↓
Server sends email FROM system mailbox (e.g. lecstu-noreply@gmail.com)
        TO user's registered address (Gmail / Outlook / university mail — any provider)
        ↓
User opens inbox → enters code + new password → server verifies → password updated
```

### Credential placement

| Item | Where | Example |
|------|-------|---------|
| SMTP host, port, user, password | `server/.env` | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| Documented placeholders | `server/.env.example` | Same keys, no real secrets |
| Dev fallback | `NODE_ENV=development` | Log code to server console if `SMTP_DISABLED=true` |

**Gmail sender** → students with Outlook (or any provider) still receive mail normally.  
**Outlook/Office 365 sender** → students with Gmail still receive mail normally.

### Functional requirement mapping

| Sub-Phase | Title | Deliverable |
|-----------|-------|-------------|
| 12.1 | Email Service & SMTP Configuration | Nodemailer (or equivalent) + env vars |
| 12.2 | Password Reset Data Model & Token Service | DB table + code generation/hashing |
| 12.3 | Forgot Password Backend API | Request code, verify, set new password |
| 12.4 | Frontend Forgot / Reset Password UI | Login link + 2-step reset pages |
| 12.5 | Security, Rate Limiting & Deliverability | Abuse prevention + production SMTP |
| 12.6 | Testing, Documentation & Production Cutover | E2E tests + `runnableCommand.md` notes |

---

### Sub-Phase 12.1 — Email Service & SMTP Configuration
**Type**: Engineering | **Effort**: ~0.5 day | **Depends on**: 2.1 | **Status**: ✅

- [x] Install `nodemailer` (+ `@types/nodemailer`) in `/server`
- [x] Create mail service module (`/server/src/services/emailService.ts`):
  - `sendMail({ to, subject, text, html })` — unified send interface
  - Read config from environment; fail gracefully with clear log if misconfigured
  - Development mode: optional `SMTP_DISABLED=true` → log email body to console instead of sending
- [x] Add environment variables to `server/.env.example`:
  ```env
  # Email (password reset — Phase 12)
  SMTP_HOST=smtp.gmail.com              # Gmail: smtp.gmail.com | Outlook/M365: smtp.office365.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=lecstu-noreply@gmail.com    # YOUR system sender (not the user's email)
  SMTP_PASS=your-app-password-here      # Gmail App Password or M365 app password
  MAIL_FROM="LECSTU <lecstu-noreply@gmail.com>"
  SMTP_DISABLED=false                   # true in local dev without SMTP
  ```
- [x] Document sender setup:
  - **Gmail**: enable 2FA → create [App Password](https://myaccount.google.com/apppasswords)
  - **Outlook / Microsoft 365**: `smtp.office365.com`, port 587; may require IT approval for `@kln.ac.lk`
  - **Optional production**: SendGrid / Resend / AWS SES (API key instead of SMTP)
- [x] Create HTML + plain-text email templates for reset code:
  - Subject: `LECSTU password reset code`
  - Body: user first name (if known), 6-digit code, expiry time, "ignore if you didn't request this"
- [x] Smoke test: `POST /api/admin/settings/test-email` (admin Settings UI) + console mode when `SMTP_DISABLED=true`

**Checkpoint:** Server can send a test email using credentials in `server/.env`. Admin **Settings → Email verification** shows read-only SMTP placeholders and test button.

---

### Sub-Phase 12.2 — Password Reset Data Model & Token Service
**Type**: Engineering | **Effort**: ~0.5 day | **Depends on**: 12.1 | **Status**: ✅

- [x] Add Prisma model `PasswordResetToken` (or equivalent):
  ```prisma
  model PasswordResetToken {
    id        String   @id @default(uuid())
    userId    String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    codeHash  String   // bcrypt hash of 6-digit code (never store plain code)
    expiresAt DateTime
    usedAt    DateTime?
    createdAt DateTime @default(now())
    @@index([userId])
    @@index([expiresAt])
  }
  ```
- [x] Run migration: `20260619120000_password_reset_tokens`
- [x] Create token service (`/server/src/services/passwordResetService.ts`):
  - `generateResetCode()` → 6-digit numeric string (crypto-secure random)
  - `createResetToken(userId)` → invalidate prior unused tokens for user, store new hash + expiry (15 min)
  - `verifyResetCode(userId, code)` → check hash, expiry, not used
  - `verifyResetCodeByEmail(email, code)` — helper for Phase 12.3
  - `markResetTokenUsed(tokenId)` → set `usedAt`
  - `purgeExpiredResetTokens()` → cleanup expired / old used tokens
- [x] Constants: `RESET_CODE_EXPIRY_MINUTES = 15`, `RESET_CODE_LENGTH = 6`
- [x] Smoke test script: `npx tsx scripts/test-password-reset-token.ts [email]`

**Checkpoint:** Can create, verify, and expire tokens in DB without API exposure yet.

---

### Sub-Phase 12.3 — Forgot Password Backend API
**Type**: Engineering | **Effort**: ~1 day | **Depends on**: 12.2 | **Status**: ✅

- [x] Add validation rules in `/server/src/middleware/validate.ts`:
  - `forgotPasswordRules` — email required, normalized
  - `verifyResetCodeRules` — email + 6-digit code
  - `resetPasswordRules` — email + code + new password
- [x] Add controller (`/server/src/controllers/passwordResetController.ts`):
  - **`POST /api/auth/forgot-password`**
  - **`POST /api/auth/verify-reset-code`**
  - **`POST /api/auth/reset-password`**
- [x] Register routes in `/server/src/routes/auth.ts` (public, no JWT required)
- [x] Apply strict rate limiting (`passwordResetForgotIpLimiter`, `passwordResetForgotEmailLimiter`, `passwordResetAttemptLimiter`)
- [x] Log security events via `/server/src/utils/emailVerificationAudit.ts` (no plain codes)
- [x] Integration helper: `npx tsx scripts/test-password-reset-api.ts [email] [code]`

**Checkpoint:** Postman/curl can request code, receive email (or dev console log), and reset password.

---

### Sub-Phase 12.4 — Frontend Forgot / Reset Password UI
**Type**: Engineering | **Effort**: ~1 day | **Depends on**: 12.3 | **Status**: ✅

- [x] Add API client methods (`/client/src/services/authApi.ts`):
  - `forgotPassword(email)`
  - `verifyResetCode(email, code)`
  - `resetPassword(email, code, newPassword)`
- [x] **Forgot Password page** (`/client/src/pages/ForgotPassword.tsx`):
  - Route: `/forgot-password`
  - Form: email input → submit → show "Check your email" success state
  - Link to `/reset-password?email=...` and back to `/login`
- [x] **Reset Password page** (`/client/src/pages/ResetPassword.tsx`):
  - Route: `/reset-password` with `?email=` pre-fill
  - Step 1: email + 6-digit code (paste support)
  - Step 2: new password + confirm password
  - Success → redirect to `/login` with toast
- [x] Update **Login page** — "Forgot password?" link
- [x] Register routes in `App.tsx` (public, redirect if already signed in)
- [x] Match `AuthLayout` styling; client-side validation

**Checkpoint:** Full UI flow works for student, lecturer, and admin test accounts.

---

### Sub-Phase 12.5 — Security, Rate Limiting & Deliverability
**Type**: Engineering | **Effort**: ~0.5 day | **Depends on**: 12.3, 12.4 | **Status**: ✅

- [x] Security checklist:
  - [x] Codes hashed at rest (bcrypt); never returned in API responses
  - [x] Single-use tokens; new request invalidates previous unused codes
  - [x] Generic API messages (no "email not found")
  - [x] Rate limits on all email verification endpoints (password reset + registration)
  - [x] New password cannot equal old password
  - [x] HTTPS required in production for auth routes (`requireHttpsInProduction`)
- [x] Email deliverability:
  - [x] Set proper `MAIL_FROM` display name
  - [x] Plain-text + HTML multipart body
  - [x] Manual delivery testing documented (Gmail, Outlook, `@kln.ac.lk` — see `runnableCommand.md`)
  - [x] Spam-folder note in UI (Forgot Password, Reset Password, Register)
- [x] Production sender options documented:
  - Dev: Gmail app password (`server/.env.example`, `runnableCommand.md`)
  - University: `noreply@kln.ac.lk` via Office 365 SMTP (coordinate with IT)
  - Scale: SendGrid/Resend API (future swap behind `emailService` interface)
- [x] Security audit script: `npx tsx scripts/audit-phase-12-5-security.ts`
- [x] Include password-reset and registration verification flows in Phase 10.4 security audit scope

**Checkpoint:** Pen-test style review passes; emails land reliably in test inboxes.

---

### Sub-Phase 12.6 — Testing, Documentation & Production Cutover
**Type**: Engineering | **Effort**: ~0.5 day | **Depends on**: 12.5 | **Status**: ✅

- [x] Manual test matrix (all roles) — `docs/email-verification/PHASE-12-6-TEST-MATRIX.md`

  | Role | Registered email type | Steps |
  |------|----------------------|-------|
  | Student | Gmail | forgot → code → reset → login |
  | Student | Outlook / `@kln.ac.lk` | same |
  | Lecturer | university mail | same |
  | Admin | any | same |
  | Unknown email | — | generic message, no email sent |
  | Expired code | — | reject with clear message |
  | Wrong code | — | reject; rate limit after N tries |
  | Inactive account | — | generic message, no reset |

- [x] Playwright e2e: `tests/password-reset-flow.spec.ts` (`npm run test:password-reset`)
- [x] Automated API suite: `server/scripts/run-phase-12-6-tests.ts` (`npm run test:phase-12-6`)
- [x] Update `runnableCommand.md` — SMTP setup, audit, test commands
- [x] Update `server/.env.example` (Phase 12.5) + production cutover checklist in test matrix doc
- [x] Admin password reset in User Management **unchanged** (`PATCH /admin/users/:id/password`)

**Checkpoint:** Documented, tested, ready for production `.env` with real sender credentials.

### Phase 12 Checkpoint (final target)
> After completing 12.1–12.6:
> - ✅ System sender configured (Gmail or Outlook) in `server/.env`
> - ✅ Any registered user (student / lecturer / admin) can self-reset via email code
> - ✅ Codes expire, are single-use, and rate-limited
> - ✅ UI linked from Login page; works with Gmail, Outlook, and university inboxes
> - ✅ No user SMTP credentials required; only one app mailbox on the server

### Recommended execution order

```
12.1 → 12.2 → 12.3 → 12.4 → 12.5 → 12.6
```

**MVP milestone:** 12.1 → 12.3 → 12.4 (backend + basic UI, ~2 days)


---
---

# ════════════════════════════════════════════════════════════════
# RESEARCH OUTPUT SUMMARY
# ════════════════════════════════════════════════════════════════

## Final Research Deliverables Checklist

| # | Deliverable | Sub-Phase | RO | Status |
|---|-------------|-----------|-----|--------|
| D1 | Research environment + experiment framework | 1.3 | RO-5 | ⬜ |
| D2 | Platform artifact (complete web application) | 1.1–6.9 | RO-5 | ⬜ |
| D12 | Indoor guidance foundation (JPG floor plans + chatbot routes) | 6.4–6.9 | RO-5, RO-2 | ✅ |
| D13 | **Intelligent indoor navigation module** (multi-floor/building, unified UX) | 11.1–11.9 | RO-5, RO-2 | ✅ |
| D14 | **Self-service password reset via email** (verification code flow) | 12.1–12.6 | RO-5 | ✅ |
| D3 | ASR benchmark dataset (150+ utterances, 3 languages) | 7.2 | RO-1 | ⬜ |
| D4 | **ASR Benchmark Report** (WER, latency, statistics) | 7.4 | RO-1 | ⬜ |
| D5 | Rasa chatbot trained model + training data | 8.2 | RO-2 | ⬜ |
| D6 | **NLP Evaluation Report** (F1, confusion matrix, entity eval) | 8.4 | RO-2 | ✅ |
| D7 | Parallel translation corpus (300+ pairs) | 9.2 | RO-3 | ⬜ |
| D8 | **Translation Evaluation Report** (BLEU, human eval, stats) | 9.5 | RO-3 | ✅ |
| D9 | Usability study raw data + instruments | 10.2 | RO-4 | ⬜ |
| D10 | **Usability Study Report** (task times, SUS, AI trust) | 10.3 | RO-4 | ⬜ |
| D11 | **Final Combined Research Evaluation Report** | 10.5 | ALL | ⬜ |


# ════════════════════════════════════════════════════════════════
# PHASE & SUB-PHASE DEPENDENCY MAP
# ════════════════════════════════════════════════════════════════
#
#   ENGINEERING FOUNDATION (Platform Artifact — RO-5)
#   ──────────────────────────────────────────────────
#   1.1 → 1.2 → 1.3
#                 ↓
#   2.1 → 2.2 → 2.3
#                 ↓
#   3.1 → 3.2 → 3.3 → 3.4
#                       ↓
#   4.1 → 4.2 → 4.3
#                 ↓
#   5.1 → 5.2 → 5.3
#                 ↓
#   6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7 → 6.8 → 6.9
#         (4.1 feeds 6.7)              (8.2 feeds 6.9)
#                 ↓
#   ══════════════════════════════════════
#   RESEARCH EXPERIMENTATION (RO-1,2,3,4)
#   ══════════════════════════════════════
#                 ↓
#   7.1 → 7.2 → 7.3 → 7.4
#                       ↓
#   8.1 → 8.2 → 8.3 → 8.4
#                       ↓
#   9.1 → 9.2 → 9.3 → 9.4 → 9.5
#                             ↓
#   10.1 → 10.2 → 10.3 → 10.4 → 10.5
#
#   INDOOR NAVIGATION MODULE COMPLETION (RO-5)
#   ──────────────────────────────────────────
#   6.4 → 6.5 → 6.6 → 6.7 → 6.8 → 6.9  (foundation — done)
#                       ↓
#   11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7 → 11.9
#         11.8 (admin, parallel)
#         (8.2 feeds 11.6; 4.1 feeds 11.5.7, 11.7.8)
#
#   PASSWORD RESET (RO-5 — extends Phase 2 auth)
#   ─────────────────────────────────────────────
#   2.1 → 12.1 → 12.2 → 12.3 → 12.4 → 12.5 → 12.6
#         (feeds 10.4 security audit)
#
# ════════════════════════════════════════════════════════════════
# ESTIMATED EFFORT (By Sub-Phase)
# ════════════════════════════════════════════════════════════════
#
#   1.1  Monorepo Setup ................... ~1    day
#   1.2  Database Schema .................. ~1.5  days
#   1.3  Research Environment ............. ~1    day
#   2.1  Backend Auth ..................... ~1    day
#   2.2  Frontend Auth ................... ~1    day
#   2.3  Profile & Upload ................ ~0.5  day
#   3.1  Admin Shell ..................... ~0.5  day
#   3.2  Timetable CRUD .................. ~2    days
#   3.3  Groups/Halls/Offices ............ ~1.5  days
#   3.4  Map Data Admin .................. ~1    day
#   4.1  Timetable Engine ................ ~1.5  days
#   4.2  Hall Availability ............... ~1    day
#   4.3  Lecturer Availability ........... ~1    day
#   5.1  Appointment Backend ............. ~1.5  days
#   5.2  Notification System ............. ~1.5  days
#   5.3  Appointment/Notif Frontend ...... ~1    day
#   6.1  Leaflet Map + Markers ........... ~1.5  days
#   6.2  Map Search + Live Status ........ ~1    day
#   6.3  Admin Map + Mobile .............. ~0.5  day
#   6.4  Floor Plan JPG Pipeline ......... ~1    day
#   6.5  Indoor Marker Placement ......... ~2    days
#   6.6  Nav Graph + Pathfinding ......... ~2    days
#   6.7  Today on Campus API ............. ~1    day
#   6.8  Guided Map UI + Route API ....... ~2    days
#   6.9  Chatbot Indoor Guidance ......... ~1.5  days
#   7.1  ASR Service Implementation ...... ~2    days
#   7.2  ASR Dataset Curation ............ ~1.5  days
#   7.3  ASR Benchmark Experiments ....... ~1    day
#   7.4  ASR Statistical Report .......... ~1    day
#   8.1  Rasa Setup & Intents ............ ~1.5  days
#   8.2  Training Data & Actions ......... ~2    days
#   8.3  NLP Evaluation .................. ~1    day
#   8.4  NLP Error Analysis & Report ..... ~1    day
#   9.1  Translation Service ............. ~1.5  days
#   9.2  Parallel Corpus ................. ~1.5  days
#   9.3  Automated Benchmarks ............ ~1    day
#   9.4  Human Evaluation ................ ~1.5  days
#   9.5  Translation Report .............. ~1    day
#   10.1 Usability Instruments ........... ~2    days
#   10.2 Study Execution ................. ~2    days
#   10.3 Statistical Analysis ............ ~1.5  days
#   10.4 Production Hardening ............ ~1.5  days
#   10.5 Final Combined Report ........... ~1    day
#   11.1 Floor Plan Processing ........... ~2    days
#   11.2 Nav Graph Creation .............. ~2    days
#   11.3 Same-Floor Navigation ........... ~1    day
#   11.4 Multi-Floor Navigation .......... ~2    days
#   11.5 Multi-Building Navigation ....... ~3    days
#   11.6 NL Guidance (Unified) ........... ~1.5  days
#   11.7 Route Visualization ............. ~2    days
#   11.8 Admin Consolidation ............. ~1.5  days
#   11.9 Active Nav & QR ................. ~2    days
#   12.1 Email Service & SMTP ............ ~0.5  day
#   12.2 Reset Token Model ............... ~0.5  day
#   12.3 Forgot Password API ............. ~1    day
#   12.4 Forgot/Reset UI ................. ~1    day
#   12.5 Security & Deliverability ....... ~0.5  day
#   12.6 Testing & Documentation ......... ~0.5  day
#   ─────────────────────────────────────────────────
#   TOTAL: 63 Sub-Phases ≈ 76–81 working days (incl. 6.4–6.9 + 11.1–11.9 + 12.1–12.6)
#
# ════════════════════════════════════════════════════════════════
# END OF REFERENCE DOCUMENT
# ════════════════════════════════════════════════════════════════

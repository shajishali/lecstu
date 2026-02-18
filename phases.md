# ════════════════════════════════════════════════════════════════
# LECSTU — AI-Integrated Academic Platform
# RESEARCH-DRIVEN Development Phases (10 Phases, 42 Sub-Phases)
# ════════════════════════════════════════════════════════════════
# STATUS       : REFERENCE DOCUMENT — DO NOT MODIFY
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
| **1.1** | Monorepo & Dev Environment Setup | Engineering | RO-5 | ⬜ |
| **1.2** | Database Schema Design & Migration | Engineering | RO-5 | ⬜ |
| **1.3** | Research Environment & Experiment Framework | Research | RO-5 | ✅ |
| **2.1** | Backend Auth System (JWT + RBAC) | Engineering | RO-5 | ✅ |
| **2.2** | Frontend Auth UI & State Management | Engineering | RO-5 | ⬜ |
| **2.3** | User Profile & File Upload | Engineering | RO-5 | ⬜ |
| **3.1** | Admin Dashboard Shell & Layout | Engineering | RO-5 | ⬜ |
| **3.2** | Master Timetable Management | Engineering | RO-5 | ⬜ |
| **3.3** | Student Group & Hall & Office Management | Engineering | RO-5 | ⬜ |
| **3.4** | Faculty Map Data Management (Admin) | Engineering | RO-5 | ⬜ |
| **4.1** | Student Timetable Generation Engine | Engineering | RO-5 | ⬜ |
| **4.2** | Hall Availability Detection System | Engineering | RO-5 | ⬜ |
| **4.3** | Lecturer Availability & Frontend Views | Engineering | RO-5 | ⬜ |
| **5.1** | Appointment Booking Backend | Engineering | RO-5 | ⬜ |
| **5.2** | Notification System (Backend + Real-time) | Engineering | RO-5 | ⬜ |
| **5.3** | Appointment & Notification Frontend | Engineering | RO-5 | ⬜ |
| **6.1** | Leaflet Map Integration & Building Markers | Engineering | RO-5 | ⬜ |
| **6.2** | Map Search, Navigation & Live Status | Engineering | RO-5 | ⬜ |
| **6.3** | Admin Map Tools & Mobile Responsiveness | Engineering | RO-5 | ⬜ |
| **7.1** | ASR Service Implementation (Whisper + Google) | Engineering | RO-1 | ⬜ |
| **7.2** | ASR Dataset Curation & Ground Truth | Research | RO-1 | ⬜ |
| **7.3** | ASR Benchmark Experiments (WER + Latency) | Research | RO-1 | ⬜ |
| **7.4** | ASR Statistical Analysis & Report | Research | RO-1 | ⬜ |
| **8.1** | Rasa Chatbot Setup & Intent Design | Engineering | RO-2 | ⬜ |
| **8.2** | Chatbot Training Data & Custom Actions | Research | RO-2 | ⬜ |
| **8.3** | NLP Evaluation (Cross-validation + Confusion Matrix) | Research | RO-2 | ⬜ |
| **8.4** | NLP Error Analysis & Report | Research | RO-2 | ⬜ |
| **9.1** | Translation Service Implementation | Engineering | RO-3 | ⬜ |
| **9.2** | Parallel Corpus Curation | Research | RO-3 | ⬜ |
| **9.3** | Automated Translation Benchmarks (BLEU + Similarity) | Research | RO-3 | ⬜ |
| **9.4** | Human Evaluation & Inter-rater Analysis | Research | RO-3 | ⬜ |
| **9.5** | Translation Comparative Report | Research | RO-3 | ⬜ |
| **10.1** | Usability Instruments & Frontend Instrumentation | Research | RO-4 | ⬜ |
| **10.2** | Usability Study Execution (20+ participants) | Research | RO-4 | ⬜ |
| **10.3** | Usability Statistical Analysis | Research | RO-4 | ⬜ |
| **10.4** | Production Hardening & Security Audit | Engineering | RO-5 | ⬜ |
| **10.5** | Final Combined Research Report | Research | ALL | ⬜ |


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
**Type**: Engineering | **Effort**: ~1 day

- [ ] Initialize monorepo with folder structure:
  ```
  lecstu/
    /client              ← Vite + React frontend
    /server              ← Node.js + Express backend (MVC)
    /ai-services         ← AI modules (ASR, chatbot, translation)
    /research            ← Research experiments, datasets, reports
    /shared              ← Shared types/constants
    phases.md            ← This reference document
  ```
- [ ] Initialize `/client` with Vite + React + TypeScript
- [ ] Initialize `/server` with Express + TypeScript:
  - `/server/src/controllers/`
  - `/server/src/models/`
  - `/server/src/routes/`
  - `/server/src/middleware/`
  - `/server/src/services/`
  - `/server/src/utils/`
  - `/server/src/config/`
- [ ] Install core dependencies (both client and server)
- [ ] Configure ESLint, Prettier, TypeScript configs
- [ ] Setup `.env` management with `.env.example`
- [ ] Configure development scripts (`dev`, `build`, `lint`)
- [ ] Verify both client and server run in development mode

---

### Sub-Phase 1.2 — Database Schema Design & Migration
**Type**: Engineering | **Effort**: ~1.5 days

- [ ] Install and configure PostgreSQL connection
- [ ] Install and initialize Prisma ORM
- [ ] Design complete database schema:
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
- [ ] Add composite indexes:
  - `MasterTimetable`: (dayOfWeek, startTime, hallId)
  - `MasterTimetable`: (dayOfWeek, startTime, lecturerId)
  - `MasterTimetable`: (groupId, dayOfWeek)
  - `Appointment`: (lecturerId, dateTime)
  - `Notification`: (userId, isRead)
- [ ] Run initial migration
- [ ] Create seed script with sample academic data:
  - 3 faculties, 6 departments
  - 20 lecturers, 100 students, 2 admins
  - 10 lecture halls, 15 courses
  - 5 student groups with weekly timetable entries
- [ ] Verify seed data loads correctly

---

### Sub-Phase 1.3 — Research Environment & Experiment Framework
**Type**: Research | **Effort**: ~1 day

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

- [ ] Install frontend dependencies: axios, react-router-dom, zustand (or React Context)
- [ ] Create auth state management (store/context):
  - State: user, isAuthenticated, isLoading, role
  - Actions: login, register, logout, refreshToken, getMe
- [ ] Create API client with interceptors:
  - Attach access token to requests
  - Auto-refresh on 401 response
  - Redirect to login on auth failure
- [ ] Build auth pages:
  - **Login page** — email/password form, validation, error display
  - **Register page** — name, email, password, role selection, validation
- [ ] Build `ProtectedRoute` wrapper component:
  - Redirect to login if not authenticated
  - Role-based access check (show 403 for unauthorized roles)
- [ ] Build app shell layout:
  - Top navbar with user info and logout
  - Role-aware sidebar navigation
- [ ] Wire up routing:
  - Public: `/login`, `/register`
  - Protected: `/dashboard` (role-redirected)

---

### Sub-Phase 2.3 — User Profile & File Upload
**Type**: Engineering | **Effort**: ~0.5 day

- [ ] Install and configure Multer for file uploads:
  - Storage config (disk or cloud)
  - File type validation (images only)
  - Size limit (5MB)
  - Serve uploaded files via static route
- [ ] Build profile controller (`/server/src/controllers/profileController.js`):
  - `GET /api/profile` — get own profile
  - `PATCH /api/profile` — update name, department, etc.
  - `POST /api/profile/avatar` — upload profile image
- [ ] Build frontend profile page:
  - View profile information
  - Edit form (name, department)
  - Avatar upload with preview
- [ ] Input validation for profile updates

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

### Sub-Phase 3.1 — Admin Dashboard Shell & Layout
**Type**: Engineering | **Effort**: ~0.5 day

- [ ] Build admin layout component:
  - Sidebar navigation (links to all admin modules)
  - Header with breadcrumbs
  - Main content area
- [ ] Build admin dashboard home:
  - Stats cards: total students, lecturers, halls, courses, groups
  - Quick-action buttons
- [ ] Admin route guard (only `ADMIN` role can access `/admin/*`)
- [ ] Reusable UI components for admin:
  - Data table with pagination, sorting, search
  - Modal for create/edit forms
  - Confirmation dialog for delete
  - Toast notifications for success/error

---

### Sub-Phase 3.2 — Master Timetable Management
**Type**: Engineering | **Effort**: ~2 days

- [ ] Build timetable controller (`/server/src/controllers/timetableController.js`):
  - `POST /api/admin/timetable` — create entry
  - `GET /api/admin/timetable` — list all (paginated, filtered)
  - `GET /api/admin/timetable/:id` — get single
  - `PATCH /api/admin/timetable/:id` — update entry
  - `DELETE /api/admin/timetable/:id` — delete entry
  - `POST /api/admin/timetable/bulk-import` — CSV/Excel upload
- [ ] Timetable conflict detection service:
  - Hall conflict: same hall, same day, overlapping time
  - Lecturer conflict: same lecturer, same day, overlapping time
  - Group conflict: same group, same day, overlapping time
  - Return detailed conflict info on creation/update
- [ ] CSV/Excel parser for bulk import (Multer + csv-parser or xlsx)
- [ ] Frontend timetable management:
  - Data table view (filterable by day, lecturer, hall, group)
  - Weekly calendar grid view (visual timetable)
  - Create/edit form with dropdown selectors (courses, lecturers, halls, groups)
  - Bulk import page with file upload + preview + validation
  - Conflict error display (highlighted cells)

---

### Sub-Phase 3.3 — Student Group, Hall & Office Management
**Type**: Engineering | **Effort**: ~1.5 days

- [ ] Student Group management:
  - CRUD API: `POST/GET/PATCH/DELETE /api/admin/groups`
  - Assign students to groups: `POST /api/admin/groups/:id/students`
  - Bulk student assignment via CSV
  - Frontend: group list, create/edit, student assignment UI
- [ ] Lecture Hall management:
  - CRUD API: `POST/GET/PATCH/DELETE /api/admin/halls`
  - Fields: name, building, floor, capacity, equipment list, isActive
  - Frontend: hall list with capacity/equipment info, create/edit form
- [ ] Lecturer Office management:
  - CRUD API: `POST/GET/PATCH/DELETE /api/admin/offices`
  - Link to lecturer profile
  - Frontend: office list, create/edit, lecturer linking
- [ ] Audit logging service:
  - Log admin actions (who did what, when)
  - `AuditLog` table: userId, action, entity, entityId, details, timestamp

---

### Sub-Phase 3.4 — Faculty Map Data Management (Admin)
**Type**: Engineering | **Effort**: ~1 day

- [ ] Map data APIs:
  - `POST/GET/PATCH/DELETE /api/admin/buildings` — building CRUD
  - `POST/GET/PATCH/DELETE /api/admin/markers` — marker CRUD
  - `POST /api/admin/buildings/:id/floorplan` — upload floor plan image
- [ ] Link map markers to database entities:
  - Marker type: `HALL`, `OFFICE`, `LAB`, `AMENITY`, `ENTRANCE`
  - Each marker references an entityId (hallId or officeId)
- [ ] Frontend admin map tools:
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

- [ ] Build timetable generation service (`/server/src/services/timetableService.js`):
  - Input: studentId → find group(s) → query master timetable for those groups
  - Output: structured weekly timetable (array of day → slots)
  - Handle edge cases: student in multiple groups, elective courses
- [ ] API endpoints:
  - `GET /api/timetable/my` — current user's timetable (student or lecturer)
  - `GET /api/timetable/student/:id` — specific student (admin only)
  - `GET /api/timetable/lecturer/:id` — specific lecturer schedule
- [ ] Caching layer:
  - Cache generated timetables (Redis or in-memory)
  - Invalidate when master timetable changes
  - Cache-Control headers for frontend
- [ ] Frontend student timetable view:
  - Weekly grid layout (Monday–Friday, time slots)
  - Color-coded by course
  - Click slot → show details (hall, lecturer, room)
  - Current time indicator line
  - Print/export option

---

### Sub-Phase 4.2 — Hall Availability Detection System
**Type**: Engineering | **Effort**: ~1 day

- [ ] Build hall availability service (`/server/src/services/hallService.js`):
  - Query master timetable for hall occupancy
  - Compute free slots for a given day
  - "Available right now" — compare current time against schedule
- [ ] API endpoints:
  - `GET /api/halls/available` — query: day, startTime, endTime, minCapacity, building, equipment
  - `GET /api/halls/:id/schedule` — full day schedule for a hall
  - `GET /api/halls/available-now` — halls free at this moment
- [ ] Frontend hall availability explorer:
  - Filter panel: day, time range, capacity, building, equipment
  - Results grid: hall name, capacity, available time slots
  - "Available Now" quick-view tab
  - Visual timeline for each hall

---

### Sub-Phase 4.3 — Lecturer Availability & Frontend Views
**Type**: Engineering | **Effort**: ~1 day

- [ ] Build lecturer availability service (`/server/src/services/lecturerService.js`):
  - Derive free slots from timetable (inverse of teaching schedule)
  - Exclude existing accepted appointments
  - Weekly availability grid (per 30-min or 1-hour slots)
- [ ] API endpoints:
  - `GET /api/lecturers/:id/availability` — weekly free slots
  - `GET /api/lecturers/:id/availability?date=` — specific date free slots
  - `GET /api/lecturers` — list all lecturers (with basic info)
- [ ] Frontend lecturer views:
  - Lecturer directory (searchable list with department filter)
  - Lecturer profile card (photo, department, office, courses)
  - Availability grid (green = free, gray = teaching, red = booked)
- [ ] Performance optimization:
  - Ensure all timetable queries use indexed columns
  - Profile slow queries and add covering indexes if needed

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

- [ ] Build appointment controller (`/server/src/controllers/appointmentController.js`):
  - `POST /api/appointments` — student creates request (lecturerId, dateTime, duration, reason)
  - `GET /api/appointments` — list own appointments (filtered by status, date range)
  - `GET /api/appointments/:id` — single appointment details
  - `PATCH /api/appointments/:id/accept` — lecturer accepts
  - `PATCH /api/appointments/:id/reject` — lecturer rejects (with reason)
  - `PATCH /api/appointments/:id/reschedule` — propose new time
  - `DELETE /api/appointments/:id` — cancel (by student or lecturer)
- [ ] Booking validation service:
  - Check lecturer is free at requested time (no teaching, no other appointment)
  - Check student has no conflicting appointment
  - Prevent booking in the past
  - Enforce minimum notice period (e.g., 24 hours ahead)
- [ ] Status flow enforcement:
  - `PENDING → ACCEPTED | REJECTED`
  - `ACCEPTED → COMPLETED | CANCELLED`
  - `PENDING → CANCELLED` (by requester)
  - Only valid transitions allowed

---

### Sub-Phase 5.2 — Notification System (Backend + Real-time)
**Type**: Engineering | **Effort**: ~1.5 days

- [ ] Build notification service (`/server/src/services/notificationService.js`):
  - `createNotification(userId, type, title, message)` — store in DB
  - Notification types enum: `APPOINTMENT_REQUEST`, `APPOINTMENT_ACCEPTED`, `APPOINTMENT_REJECTED`, `APPOINTMENT_CANCELLED`, `TIMETABLE_CHANGE`, `ANNOUNCEMENT`
- [ ] Notification API endpoints:
  - `GET /api/notifications` — list (paginated, newest first)
  - `GET /api/notifications/unread-count` — badge count
  - `PATCH /api/notifications/:id/read` — mark single as read
  - `POST /api/notifications/mark-all-read` — mark all as read
- [ ] Real-time delivery via Server-Sent Events (SSE):
  - `GET /api/notifications/stream` — SSE endpoint
  - Push new notifications to connected clients
  - Auto-reconnect on client side
- [ ] Trigger notifications automatically on:
  - Appointment created → notify lecturer
  - Appointment accepted/rejected → notify student
  - Appointment cancelled → notify other party
  - Timetable updated by admin → notify affected students

---

### Sub-Phase 5.3 — Appointment & Notification Frontend
**Type**: Engineering | **Effort**: ~1 day

- [ ] Appointment booking flow (student view):
  - Step 1: Select lecturer (from directory)
  - Step 2: View availability grid, pick time slot
  - Step 3: Enter reason/notes, confirm booking
  - Success confirmation with details
- [ ] Appointment management (student view):
  - List of my appointments (filterable by status)
  - Cancel pending/accepted appointments
- [ ] Appointment management (lecturer view):
  - Incoming requests list
  - Accept/reject with one click (reject with reason)
  - Reschedule option (propose new time)
  - Upcoming accepted appointments list
- [ ] Notification center:
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

- [ ] Install react-leaflet and leaflet
- [ ] Create map container component:
  - Base tile layer (OpenStreetMap or custom campus tiles)
  - Centered on university campus coordinates
  - Zoom constraints (min/max appropriate for campus)
- [ ] Building markers layer:
  - Fetch buildings from `/api/buildings`
  - Custom marker icons per building type
  - Popup on click: building name, departments, floor count
- [ ] Indoor floor plan overlay:
  - Image overlay per building per floor
  - Bounds mapping (image corners to lat/lng)
  - Floor switcher control (floor 1, 2, 3...)
- [ ] Room markers layer:
  - Fetch markers from `/api/markers?buildingId=&floor=`
  - Different icons: halls (blue), offices (green), labs (orange), amenities (gray)
  - Popup: room name, type, linked entity info

---

### Sub-Phase 6.2 — Map Search, Navigation & Live Status
**Type**: Engineering | **Effort**: ~1 day

- [ ] Map search bar:
  - Search by: building name, hall name, lecturer name, room number
  - API: `GET /api/map/search?q=` — returns matching entities with coordinates
  - Autocomplete dropdown as user types
  - Select result → fly/zoom to location, open popup
- [ ] Live status integration:
  - Hall markers show real-time status:
    - 🟢 Green = free now
    - 🔴 Red = occupied now
    - Next available slot in popup
  - Office markers show:
    - Lecturer name and department
    - Current availability status
    - "Book Appointment" button in popup → links to booking flow
- [ ] Legend and filter controls:
  - Toggle marker categories on/off (halls, offices, labs, amenities)
  - Legend explaining color codes
- [ ] Map API endpoints:
  - `GET /api/map/buildings` — all buildings with coordinates
  - `GET /api/map/markers` — markers filtered by building, floor, type
  - `GET /api/map/search` — search entities by name
  - `GET /api/map/buildings/:id/floorplan` — floor plan image

---

### Sub-Phase 6.3 — Admin Map Tools & Mobile Responsiveness
**Type**: Engineering | **Effort**: ~0.5 day

- [ ] Admin map editing mode:
  - Toggle edit mode (admin only)
  - Click on map to place new marker → form to set type, link entity
  - Drag existing markers to adjust position
  - Delete markers
- [ ] Mobile responsiveness:
  - Touch-friendly controls (pinch zoom, drag)
  - Bottom sheet for popups instead of small popups
  - Collapsible search bar
  - Responsive floor switcher
- [ ] Performance: marker clustering for zoomed-out views

### Phase 6 Checkpoint
> After completing 6.1 + 6.2 + 6.3:
> - ✅ **ENGINEERING TESTBED COMPLETE**
> - ✅ All platform features built and functional
> - ✅ All API endpoints ready for AI module integration
> - ✅ Map navigation ready for usability study
> - ✅ **Ready to begin AI research experimentation (Phases 7–10)**


---
---

## ═══════════════════════════════════════════════════════════
## RESEARCH EXPERIMENTATION BEGINS (Phases 7–10)
## ═══════════════════════════════════════════════════════════

---
---

## PHASE 7 — ASR Benchmarking & Voice Interface
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

### Sub-Phase 7.1 — ASR Service Implementation (Whisper + Google)
**Type**: Engineering | **Effort**: ~2 days

- [ ] Create ASR service module (`/ai-services/asr/`):
  ```
  /ai-services/asr/
    /engines/
      whisper_engine.py       ← OpenAI Whisper wrapper
      google_engine.py        ← Google Speech API wrapper
    /preprocessing/
      audio_processor.py      ← Noise reduction, format normalization
    asr_service.py            ← Unified interface
    requirements.txt
  ```
- [ ] Implement Whisper engine:
  - Load models: tiny, base, small, medium
  - `transcribe(audio_path, language, model_size)` → `{ text, confidence, latency_ms }`
  - GPU/CPU detection and configuration
- [ ] Implement Google Speech engine:
  - Configure Google Cloud credentials
  - `transcribe(audio_path, language)` → `{ text, confidence, latency_ms }`
  - Handle streaming vs. batch recognition
- [ ] Build unified ASR interface:
  - `transcribe(audio_buffer, language, engine_name)` → standardized output
  - Automatic latency measurement (start-to-finish timer)
- [ ] Audio preprocessing pipeline:
  - Format normalization (convert to 16kHz WAV mono)
  - Optional noise reduction (noisereduce library)
  - Silence trimming
- [ ] REST API wrapper for ASR service:
  - `POST /api/ai/asr/transcribe` — accepts audio file + language + engine
  - Returns: `{ text, confidence, latency_ms, engine }`
- [ ] Frontend voice input component:
  - Microphone record button (MediaRecorder API)
  - Recording indicator with waveform
  - Send audio to ASR endpoint
  - Display transcription result
  - Language selector (English, Tamil, Sinhala)

---

### Sub-Phase 7.2 — ASR Dataset Curation & Ground Truth
**Type**: Research | **Effort**: ~1.5 days

- [ ] Define dataset requirements:
  - **50 utterances per language** (English, Tamil, Sinhala) = 150 total
  - Academic domain queries covering platform features:
    - Timetable: "When is my next Data Structures lecture?"
    - Halls: "Is Hall B available at 2pm?"
    - Appointments: "I want to book an appointment with Dr. Kumar"
    - Directions: "Where is the Computer Science building?"
    - General: "What are today's lectures for Group B?"
  - Recording conditions:
    - Clean studio (baseline)
    - Moderate noise (classroom ambient)
    - Light accent variation
- [ ] Record or collect audio samples:
  - Recruit 3–5 speakers per language (diverse accents)
  - Record in controlled environment + noisy environment
  - Format: 16kHz WAV mono
- [ ] Create ground truth transcriptions:
  - Manual transcription by native speakers
  - Double-verified by second transcriber
  - Store in `/research/datasets/asr/ground_truth/`
- [ ] Document dataset metadata:
  - `dataset_manifest.json`: speaker_id, language, text, audio_path, noise_level, duration
  - Recording equipment and conditions
  - Transcription methodology

---

### Sub-Phase 7.3 — ASR Benchmark Experiments (WER + Latency)
**Type**: Research | **Effort**: ~1 day

- [ ] Build experiment runner (`/research/asr-benchmark/scripts/run_benchmark.py`):
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
  | **Total** | | | **45 configs × 50 utterances × 3 runs** |
- [ ] Execute full benchmark
- [ ] Store raw results in `/research/asr-benchmark/results/`

---

### Sub-Phase 7.4 — ASR Statistical Analysis & Report
**Type**: Research | **Effort**: ~1 day

- [ ] Compute descriptive statistics:
  - Mean, median, std deviation for WER per (engine × language)
  - Mean, median, std deviation for latency per (engine × language)
- [ ] Run inferential statistics:
  - Paired t-test or Wilcoxon signed-rank: Whisper(medium) vs. Google per language
  - Report p-values, test statistics
  - 95% confidence intervals for WER differences
  - Effect size: Cohen's d
- [ ] Generate visualizations:
  - Bar chart: WER by engine × language (with error bars)
  - Box plot: WER distribution per engine
  - Bar chart: Latency comparison
  - Scatter: WER vs. latency trade-off
- [ ] Write ASR Benchmark Report:
  - Introduction and methodology
  - Dataset description
  - Results tables (WER, CER, latency)
  - Statistical test results
  - Visualizations
  - Discussion: which engine is best for which language and why
  - **Conclusion: Accept or reject H1**
- [ ] Save report to `/research/reports/asr_benchmark_report.md`

### Phase 7 Checkpoint
> After completing 7.1 + 7.2 + 7.3 + 7.4:
> - ✅ Voice input working in the platform
> - ✅ ASR benchmark dataset documented and versioned (150 utterances)
> - ✅ All experiments executed (45 configs × 3 runs)
> - ✅ Statistical tests completed with significance reporting
> - ✅ **ASR Benchmark Report generated → answers RQ-1, tests H1**


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

- [ ] Initialize Rasa project (`/ai-services/chatbot/`):
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
- [ ] Define intent taxonomy:
  | Intent | Example | Entities Expected |
  |--------|---------|-------------------|
  | `ask_timetable` | "When is my next lecture?" | course_name, day |
  | `ask_hall_availability` | "Is Hall B free at 2pm?" | hall_name, time |
  | `ask_lecturer_availability` | "Is Dr. Kumar free tomorrow?" | lecturer_name, day |
  | `book_appointment` | "I want to meet Dr. Silva on Monday" | lecturer_name, day, time |
  | `cancel_appointment` | "Cancel my appointment with Dr. Kumar" | lecturer_name |
  | `ask_directions` | "Where is the CS building?" | building |
  | `ask_office_location` | "Where is Dr. Kumar's office?" | lecturer_name |
  | `greeting` | "Hi", "Hello" | — |
  | `goodbye` | "Bye", "Thanks" | — |
  | `fallback` | (low confidence) | — |
  | `out_of_scope` | "What's the weather?" | — |
- [ ] Define entity types: `course_name`, `lecturer_name`, `hall_name`, `day`, `time`, `building`
- [ ] Configure NLU pipeline in `config.yml`:
  - WhitespaceTokenizer → CountVectorsFeaturizer → DIETClassifier
  - EntityExtractor settings
- [ ] Build frontend chat widget:
  - Floating chat bubble (bottom-right corner)
  - Chat window with message history
  - Text input + send button
  - Bot typing indicator
  - Minimize/maximize toggle
  - Connect to Rasa REST API

---

### Sub-Phase 8.2 — Chatbot Training Data & Custom Actions
**Type**: Research | **Effort**: ~2 days

- [ ] Write NLU training examples (`data/nlu.yml`):
  - **30+ examples per intent** (varied phrasing)
  - Entity annotations in examples
  - Include synonyms and common misspellings
  - Examples reflecting Sri Lankan English patterns
- [ ] Write conversation stories (`data/stories.yml`):
  - Happy paths for each intent
  - Multi-turn conversations (e.g., ask timetable → follow up with booking)
  - Fallback handling stories
- [ ] Write rules (`data/rules.yml`):
  - Greeting → respond with greeting
  - Goodbye → respond with goodbye
  - Low confidence → trigger fallback
  - Out of scope → polite redirect
- [ ] Implement custom actions (`actions/actions.py`):
  - `ActionQueryTimetable` → call `GET /api/timetable/my` → format response
  - `ActionCheckHallAvailability` → call `GET /api/halls/available` → format response
  - `ActionCheckLecturerAvailability` → call `GET /api/lecturers/:id/availability` → format
  - `ActionBookAppointment` → call `POST /api/appointments` → confirm booking
  - `ActionGetDirections` → call `GET /api/map/search` → return location info
- [ ] Train initial Rasa model
- [ ] Test end-to-end: chat widget → Rasa → custom action → platform API → response
- [ ] Create train/test split:
  - 80% training, 20% held-out test
  - Stratified by intent
  - Store in `/research/datasets/nlp/`

---

### Sub-Phase 8.3 — NLP Evaluation (Cross-validation + Confusion Matrix)
**Type**: Research | **Effort**: ~1 day

- [ ] Run Rasa NLU 5-fold cross-validation:
  - `rasa test nlu --cross-validation --folds 5`
  - Collect per-fold metrics
- [ ] Run held-out test set evaluation:
  - `rasa test nlu --nlu test_data.yml`
  - Generate `intent_report.json` and `entity_report.json`
- [ ] Extract metrics:
  - Per-intent: precision, recall, F1 score, support
  - Per-entity: precision, recall, F1 score
  - Overall weighted F1
- [ ] Generate confusion matrix:
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

- [ ] Error analysis:
  - List all misclassified examples from test set
  - Categorize errors:
    - Ambiguous phrasing (could be multiple intents)
    - Insufficient training examples
    - Entity extraction failure
    - Genuine model limitation
  - Identify most problematic intents
- [ ] Generate visualizations:
  - Confusion matrix heatmap
  - Per-intent F1 bar chart
  - Per-entity F1 bar chart
  - Confidence distribution histogram
  - Threshold vs. accuracy curve
- [ ] Write NLP Evaluation Report:
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
- [ ] Save report to `/research/reports/nlp_evaluation_report.md`

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

- [ ] Create translation service module:
  ```
  /ai-services/translation/
    /engines/
      cloud_translator.py      ← Google Translate / Azure wrapper
      transformer_engine.py    ← MarianMT / mBART wrapper
    translation_service.py     ← Unified interface
    requirements.txt
  ```
- [ ] Implement cloud translation engine:
  - Configure Google Translate API (or Azure Translator)
  - `translate(text, src_lang, tgt_lang)` → `{ translated_text, latency_ms }`
- [ ] Implement transformer translation engine:
  - Load Helsinki-NLP/MarianMT or facebook/mbart model
  - `translate(text, src_lang, tgt_lang)` → `{ translated_text, latency_ms }`
  - GPU/CPU detection
- [ ] Unified translation interface:
  - `translate(text, src, tgt, engine)` → standardized output
  - Automatic latency measurement
- [ ] Language pairs: En↔Ta, En↔Si, Ta↔Si
- [ ] REST API wrapper:
  - `POST /api/ai/translate` — text + source + target + engine
- [ ] Platform integration:
  - UI language switcher component (English / Tamil / Sinhala)
  - Apply translation to chatbot responses
  - Apply to timetable display content
  - Apply to notification text

---

### Sub-Phase 9.2 — Parallel Corpus Curation
**Type**: Research | **Effort**: ~1.5 days

- [ ] Build parallel test corpus:
  - **100 sentence pairs per language pair** (En-Ta, En-Si, Ta-Si) = 300 pairs
  - Academic domain content categories:
    - Timetable queries and responses
    - Appointment-related sentences
    - Navigation/direction instructions
    - Notification messages
    - General academic phrases
  - Sentence complexity levels: simple, moderate, complex
- [ ] Obtain human reference translations:
  - Native speaker translations for each sentence
  - Double-checked by second translator
- [ ] Document corpus metadata:
  - `corpus_manifest.json`: id, source_text, target_text, language_pair, category, complexity
  - Methodology for corpus creation
- [ ] Store in `/research/datasets/translation/`

---

### Sub-Phase 9.3 — Automated Translation Benchmarks (BLEU + Similarity)
**Type**: Research | **Effort**: ~1 day

- [ ] Build benchmark runner (`/research/translation-eval/scripts/run_benchmark.py`):
  - For each sentence pair × each engine:
    - Run translation
    - Compute BLEU score against human reference
    - Compute semantic similarity (cosine, using multilingual sentence-BERT)
    - Record latency
  - 3 repetitions per configuration
- [ ] Experiment matrix:
  | Engine | Language Pairs | Sentences | Runs |
  |--------|---------------|-----------|------|
  | Cloud API | En→Ta, Ta→En, En→Si, Si→En, Ta→Si, Si→Ta | 100 each | 3 |
  | Transformer | En→Ta, Ta→En, En→Si, Si→En, Ta→Si, Si→Ta | 100 each | 3 |
  | **Total** | | **600 translations × 2 engines × 3 runs** | |
- [ ] Execute full benchmark
- [ ] Store raw results in `/research/translation-eval/results/`

---

### Sub-Phase 9.4 — Human Evaluation & Inter-rater Analysis
**Type**: Research | **Effort**: ~1.5 days

- [ ] Recruit **5–10 bilingual evaluators** (university staff/students)
- [ ] Prepare evaluation instrument:
  - Randomized sentence presentation (blind: evaluator doesn't know which engine)
  - Rating rubric:
    - Fluency (1–5): Does it read naturally in the target language?
    - Adequacy (1–5): Is the original meaning fully preserved?
    - Overall Quality (1–5): General quality assessment
  - Evaluation form (web-based or spreadsheet)
- [ ] Select evaluation subset:
  - 30 sentences per language pair × 2 engines = 60 evaluations per pair
  - Balanced across complexity levels
- [ ] Run human evaluation sessions
- [ ] Compute inter-rater reliability:
  - Cohen's kappa (pairwise) or Krippendorff's alpha (multi-rater)
  - Flag and investigate low-agreement items
- [ ] Store human scores in `/research/datasets/translation/human-eval/`

---

### Sub-Phase 9.5 — Translation Comparative Report
**Type**: Research | **Effort**: ~1 day

- [ ] Compile all results:
  - Automated metrics: BLEU, semantic similarity, latency per engine per pair
  - Human scores: fluency, adequacy, overall per engine per pair
- [ ] Statistical analysis:
  - Paired t-test or Wilcoxon: Cloud vs. Transformer per language pair
  - Correlation: BLEU vs. human scores (Pearson/Spearman)
  - Correlation: semantic similarity vs. human scores
  - Effect size for quality differences
- [ ] Generate visualizations:
  - BLEU comparison bar chart (engine × language pair)
  - Semantic similarity comparison
  - Latency comparison bar chart
  - Human evaluation score comparison (box plots)
  - Scatter plot: automated metric vs. human score correlation
  - Speed vs. quality trade-off plot
- [ ] Write Translation Evaluation Report:
  - Introduction and methodology
  - Corpus description
  - Automated evaluation results
  - Human evaluation results with inter-rater reliability
  - Correlation analysis (automated vs. human)
  - Speed vs. quality discussion
  - Per-language-pair recommendation
  - **Conclusion: Accept or reject H3**
- [ ] Save report to `/research/reports/translation_evaluation_report.md`

### Phase 9 Checkpoint
> After completing 9.1 + 9.2 + 9.3 + 9.4 + 9.5:
> - ✅ Multilingual platform with language switching
> - ✅ Parallel corpus curated (300 sentence pairs)
> - ✅ Automated benchmarks executed (BLEU, similarity, latency)
> - ✅ Human evaluation completed with inter-rater reliability
> - ✅ **Translation Evaluation Report generated → answers RQ-3, tests H3**


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
  | T4 | Navigate to CS building on map | Browse map manually | Voice/chat query |
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
  - Rate limiting: all public endpoints
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

# ════════════════════════════════════════════════════════════════
# RESEARCH OUTPUT SUMMARY
# ════════════════════════════════════════════════════════════════

## Final Research Deliverables Checklist

| # | Deliverable | Sub-Phase | RO | Status |
|---|-------------|-----------|-----|--------|
| D1 | Research environment + experiment framework | 1.3 | RO-5 | ⬜ |
| D2 | Platform artifact (complete web application) | 1.1–6.3 | RO-5 | ⬜ |
| D3 | ASR benchmark dataset (150+ utterances, 3 languages) | 7.2 | RO-1 | ⬜ |
| D4 | **ASR Benchmark Report** (WER, latency, statistics) | 7.4 | RO-1 | ⬜ |
| D5 | Rasa chatbot trained model + training data | 8.2 | RO-2 | ⬜ |
| D6 | **NLP Evaluation Report** (F1, confusion matrix, entity eval) | 8.4 | RO-2 | ⬜ |
| D7 | Parallel translation corpus (300+ pairs) | 9.2 | RO-3 | ⬜ |
| D8 | **Translation Evaluation Report** (BLEU, human eval, stats) | 9.5 | RO-3 | ⬜ |
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
#   6.1 → 6.2 → 6.3
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
#   ─────────────────────────────────────────────────
#   TOTAL: 42 Sub-Phases ≈ 45–50 working days
#
# ════════════════════════════════════════════════════════════════
# END OF REFERENCE DOCUMENT
# ════════════════════════════════════════════════════════════════

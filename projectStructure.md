# ════════════════════════════════════════════════════════════════
# LECSTU — Project Structure Reference
# ════════════════════════════════════════════════════════════════
# Last Updated : 2026-02-18 (After Sub-Phase 4.1)
# Update Rule  : This file MUST be updated whenever files/folders
#                are added, moved, or removed from the project.
# ════════════════════════════════════════════════════════════════


---

## Full Directory Tree

```
lecstu/
│
├── 📄 package.json                  ← Root scripts (dev, build, lint — runs both client & server)
├── 📄 .prettierrc                   ← Shared code formatting rules
├── 📄 .gitignore                    ← Git ignore rules (node_modules, .env, uploads, large files)
├── 📄 phases.md                     ← Research & development phases reference (DO NOT MODIFY)
├── 📄 projectStructure.md           ← THIS FILE — project structure reference
│
│
├── 📁 client/                       ← FRONTEND — Vite + React + TypeScript
│   ├── 📄 package.json              ← Client dependencies & scripts
│   ├── 📄 tsconfig.json             ← TypeScript config (jsx: react-jsx, path aliases)
│   ├── 📄 vite.config.ts            ← Vite config (React plugin, proxy to :5000, path aliases)
│   ├── 📄 index.html                ← HTML entry (mounts #root)
│   ├── 📄 .env                      ← Client env vars (VITE_API_BASE_URL)
│   ├── 📄 .env.example              ← Env template for other developers
│   │
│   ├── 📁 public/
│   │   └── 📄 vite.svg              ← Favicon
│   │
│   └── 📁 src/
│       ├── 📄 main.tsx              ← React entry point (renders <App /> into #root)
│       ├── 📄 App.tsx               ← Root component (BrowserRouter + Routes)
│       ├── 📄 index.css             ← Global CSS reset & base styles
│       ├── 📄 vite-env.d.ts         ← Vite client type declarations
│       │
│       ├── 📁 types/
│       │   └── 📄 auth.ts           ← User, LoginRequest, RegisterRequest, AuthResponse types
│       │
│       ├── 📁 components/           ← Reusable UI components
│       │   ├── 📄 Layout.tsx        ← App shell: sidebar (role-aware nav) + top navbar + <Outlet/>
│       │   ├── 📄 ProtectedRoute.tsx ← Auth guard: redirect to /login if not authenticated, 403 for wrong role
│       │   ├── 📄 DataTable.tsx     ← Generic data table: pagination, sorting, search, column rendering
│       │   ├── 📄 Modal.tsx         ← Reusable modal dialog (overlay, ESC close, configurable width)
│       │   ├── 📄 ConfirmDialog.tsx ← Confirmation dialog for destructive actions (danger/warning variants)
│       │   └── 📄 Toast.tsx         ← Toast notification system (success/error/info, auto-dismiss 4s)
│       │
│       ├── 📁 pages/                ← Page-level components (one per route)
│       │   ├── 📄 Login.tsx         ← Email/password form, validation, error display, show/hide password
│       │   ├── 📄 Register.tsx      ← Name, email, role selector, password with strength rules
│       │   ├── 📄 Dashboard.tsx     ← Role-aware dashboard with stat cards + profile info
│       │   ├── 📄 Profile.tsx       ← View/edit profile, avatar upload with preview, department dropdown
│       │   ├── 📄 MyTimetable.tsx   ← Weekly timetable grid (color-coded, current time line, slot details, CSV export)
│       │   │
│       │   └── 📁 admin/            ← Admin-only pages
│       │       ├── 📄 AdminDashboard.tsx     ← Admin stats, quick-action buttons, academic summary
│       │       ├── 📄 TimetableManagement.tsx ← Master timetable CRUD: table/calendar/import views, filters
│       │       ├── 📄 TimetableForm.tsx       ← Create/edit form modal with conflict display
│       │       ├── 📄 TimetableCalendar.tsx   ← Weekly calendar grid view (Mon–Fri, color-coded courses)
│       │       ├── 📄 TimetableBulkImport.tsx ← CSV file upload, preview, validation, import
│       │       ├── 📄 GroupManagement.tsx     ← Student group CRUD, member list, assign/remove students
│       │       ├── 📄 HallManagement.tsx      ← Lecture hall CRUD with equipment tags, active status
│       │       ├── 📄 OfficeManagement.tsx    ← Lecturer office CRUD with lecturer linking
│       │       ├── 📄 BuildingManagement.tsx  ← Building CRUD with coordinates, floor plan upload/delete
│       │       ├── 📄 MarkerManagement.tsx    ← Map marker CRUD with entity linking, type filters
│       │       └── 📄 MapPreview.tsx          ← Leaflet map preview showing all markers with popups
│       │
│       ├── 📁 hooks/                ← Custom React hooks
│       │   └── .gitkeep
│       │
│       ├── 📁 store/                ← Zustand state management stores
│       │   └── 📄 authStore.ts      ← Auth state: user, isAuthenticated, login, register, logout, getMe
│       │
│       ├── 📁 services/             ← API service layer
│       │   └── 📄 api.ts            ← Axios instance (baseURL: /api, credentials, smart 401 refresh interceptor)
│       │
│       └── 📁 utils/                ← Utility/helper functions
│           └── .gitkeep
│
│
├── 📁 server/                       ← BACKEND — Node.js + Express + TypeScript (MVC)
│   ├── 📄 package.json              ← Server dependencies & scripts (dev, db:migrate, db:seed, db:studio)
│   ├── 📄 tsconfig.json             ← TypeScript config (commonjs, path aliases)
│   ├── 📄 prisma.config.ts          ← Prisma config (datasource URL from env)
│   ├── 📄 .env                      ← Server env vars (PORT, DB, JWT secrets)
│   ├── 📄 .env.example              ← Env template for other developers
│   │
│   ├── 📁 prisma/                   ← DATABASE — Prisma ORM
│   │   ├── 📄 schema.prisma         ← Database schema (14 models, enums, indexes)
│   │   ├── 📄 seed.ts               ← Seed script (3 faculties, 6 depts, 122 users, 15 courses, etc.)
│   │   └── 📁 migrations/           ← Auto-generated SQL migrations
│   │       └── 📁 20260218_init/    ← Initial migration
│   │
│   ├── 📁 uploads/                  ← File upload storage (profile images, CSVs)
│   │   └── .gitkeep
│   │
│   └── 📁 src/
│       ├── 📄 server.ts             ← Entry point — starts Express on configured port
│       ├── 📄 app.ts                ← Express app setup (CORS, JSON, cookies, static files, routes, error handler)
│       │
│       ├── 📁 config/
│       │   ├── 📄 index.ts          ← Centralized config (reads .env: port, db, jwt, upload settings)
│       │   └── 📄 database.ts       ← Prisma client instance (PG adapter, singleton)
│       │
│       ├── 📁 generated/prisma/     ← Auto-generated Prisma client (DO NOT EDIT)
│       │   ├── 📄 client.ts         ← PrismaClient class + model types + enums
│       │   ├── 📄 enums.ts          ← UserRole, DayOfWeek, AppointmentStatus, etc.
│       │   └── 📄 ...               ← Other generated files
│       │
│       ├── 📁 controllers/          ← Request handlers (one file per resource)
│       │   ├── 📄 authController.ts ← register, login, refresh, logout, getMe
│       │   ├── 📄 profileController.ts  ← getProfile, updateProfile, uploadAvatar, getDepartments
│       │   ├── 📄 adminController.ts   ← getDashboardStats (aggregated counts for admin panel)
│       │   ├── 📄 timetableController.ts ← list, get, create, update, delete, dropdowns, bulkImport
│       │   ├── 📄 groupController.ts    ← CRUD + assignStudents, removeStudent, bulkAssign, availableStudents
│       │   ├── 📄 hallController.ts      ← CRUD + getBuildings (distinct building names)
│       │   ├── 📄 officeController.ts   ← CRUD + getAvailableLecturers
│       │   ├── 📄 buildingController.ts ← CRUD + uploadFloorPlan + deleteFloorPlan
│       │   ├── 📄 markerController.ts   ← CRUD + getMarkerDropdowns (buildings, halls, offices)
│       │   └── 📄 userTimetableController.ts ← /timetable/my, /student/:id, /lecturer/:id, cache invalidate
│       │
│       ├── 📁 models/               ← Data models (Prisma schema is source of truth)
│       │   └── .gitkeep
│       │
│       ├── 📁 routes/
│       │   ├── 📄 index.ts          ← API router (health + auth + profile + admin + timetable)
│       │   ├── 📄 auth.ts           ← Auth routes: register, login, refresh, logout, me
│       │   ├── 📄 profile.ts        ← Profile routes: GET, PATCH, POST avatar, GET departments
│       │   ├── 📄 admin.ts          ← Admin routes: GET stats (ADMIN role guard)
│       │   ├── 📄 timetable.ts      ← Timetable routes: CRUD + dropdowns + bulk-import (ADMIN guard)
│       │   ├── 📄 groups.ts         ← Group routes: CRUD + student assign/remove/bulk (ADMIN guard)
│       │   ├── 📄 halls.ts          ← Hall routes: CRUD + buildings list (ADMIN guard)
│       │   ├── 📄 offices.ts        ← Office routes: CRUD + available lecturers (ADMIN guard)
│       │   ├── 📄 buildings.ts      ← Building routes: CRUD + floor plan upload/delete (ADMIN guard)
│       │   ├── 📄 markers.ts        ← Marker routes: CRUD + dropdowns (ADMIN guard)
│       │   └── 📄 userTimetable.ts  ← User timetable routes: /my, /student/:id, /lecturer/:id, cache
│       │
│       ├── 📁 middleware/
│       │   ├── 📄 errorHandler.ts   ← AppError class + global error handler middleware
│       │   ├── 📄 auth.ts           ← authenticate (JWT verification) + authorize (RBAC roles)
│       │   ├── 📄 validate.ts       ← express-validator rules: registerRules, loginRules, profileUpdateRules
│       │   ├── 📄 upload.ts         ← Multer config: disk storage, file filter (JPEG/PNG/WebP), 5MB limit
│       │   └── 📄 rateLimiter.ts    ← Rate limiting: authLimiter (20/15min), generalLimiter (200/15min)
│       │
│       ├── 📁 services/             ← Business logic layer (one file per domain)
│       │   ├── 📄 conflictDetector.ts ← Timetable conflict detection (hall, lecturer, group overlap)
│       │   ├── 📄 auditLogger.ts     ← Audit log service (logs admin actions to AuditLog table)
│       │   ├── 📄 timetableService.ts ← Timetable generation (student groups → weekly grid, lecturer schedule)
│       │   └── 📄 timetableCache.ts  ← In-memory cache (5-min TTL, invalidate on master timetable changes)
│       │
│       └── 📁 utils/                ← Utility/helper functions
│           ├── 📄 jwt.ts            ← JWT token generation, verification, cookie helpers
│           └── 📄 password.ts       ← bcrypt password hashing (salt rounds: 12) + compare
│
│
├── 📁 shared/                       ← SHARED — Types & constants used by both client and server
│   └── 📁 types/
│       └── 📄 index.ts              ← Shared enums: UserRole, AppointmentStatus, NotificationType,
│                                       DayOfWeek, MapMarkerType + ApiResponse, PaginatedResponse interfaces
│
│
├── 📁 ai-services/                  ← AI MODULES — Implemented in Phases 7–9
│   ├── 📁 asr/                      ← Phase 7: ASR (Whisper + Google Speech)
│   ├── 📁 chatbot/                  ← Phase 8: NLP Chatbot (Rasa)
│   └── 📁 translation/              ← Phase 9: Translation (MarianMT + Cloud API)
│
│
└── 📁 research/                     ← RESEARCH — Experiments, datasets, reports
    ├── 📄 research-config.yaml      ← Master experiment config (seeds, models, dataset paths, thresholds)
    │
    ├── 📁 lib/                      ← Research utility modules
    │   ├── 📄 logger.js             ← Experiment logger (structured JSON, auto-IDs, hardware info, summaries)
    │   ├── 📄 latency_profiler.js   ← Latency measurement (single/batch, p95/p99, stats)
    │   ├── 📄 wer_calculator.py     ← Word Error Rate + Character Error Rate (edit distance, batch stats)
    │   ├── 📄 classification_metrics.py ← Precision/Recall/F1, confusion matrix, per-class reports
    │   └── 📄 bleu_calculator.py    ← BLEU score (n-gram precision, brevity penalty, corpus-level)
    │
    ├── 📁 templates/                ← Report templates
    │   ├── 📄 experiment_report_template.md   ← Standard experiment report (methodology, results, stats)
    │   └── 📄 usability_report_template.md    ← Usability study report (SUS, tasks, qualitative themes)
    │
    ├── 📁 asr-benchmark/            ← RO-1: ASR evaluation
    │   ├── 📁 scripts/              ← Experiment runner scripts
    │   └── 📁 results/              ← Raw benchmark output
    │
    ├── 📁 nlp-evaluation/           ← RO-2: Chatbot evaluation
    │   ├── 📁 scripts/
    │   └── 📁 results/
    │
    ├── 📁 translation-eval/         ← RO-3: Translation evaluation
    │   ├── 📁 scripts/
    │   └── 📁 results/
    │
    ├── 📁 usability-study/          ← RO-4: Usability study
    │   ├── 📁 instruments/          ← Questionnaires, consent forms, rubrics
    │   │   └── 📄 ethics_plan.md    ← Data collection ethics plan (consent, PII, risks, approval)
    │   └── 📁 raw-data/             ← Collected participant data
    │
    ├── 📁 datasets/                 ← Shared test datasets
    │   ├── 📁 asr/                  ← Audio files + ground truth transcriptions
    │   ├── 📁 nlp/                  ← Intent/entity training & test data
    │   └── 📁 translation/          ← Parallel corpus + human evaluation scores
    │
    ├── 📁 logs/                     ← Structured experiment logs (JSON, auto-generated by logger.js)
    └── 📁 reports/                  ← Generated evaluation reports (Markdown)
```


---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` (root) | Monorepo scripts: `npm run dev` starts client + server via concurrently |
| `client/package.json` | Frontend deps: react, react-dom, react-router-dom, axios, zustand |
| `server/package.json` | Backend deps: express, cors, cookie-parser, dotenv, prisma, pg, bcrypt; dev: tsx watch |
| `server/prisma/schema.prisma` | Database schema: 14 models, 6 enums, composite indexes for performance |
| `server/prisma/seed.ts` | Seed script: 122 users, 15 courses, 30 timetable entries, map data |
| `server/prisma.config.ts` | Prisma config: datasource URL, migration path |
| `server/src/config/database.ts` | Prisma client singleton with PG adapter |
| `client/vite.config.ts` | React plugin, `/api` proxy to `:5000`, path aliases (`@components`, etc.) |
| `client/tsconfig.json` | JSX: react-jsx, path aliases, strict mode |
| `server/tsconfig.json` | CommonJS output, path aliases (`@controllers`, etc.), strict mode |
| `.prettierrc` | Shared formatting: single quotes, trailing commas, 90 char width |
| `.gitignore` | Ignores: node_modules, .env, uploads, large audio/model files |
| `research/research-config.yaml` | Master experiment config: random seeds, model versions, dataset paths, evaluation thresholds |
| `research/lib/logger.js` | Experiment logging: structured JSON, auto experiment IDs, hardware capture, summary stats |
| `research/lib/wer_calculator.py` | WER/CER computation for ASR benchmarks (RO-1) |
| `research/lib/classification_metrics.py` | Precision/Recall/F1 for chatbot intent classification (RO-2) |
| `research/lib/bleu_calculator.py` | BLEU score for translation evaluation (RO-3) |
| `research/lib/latency_profiler.js` | Response latency measurement with percentile stats |
| `research/usability-study/instruments/ethics_plan.md` | Data collection ethics plan (consent, PII handling, risk assessment) |
| `server/src/utils/jwt.ts` | JWT token utilities: generate/verify access & refresh tokens, set/clear cookies |
| `server/src/middleware/auth.ts` | Authentication (JWT verify) and authorization (RBAC) middleware |
| `server/src/middleware/rateLimiter.ts` | Rate limiting: 20 req/15min for auth, 200 req/15min general |


---

## API Endpoints (Current)

| Method | Path | Description | Auth | Rate Limited |
|--------|------|-------------|------|-------------|
| GET | `/api/health` | Server health check | None | No |
| POST | `/api/auth/register` | Create new user account | None | 20/15min |
| POST | `/api/auth/login` | Login with email/password | None | 20/15min |
| POST | `/api/auth/refresh` | Refresh access token | Cookie | 20/15min |
| POST | `/api/auth/logout` | Clear auth cookies | None | No |
| GET | `/api/auth/me` | Get current user profile | JWT | No |
| GET | `/api/profile` | Get own profile details | JWT | No |
| PATCH | `/api/profile` | Update name, phone, department | JWT | No |
| POST | `/api/profile/avatar` | Upload profile image (multipart) | JWT | No |
| GET | `/api/profile/departments` | List all departments | JWT | No |
| GET | `/api/admin/stats` | Admin dashboard statistics (aggregated counts) | JWT + ADMIN | No |
| GET | `/api/admin/timetable` | List timetable entries (paginated, filtered) | JWT | No |
| GET | `/api/admin/timetable/dropdowns` | Get courses, lecturers, halls, groups for forms | JWT + ADMIN | No |
| GET | `/api/admin/timetable/:id` | Get single timetable entry | JWT | No |
| POST | `/api/admin/timetable` | Create timetable entry (conflict check) | JWT + ADMIN | No |
| PATCH | `/api/admin/timetable/:id` | Update timetable entry (conflict check) | JWT + ADMIN | No |
| DELETE | `/api/admin/timetable/:id` | Delete timetable entry | JWT + ADMIN | No |
| POST | `/api/admin/timetable/bulk-import` | Bulk import timetable via CSV (multipart) | JWT + ADMIN | No |
| GET | `/api/admin/groups` | List student groups (filterable) | JWT + ADMIN | No |
| GET | `/api/admin/groups/:id` | Get group with members | JWT + ADMIN | No |
| POST | `/api/admin/groups` | Create student group | JWT + ADMIN | No |
| PATCH | `/api/admin/groups/:id` | Update student group | JWT + ADMIN | No |
| DELETE | `/api/admin/groups/:id` | Delete student group | JWT + ADMIN | No |
| GET | `/api/admin/groups/:id/available-students` | Students not in group | JWT + ADMIN | No |
| POST | `/api/admin/groups/:id/students` | Assign students to group | JWT + ADMIN | No |
| POST | `/api/admin/groups/:id/students/bulk` | Bulk assign via CSV | JWT + ADMIN | No |
| DELETE | `/api/admin/groups/:id/students/:studentId` | Remove student from group | JWT + ADMIN | No |
| GET | `/api/admin/halls` | List lecture halls | JWT + ADMIN | No |
| GET | `/api/admin/halls/buildings` | Get distinct building names | JWT + ADMIN | No |
| GET | `/api/admin/halls/:id` | Get single hall | JWT + ADMIN | No |
| POST | `/api/admin/halls` | Create hall | JWT + ADMIN | No |
| PATCH | `/api/admin/halls/:id` | Update hall | JWT + ADMIN | No |
| DELETE | `/api/admin/halls/:id` | Delete hall (fails if has timetable) | JWT + ADMIN | No |
| GET | `/api/admin/offices` | List lecturer offices | JWT + ADMIN | No |
| GET | `/api/admin/offices/available-lecturers` | Lecturers without office | JWT + ADMIN | No |
| GET | `/api/admin/offices/:id` | Get single office | JWT + ADMIN | No |
| POST | `/api/admin/offices` | Create/assign office | JWT + ADMIN | No |
| PATCH | `/api/admin/offices/:id` | Update office | JWT + ADMIN | No |
| DELETE | `/api/admin/offices/:id` | Delete office | JWT + ADMIN | No |
| GET | `/api/admin/buildings` | List buildings with floor plans | JWT + ADMIN | No |
| GET | `/api/admin/buildings/:id` | Get building with markers | JWT + ADMIN | No |
| POST | `/api/admin/buildings` | Create building (name, code, lat/lng, floors) | JWT + ADMIN | No |
| PATCH | `/api/admin/buildings/:id` | Update building | JWT + ADMIN | No |
| DELETE | `/api/admin/buildings/:id` | Delete building (cascades markers+plans) | JWT + ADMIN | No |
| POST | `/api/admin/buildings/:id/floorplan` | Upload floor plan image (multipart) | JWT + ADMIN | No |
| DELETE | `/api/admin/buildings/:id/floorplan/:planId` | Delete floor plan | JWT + ADMIN | No |
| GET | `/api/admin/markers` | List markers (filter by building/type) | JWT + ADMIN | No |
| GET | `/api/admin/markers/dropdowns` | Buildings, halls, offices for forms | JWT + ADMIN | No |
| GET | `/api/admin/markers/:id` | Get single marker | JWT + ADMIN | No |
| POST | `/api/admin/markers` | Create marker with entity linking | JWT + ADMIN | No |
| PATCH | `/api/admin/markers/:id` | Update marker | JWT + ADMIN | No |
| DELETE | `/api/admin/markers/:id` | Delete marker | JWT + ADMIN | No |
| GET | `/api/timetable/my` | Current user's weekly timetable | JWT | No |
| GET | `/api/timetable/student/:id` | Specific student timetable | JWT + ADMIN | No |
| GET | `/api/timetable/lecturer/:id` | Specific lecturer schedule | JWT | No |
| POST | `/api/timetable/cache/invalidate` | Flush timetable cache | JWT + ADMIN | No |


---

## Database Schema (14 Models)

| Model | Table Name | Key Fields | Relations |
|-------|-----------|------------|-----------|
| User | `users` | email, password, role (ADMIN/LECTURER/STUDENT), firstName, lastName | → Department, ← Appointments, ← Notifications |
| Faculty | `faculties` | name, code | ← Departments |
| Department | `departments` | name, code | → Faculty, ← Users, ← Courses, ← StudentGroups |
| Course | `courses` | name, code, credits, semester | → Department, ← MasterTimetable |
| StudentGroup | `student_groups` | name, batchYear | → Department, ← Members, ← MasterTimetable |
| StudentGroupMember | `student_group_members` | studentId, groupId | → User, → StudentGroup |
| LectureHall | `lecture_halls` | name, building, floor, capacity, equipment[] | ← MasterTimetable, ← MapMarkers |
| LecturerOffice | `lecturer_offices` | roomNumber, building, floor | → User (1:1), ← MapMarkers |
| MasterTimetable | `master_timetable` | dayOfWeek, startTime, endTime, semester | → Course, → User, → Hall, → Group |
| Appointment | `appointments` | dateTime, duration, status, reason | → Student, → Lecturer |
| Notification | `notifications` | type, title, message, isRead | → User |
| MapBuilding | `map_buildings` | name, code, latitude, longitude, floors | ← Markers, ← FloorPlans |
| FloorPlan | `floor_plans` | floor, imagePath, bounds | → MapBuilding |
| MapMarker | `map_markers` | floor, type, label, x, y | → Building, →? Hall, →? Office |
| AuditLog | `audit_logs` | action, entity, entityId, details | → User |

### Seed Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| Users | 122 | 2 admins + 20 lecturers + 100 students |
| Faculties | 3 | Computing, Engineering, Science |
| Departments | 6 | CS, IT, EE, ME, Math, Physics |
| Courses | 15 | Across all 6 departments |
| Student Groups | 5 | CS-2024-A/B, IT-2024-A, EE-2024-A, MATH-2024-A |
| Lecture Halls | 10 | Halls A/B/C, Labs 1/2/3, Seminar Rooms, Auditorium, Workshop |
| Timetable Entries | 30 | Mon–Fri, 6 slots per day |
| Map Buildings | 4 | Main, Computing, Science, Engineering blocks |
| Map Markers | 8 | Hall markers, entrances, amenities |
| Default Password | — | All users: `lecstu123` / Admin: `admin@lecstu.edu` |


---

## Dev Commands

| Command | Where | What It Does |
|---------|-------|--------------|
| `npm run dev` | Root (`lecstu/`) | Starts BOTH client and server concurrently |
| `npm run dev` | `client/` | Starts Vite dev server on `:5173` |
| `npm run dev` | `server/` | Starts Express via tsx watch on `:5000` |
| `npm run build` | `client/` | TypeScript check + Vite production build |
| `npm run build` | `server/` | TypeScript compile to `dist/` |
| `npm run db:migrate` | `server/` | Run Prisma migrations |
| `npm run db:seed` | `server/` | Seed database with sample data |
| `npm run db:reset` | `server/` | Reset database (drop + migrate + seed) |
| `npm run db:studio` | `server/` | Open Prisma Studio (visual DB browser) |


---

## Port Allocation

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Express) | 5000 | http://localhost:5000 |
| PostgreSQL | 5432 | localhost:5432 (database: `lecstu`) |
| Prisma Studio | 5555 | http://localhost:5555 (run `npm run db:studio`) |


---

## Change Log

| Date | Sub-Phase | Changes |
|------|-----------|---------|
| 2026-02-18 | **1.1** | Initial monorepo setup: client (Vite+React+TS), server (Express+TS MVC), shared types, ai-services scaffold, research directory structure, root concurrently scripts, .env configs, Prettier config, .gitignore |
| 2026-02-18 | **1.2** | Prisma ORM + PostgreSQL: 14-model schema (User, Faculty, Department, Course, StudentGroup, LectureHall, LecturerOffice, MasterTimetable, Appointment, Notification, MapBuilding, FloorPlan, MapMarker, AuditLog), composite indexes, PG adapter, seed script (122 users, 15 courses, 30 timetable entries, map data), database.ts client singleton |
| 2026-02-18 | **1.3** | Research environment: experiment logger (logger.js), latency profiler, research-config.yaml (seeds, model versions, thresholds), metric calculators (WER, F1/precision/recall, BLEU), experiment & usability report templates, data collection ethics plan |
| 2026-02-18 | **2.1** | Backend auth system: JWT access/refresh tokens (15min/7d), bcrypt password hashing (salt:12), auth controller (register/login/refresh/logout/getMe), authenticate + authorize(roles) middleware, express-validator rules, rate limiting (20/15min on auth), auth routes wired to /api/auth/* |
| 2026-02-18 | **2.2** | Frontend auth UI: Zustand auth store, Login page, Register page (role selector), ProtectedRoute guard, Layout (sidebar+navbar), Dashboard (role-aware cards+profile), routing, global CSS, lucide-react icons |
| 2026-02-18 | **2.3** | User profile and file upload: Multer (disk storage, JPEG/PNG/WebP, 5MB), profileController (get/update/avatar/departments), Profile page (edit form, avatar upload, department dropdown), sidebar My Profile link |
| 2026-02-18 | **3.1** | Admin dashboard shell: admin stats API (GET /api/admin/stats), AdminDashboard page (stat cards, quick actions, academic summary), admin route guard (ADMIN-only /admin/*), reusable components (DataTable, Modal, ConfirmDialog, Toast), admin sidebar nav links, global Toast container |
| 2026-02-18 | **3.2** | Master timetable management: CRUD API with paginated/filtered listing, conflict detection service (hall/lecturer/group overlap), CSV bulk import with validation, dropdown data endpoint, frontend TimetableManagement (table/calendar/import views), TimetableForm (create/edit with conflict display), TimetableCalendar (weekly grid, color-coded), TimetableBulkImport (upload, preview, error display) |
| 2026-02-18 | **3.3** | Student Group, Hall & Office management: Group CRUD with student assignment (individual + bulk CSV), member list with add/remove UI; Hall CRUD with equipment tags, capacity, active status; Office CRUD with lecturer linking (1:1), available lecturers endpoint; Audit logging service for all admin actions; Admin sidebar updated with Groups/Halls/Offices links |
| 2026-02-18 | **3.4** | Faculty map data management: Building CRUD (name, code, lat/lng, floors), floor plan image upload/delete per building per floor; Marker CRUD with type (HALL/OFFICE/LAB/AMENITY/ENTRANCE) and entity linking (hallId/officeId); Leaflet map preview with color-coded markers, popups, auto-bounds; Admin sidebar with Buildings/Markers links |
| 2026-02-18 | **4.1** | Student timetable generation engine: timetableService (student groups → weekly grid, lecturer schedule), in-memory cache (5-min TTL, invalidated on master timetable CRUD + bulk import), user timetable API (GET /my, /student/:id, /lecturer/:id, POST cache/invalidate), MyTimetable frontend (weekly grid Mon–Fri 08–18, color-coded courses, current time red indicator, click-to-detail modal, print + CSV export) |


---

# ════════════════════════════════════════════════════════════════
# END OF PROJECT STRUCTURE REFERENCE
# ════════════════════════════════════════════════════════════════

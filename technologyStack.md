# LECSTU — Technology Stack

> **LECSTU** (Smart Faculty Access & Student Assistant System) is an AI-integrated academic platform for multilingual university environments. This document lists the technologies used in the project and what each is used for.

---

## Architecture Overview

| Layer | Stack |
|-------|-------|
| **Structure** | Monorepo — `client/`, `server/`, `ai-services/`, `research/`, `shared/` |
| **Pattern** | REST API backend + React SPA + Python AI microservices |
| **Runtime** | Node.js (backend/frontend tooling), Python 3 (AI services) |

---

## Frontend (`client/`)

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework for student, lecturer, and admin interfaces |
| **TypeScript** | Type-safe frontend development |
| **Vite 7** | Dev server, bundler, and production build tool |
| **React Router 7** | Client-side routing (dashboard, timetable, map, admin pages) |
| **Tailwind CSS 4** | Utility-first styling and responsive layout |
| **Zustand** | Lightweight global state (auth, language, notifications) |
| **Axios** | HTTP client for REST API calls |
| **Leaflet + React-Leaflet** | Interactive campus map with markers and clusters |
| **Lucide React** | Icon set used across the UI |
| **Custom hooks & components** | Floor plan maps, voice input, chat widget, timetable grids, indoor navigation panels |

**Used for:** Login/registration, student timetable, hall availability, lecturer directory, appointments, notifications, campus/indoor navigation, voice assistant, admin dashboards, floor plan editors, and connector wizards.

---

## Backend (`server/`)

| Technology | Purpose |
|------------|---------|
| **Node.js + Express 5** | REST API server |
| **TypeScript** | Type-safe backend code |
| **tsx** | TypeScript execution in development |
| **Prisma 7** | ORM, schema management, and database migrations |
| **PostgreSQL** | Primary relational database (users, timetables, buildings, nav graphs, appointments) |
| **@prisma/adapter-pg + pg** | PostgreSQL driver adapter for Prisma |
| **JSON Web Tokens (jsonwebtoken)** | Stateless authentication |
| **bcrypt** | Password hashing |
| **express-validator** | Request validation |
| **express-rate-limit** | API rate limiting |
| **cookie-parser + CORS** | Cookie handling and cross-origin requests |
| **Multer** | File uploads (profile photos, floor plans) |
| **pdf-parse** | PDF text extraction for timetable import (Node fallback) |
| **xlsx** | Excel timetable import/export |
| **csv-parser** | CSV data import |
| **Axios** | Outbound calls to Python AI microservices |

**Used for:** Auth (JWT + RBAC), user profiles, timetable management, hall booking, appointments, notifications (including SSE), indoor navigation graph CRUD, building/vertical connectors, map search, chatbot proxy, ASR/translation proxy, and admin operations.

---

## Real-Time & Notifications

| Technology | Purpose |
|------------|---------|
| **Server-Sent Events (SSE)** | Real-time notification delivery to connected clients (`GET /api/notifications/stream`) |
| **EventSource (browser)** | Frontend listener for live notification updates |

**Used for:** Appointment status changes, timetable updates, and unread notification badges.

---

## Database & Data Model

| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Persistent storage for all platform data |
| **Prisma Schema** | Single source of truth for entities: users, roles, timetables, halls, offices, buildings, floor plans, nav nodes/edges, QR codes, appointments, notifications |

**Used for:** Academic logistics, indoor navigation graphs, faculty building topology, and audit trails.

---

## AI Microservices (`ai-services/`)

Each service runs as a standalone **FastAPI + Uvicorn** Python app and is called by the Express backend.

### Automatic Speech Recognition — `ai-services/asr/` (port 8001)

| Technology | Purpose |
|------------|---------|
| **OpenAI Whisper** | Local open-source speech-to-text (English, Tamil, Sinhala) |
| **Hugging Face Transformers** | Finetuned Whisper model inference |
| **Google Cloud Speech-to-Text** | Cloud ASR baseline for research comparison |
| **Azure Cognitive Services Speech** | Cloud ASR baseline for research comparison |
| **NumPy, SciPy, soundfile, pydub, noisereduce** | Audio loading, preprocessing, and noise reduction |

**Used for:** Voice assistant, hands-free academic queries, ASR benchmark experiments (RO-1).

### Chatbot — `ai-services/chatbot/` (Rasa)

| Technology | Purpose |
|------------|---------|
| **Rasa 3.6+** | Intent classification, entity extraction, dialogue management |
| **Rasa SDK** | Custom actions (calls back to Express API for live data) |
| **YAML training data** | NLU stories, rules, and domain configuration |

**Used for:** Academic chatbot (timetable, navigation, appointments), intent/entity evaluation (RO-2).

### Machine Translation — `ai-services/translation/`

| Technology | Purpose |
|------------|---------|
| **Hugging Face Transformers + PyTorch** | Local neural translation models |
| **MarianMT (Helsinki-NLP opus-mt)** | English ↔ Tamil, English ↔ Sinhala translation |
| **mBART-50 (facebook/mbart-large-50)** | Multilingual many-to-many translation |
| **Google Cloud Translation** | Cloud translation baseline |
| **Azure AI Translation** | Cloud translation baseline |

**Used for:** UI translation, multilingual academic content, translation quality experiments (RO-3).

### Floor Plan Vision — `ai-services/floorplan-vision/` (port 8003)

| Technology | Purpose |
|------------|---------|
| **OpenCV (opencv-python-headless)** | Image processing, corridor/door heuristics |
| **EasyOCR** | Room label text detection on floor plan images |
| **NumPy** | Image array operations |

**Used for:** Auto-detecting room markers and corridor graphs when admins upload floor plan JPGs.

### Indoor Navigation Engine — `ai-services/indoor-navigation-engine/` (port 8004)

| Technology | Purpose |
|------------|---------|
| **OpenCV + EasyOCR** | Floor plan analysis (rooms, corridors, labels) |
| **NetworkX** | Spatial graph construction from vision output |
| **PaddleOCR** *(optional)* | Alternative OCR engine for floor plans |

**Used for:** AI-assisted floor plan analysis that seeds indoor navigation graphs.

### Timetable Extract — `ai-services/timetable-extract/` (port 8002)

| Technology | Purpose |
|------------|---------|
| **pdfplumber** | Position-aware PDF parsing for FET faculty timetables |

**Used for:** Extracting structured timetable data from uploaded PDF files.

---

## Indoor Navigation (Backend Module)

| Technology | Purpose |
|------------|---------|
| **A* pathfinding** | Primary route calculation on nav graphs |
| **Dijkstra** | Alternative/validation pathfinding algorithm |
| **Graph adjacency model** | `NavNode` + `NavEdge` stored in PostgreSQL |
| **QR code positioning** | Student location via scanned QR markers |
| **Turn-by-turn step generator** | Human-readable navigation instructions |

**Used for:** Campus map, guided indoor routes, floor changes (stairs/lifts), building connectors, admin graph editing.

---

## Research & Experimentation (`research/`)

| Technology | Purpose |
|------------|---------|
| **PyTorch + Transformers + PEFT** | Whisper finetuning for English–Tamil–Sinhala ASR |
| **Hugging Face Datasets + Accelerate** | Training data loading and distributed training |
| **jiwer** | Word Error Rate (WER) calculation for ASR benchmarks |
| **TensorBoard** | Training metrics visualization |
| **Matplotlib + NumPy + SciPy** | Benchmark charts and statistical analysis |
| **gTTS** | Synthetic speech generation for test data |
| **PyYAML** | Experiment configuration files |

**Used for:** ASR benchmarks, NLP evaluation, translation experiments, and research reporting (RO-1 to RO-4).

---

## Shared Code (`shared/`)

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Shared types and constants used by client and server |
| **mapMarkerTypes, floorPlanMapRegion** | Consistent map marker definitions and coordinate logic across frontend and backend |

---

## Development & Tooling

| Technology | Purpose |
|------------|---------|
| **npm workspaces (root scripts)** | Run client + server together with `concurrently` and `wait-on` |
| **ESLint + Prettier** | Code linting and formatting |
| **dotenv** | Environment variable management |
| **Prisma Studio** | Visual database browser |
| **tsx / ts-node** | Run TypeScript scripts (seeds, migrations, debug tools) |

---

## Testing

| Technology | Purpose |
|------------|---------|
| **Playwright** | End-to-end browser tests (timetable, floor plan alignment, enrollment sync) |
| **Chrome (system channel)** | Playwright test browser |

**Used for:** Automated regression tests against the running dev servers (`localhost:5173`).

---

## File & Media Handling

| Technology | Purpose |
|------------|---------|
| **Multer + local `uploads/`** | Floor plan JPG storage, profile images |
| **PDF / Excel / CSV parsers** | Timetable bulk import pipelines |

---

## Security

| Technology | Purpose |
|------------|---------|
| **JWT (access tokens)** | Authenticated API access |
| **Role-Based Access Control (RBAC)** | `ADMIN`, `LECTURER`, `STUDENT` permissions |
| **bcrypt** | Secure password storage |
| **express-rate-limit** | Brute-force and abuse protection |
| **Chatbot API key** | Secure Rasa action server → Express communication |

---

## Cloud & External APIs (Optional)

| Service | Purpose |
|---------|---------|
| **Google Cloud Speech-to-Text** | Cloud ASR comparison |
| **Google Cloud Translation** | Cloud translation comparison |
| **Azure Speech Services** | Cloud ASR comparison |
| **Azure Translator** | Cloud translation comparison |

These are optional; the platform runs with local Whisper, Rasa, and MarianMT/mBART models when cloud credentials are not configured.

---

## Summary by Research Objective

| Research Objective | Primary Technologies |
|--------------------|-------------------|
| **RO-1** — Multilingual ASR | Whisper, Hugging Face Transformers, Google/Azure Speech, PyTorch finetuning |
| **RO-2** — Academic chatbot | Rasa, Rasa SDK, YAML NLU data |
| **RO-3** — Machine translation | MarianMT, mBART-50, Google/Azure Translation APIs |
| **RO-4** — Usability study | React UI, voice/chat/translation features, Playwright for task testing |
| **RO-5** — Production platform | React, Express, Prisma, PostgreSQL, FastAPI microservices, Leaflet maps, SSE |

---

*Last updated: June 2026*

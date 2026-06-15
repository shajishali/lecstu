# LECSTU Chatbot (Rasa) — Phase 8.1 / 8.2

Domain-specific NLP chatbot for academic intent classification and entity extraction. Phase 8.2 adds full API integration.

## Python requirement

**Rasa 3.x requires Python 3.10 or 3.11.** Python 3.12 and 3.13 are not supported.

- Install Python 3.11: `winget install Python.Python.3.11`
- Or download: https://www.python.org/downloads/release/python-3119/

## Quick start (PowerShell)

```powershell
cd ai-services/chatbot
.\run_rasa.ps1
```

This script will create a venv with Python 3.10/3.11 (if available), install deps, train, and run both servers.

## Manual setup

```bash
cd ai-services/chatbot
# Use Python 3.10 or 3.11
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Train

```bash
rasa train
```

## Run

**Terminal 1 — Rasa server:**
```bash
rasa run --enable-api --cors "*"
```

**Terminal 2 — Action server:**
```bash
rasa run actions
```

Rasa listens on port 5005. Action server on 5055.

## Frontend

The chat widget connects to `http://localhost:5005/webhooks/rest/webhook` (or via Vite proxy).

## Intents

| Intent | Example |
|--------|---------|
| `ask_timetable` | "When is my next lecture?" |
| `ask_hall_availability` | "Is Hall B free at 2pm?" |
| `ask_lecturer_availability` | "Is Dr. Dias free tomorrow?" |
| `book_appointment` | "I want to meet Dr. Rajapaksha on Monday" |
| `cancel_appointment` | "Cancel my appointment with Dr. Dias" |
| `ask_directions` | "Where is the CS building?" |
| `ask_office_location` | "Where is Dr. Dias's office?" |
| `greeting` | "Hi", "Hello" |
| `goodbye` | "Bye", "Thanks" |
| `fallback` | (low confidence) |
| `out_of_scope` | "What's the weather?" |

## Entities

`course_name`, `lecturer_name`, `hall_name`, `day`, `time`, `building`

## Phase 8.2 — API Integration

Custom actions call the platform API with chatbot auth. Set these env vars:

- `LECSTU_API_URL` — Platform API base (default: http://localhost:5000/api)
- `CHATBOT_API_KEY` — Must match `CHATBOT_API_KEY` in server `.env`

The ChatWidget sends `user_id` in metadata; actions use it to authenticate API calls.

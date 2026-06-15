# LECSTU — Run commands

Base path: `d:\Reasearch\lecstu`

## One-time setup

```powershell
cd d:\Reasearch\lecstu
npm install
npm install --prefix client
npm install --prefix server
```

```powershell
cd d:\Reasearch\lecstu\server
copy .env.example .env
npm run db:migrate
npm run db:seed
```

Edit `server\.env` — set `DATABASE_URL` and JWT secrets.

```powershell
cd d:\Reasearch\lecstu\ai-services\chatbot
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
rasa train
```

---

## Every day — open 5 terminals

### Terminal 1 — API (required)

```powershell
cd d:\Reasearch\lecstu
npm run dev:server
```

### Terminal 2 — Web app (required)

```powershell
cd d:\Reasearch\lecstu
npm run dev:client
```

Open: http://localhost:5173

### Terminal 3 — Chatbot (required)

```powershell
cd d:\Reasearch\lecstu\ai-services\chatbot
.\run_rasa.ps1
```

If you see **port 5005 already in use**, stop the old instance or run:

```powershell
.\run_rasa.ps1 -StopExisting
```

After changing `data/nlu.yml`, retrain: `.\run_rasa.ps1 -Train -StopExisting`

### Terminal 4 — Floor plan AI (required for indoor map / “guide me to room” in chat)

```powershell
cd d:\Reasearch\lecstu\ai-services\floorplan-vision
.\run_vision.ps1
```

After uploading a floor JPG in **Admin → Buildings**, click **AI** on that floor (first run may take 1–3 minutes).

If the API log says `Floor plan AI failed (500)`, stop this terminal (Ctrl+C) and run `.\run_vision.ps1` again so the latest code loads.

### Terminal 5 — Indoor Navigation AI Engine (required for AI directions & enhanced floor analysis)

```powershell
cd d:\Reasearch\lecstu\ai-services\indoor-navigation-engine
.\run_engine.ps1
```

Or from repo root: `npm run indoor-navigation`

This powers chatbot navigation queries, dashboard route visualization, and enhanced floor map processing (EasyOCR + NetworkX).

First run installs core packages (~200MB). If pip times out, retry: `.\.venv\Scripts\pip install --default-timeout=300 -r requirements.txt`

Optional PaddleOCR (large): `pip install -r requirements-paddle.txt` then `$env:NAV_USE_PADDLE='true'`

---


## Ports

| Service | Port |
|---------|------|
| Web app | 5173 |
| API | 5000 |
| Rasa | 5005 |
| Rasa actions | 5055 |
| Floor plan AI | 8003 |
| Indoor Navigation AI | 8004 |

---

## Optional — only if you use that feature

**Voice (ASR)** — extra terminal:

```powershell
cd d:\Reasearch\lecstu
npm run asr
```

In `server\.env`: `ASR_USE_HTTP=true` and `ASR_SERVICE_URL=http://localhost:8001` — then restart Terminal 1.

**Timetable PDF import** — extra terminal:

```powershell
cd d:\Reasearch\lecstu
npm run timetable-extract
```

In `server\.env`: `TIMETABLE_EXTRACT_URL=http://localhost:8002` — then restart Terminal 1.

Excel timetable import does **not** need the PDF terminal.

---

## Retrain chatbot (only after changing `data/nlu.yml`)

```powershell
cd d:\Reasearch\lecstu\ai-services\chatbot
.\run_rasa.ps1 -Train
```

Then start Terminal 3 again with `.\run_rasa.ps1`.

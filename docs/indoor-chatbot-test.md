# Indoor navigation — chatbot manual test (Phase 6.9)

**Prerequisites:** API (`npm run dev:server`), client, Rasa (`.\run_rasa.ps1 -Train` in `ai-services/chatbot`), student login with timetable for **today**.

## 1. Today’s classes

| Step | Action | Expected |
|------|--------|----------|
| 1 | Chat: *"What classes do I have today?"* | Lists times, courses, lecturers, halls, building/floor |
| 2 | Check response | Includes `/map/guide?...` per class if mapped |
| 3 | Check response | Ends with `/map/guide?today=1` for all legs |

## 2. Guide to a room

| Step | Action | Expected |
|------|--------|----------|
| 1 | Chat: *"Guide me to ELV ROOM in Administration building ground floor"* | 3–6 numbered walking steps |
| 2 | Click **Open guided map** link | `/map/guide` shows floor JPG, yellow path, steps |
| 3 | Use Previous / Next | Steps and floor view update |

## 3. Next class

| Step | Action | Expected |
|------|--------|----------|
| 1 | Chat: *"Guide me to my next class"* | Names current or next slot + indoor route |
| 2 | Open guided map link | Route to that hall |

## 4. Multi-room day

| Step | Action | Expected |
|------|--------|----------|
| 1 | Student with 2+ halls today | Chat lists multiple locations |
| 2 | Dashboard **Guide all today** | `/map/guide?today=1` with tabs per class |

## 5. Voice (optional)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Chat widget → mic → speak same questions | Same intents as typed text |

## 6. Failure cases

| Step | Action | Expected |
|------|--------|----------|
| 1 | Room not on map | Clear message + admin links |
| 2 | No walking graph | Message to set up **Walking paths** |

## Retrain after NLU changes

```powershell
cd d:\Reasearch\lecstu\ai-services\chatbot
.\run_rasa.ps1 -Train
```

Restart Rasa after retrain.

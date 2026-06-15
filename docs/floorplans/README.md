# Floor plan images (Phase 6.4)

## Faculty layout (three buildings)

Every building includes a **Ground floor (G)** — floor number **0** in the system — plus upper floors.

| Code | Building | Total levels | Ground file | Upper floors |
|------|----------|--------------|-------------|--------------|
| `ACAD` | Academic Building | 12 | `ACAD_floor0.jpg` or `ACAD_ground.jpg` | `ACAD_floor1.jpg` … `ACAD_floor11.jpg` |
| `ADMIN` | Administration Building | 11 | `ADMIN_floor0.jpg` or `ADMIN_ground.jpg` | `ADMIN_floor1.jpg` … `ADMIN_floor10.jpg` |
| `LAB` | Laboratory Building | 10 | `LAB_floor0.jpg` or `LAB_ground.jpg` | `LAB_floor1.jpg` … `LAB_floor9.jpg` |

| Building | Rooms on typical floors |
|----------|-------------------------|
| Academic | Lecture halls, classrooms |
| Administration | Lecturer offices, meeting rooms |
| Laboratory | Computer labs, engineering labs |

## Where to upload

**Admin → Buildings** → **Bulk upload JPGs** or **Floor Plans** icon on a row.

Or copy files to `server/uploads/floorplans/import/` and run `npm run db:import-floorplans`.

## Naming rules

- **Ground:** `CODE_floor0.jpg` **or** `CODE_ground.jpg`
- **Upper:** `CODE_floor1.jpg`, `CODE_floor2.jpg`, …
- Formats: JPEG, PNG, WebP (max 5 MB)

## AI: auto-detect rooms from JPG (image recognition)

Uploading a floor plan can **automatically** create room pins and walking paths — no manual clicking for every room.

1. Start the vision service (keep terminal open):

   ```powershell
   cd d:\Reasearch\lecstu\ai-services\floorplan-vision
   .\run_vision.ps1
   ```

2. **Admin → Buildings → Floor Plans** → upload `ADMIN_floor0.jpg` (or click **AI** on an existing floor).

3. Technology (**v2**): **EasyOCR** (room names + legend lines) + **OpenCV** (wall-gap doors, door-arc symbols, room regions, stairs/lift/toilet labels) + auto path graph through door waypoints.

4. First analysis per machine may take **1–3 minutes** (EasyOCR model download).

5. Then students can ask the chatbot: *Guide me to ELV ROOM in Administration building*.

Manual **Room map editor** is still available to fix or add pins the AI missed.

## Refresh building counts

```powershell
cd d:\Reasearch\lecstu\server
npm run db:seed-faculty-buildings
```

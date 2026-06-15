# Adding a New Floor (Phase 11.1+)

No code changes are required when the faculty adds another floor to a building. Follow this admin workflow.

## Prerequisites

- Building already registered (`npm run db:seed-faculty-buildings` in `/server`)
- Floor index follows existing convention: **0 = Ground**, **1 = First**, **2 = Second**, …

If the building’s total floor count in the database is too low, update `floors` in Admin or via `server/src/constants/facultyBuildings.ts` and re-run the seed script.

## Steps

### 1. Upload floor plan JPG

Admin → **Indoor Navigation** → **Setup**

- Select building and floor
- Upload `CODE_floorN.jpg` (e.g. `LAB_floor2.jpg`)

Or bulk upload to `server/uploads/floorplans/import/` and run:

```bash
cd server
npm run db:import-floorplans
```

### 2. Calibrate (Locations & publish tab)

- **Scale (meters per % unit)** — default `0.45`; adjust if distances look wrong
- **Drawable region** — crop legend/footer so routes draw on the map area only
- Save calibration

### 3. Run AI analysis

Floor plan tab → **Run AI analyze** (also runs automatically on upload when the vision service is enabled).

Auto-detected markers start as **pending** until you approve them.

### 4. Review locations

**Locations & publish** tab:

- Approve / reject / delete each detected room, entrance, stair, etc.
- Link **HALL** / **OFFICE** / **LAB** markers to timetable entities
- Place **building connection** markers on doorways between buildings (ADMIN↔ACAD, ACAD↔LAB)

### 5. Publish

When all locations are approved:

- Set publish status to **Published**
- Students only see **Published** floors with **approved** markers

### 6. Walking paths (Phase 11.2)

After publish, sync navigation graph and connect corridor edges (admin walking-path editor).

## File naming reference

| Floor | Filename examples |
|-------|-------------------|
| Ground | `ACAD_floor0.jpg`, `ACAD_ground.jpg` |
| First | `ACAD_floor1.jpg` |
| Nth | `ACAD_floorN.jpg` |

## Building codes

| Building | Code |
|----------|------|
| Administration | `ADMIN` |
| Academic | `ACAD` |
| Laboratory | `LAB` |

# Indoor Navigation — Deployment

## 1. Database migration

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

Migration: `20260609120000_indoor_nav_module` adds `nav_qr_codes`, `navigation_sessions`, `FloorPlan.scaleMetersPerUnit`, `NavNodeType.EXIT`.

## 2. Services

| Service | Port | Required for |
|---------|------|--------------|
| PostgreSQL | 5432 | Graph storage |
| Express API | 3000 | All navigation APIs |
| Python indoor-navigation-engine | 8004 | AI floor analyze + NL directions (optional at runtime) |

Start engine (optional but recommended for NL steps):

```powershell
cd ai-services/indoor-navigation-engine
.\run_engine.ps1
```

## 3. Admin setup (per building)

1. **Admin → Buildings** — upload floor plan JPG/PNG per floor
2. **AI Analyze** (once per floor) — builds markers + graph draft
3. **Admin → Room map editor** — refine room pins
4. **Admin → Walking paths** — connect corridor/stair/lift nodes
5. **Generate QR codes** — select node → "Generate QR for this node"
6. Set **scaleMetersPerUnit** on floor plan (optional, via DB or future admin UI) for accurate distance estimates

## 4. Student usage

1. Dashboard → Indoor Navigation → pick destination
2. Optional: **Campus Map → Scan QR location** before guiding
3. Follow step list; map shows start (green), destination (red), active path segment (gold)

## 5. Environment variables

```env
INDOOR_NAVIGATION_URL=http://localhost:8004
INDOOR_NAVIGATION_ENABLED=true
```

## 6. Production checklist

- [ ] Run migrations on production DB
- [ ] Ensure floor plan images served from `/uploads`
- [ ] Start indoor-navigation-engine alongside API
- [ ] Print QR codes (encode `NavQrCode.code` string) at entrances/rooms
- [ ] Verify ENTRANCE nodes exist per building or users scan QR first

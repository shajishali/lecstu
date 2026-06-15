# Indoor Navigation Module — Architecture

Integrated into LECSTU (Express + React + Prisma + Python AI engine). Extends existing map/navigation without replacing `/api/map/*` or admin editors.

## Principles

1. **Graph-first routing** — Floor plans are analyzed once (admin AI analyze); runtime routing uses `NavNode` + `NavEdge` in PostgreSQL only.
2. **Minimal breaking changes** — Legacy endpoints unchanged; new surface at `/api/indoor-nav/*`.
3. **Pluggable positioning** — QR (Phase 1); BLE/UWB stubs via `PositionProvider` interface.

## Layer diagram

```
┌─────────────────────────────────────────────────────────────┐
│  React (Vite) — CampusMap, GuidedMap, QrScanPage, Admin UI   │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST
┌───────────────────────────▼─────────────────────────────────┐
│  Express API                                                 │
│  /api/map/* (legacy)    /api/indoor-nav/* (module)           │
│  /api/navigation/*      /api/admin/map/nav-graph/*           │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
┌───────────▼──────────┐    ┌─────────────▼──────────────────┐
│ indoorNavigation     │    │ modules/indoor-navigation/       │
│ Service (graph CRUD, │    │ pathfinding, positioning,        │
│ turn-by-turn)        │    │ sessions, QR repository          │
└───────────┬──────────┘    └─────────────┬──────────────────┘
            │                             │
┌───────────▼─────────────────────────────▼───────────────────┐
│  PostgreSQL — map_buildings, floor_plans, nav_nodes,        │
│  nav_edges, nav_qr_codes, navigation_sessions, map_markers  │
└─────────────────────────────────────────────────────────────┘
            │ (admin analyze only)
┌───────────▼─────────────────────────────────────────────────┐
│  Python Indoor Navigation Engine :8004                       │
│  OCR, floor graph build, NL direction polish                 │
└─────────────────────────────────────────────────────────────┘
```

## Pathfinding

- **Primary:** A* (`modules/indoor-navigation/pathfinding/astar.ts`)
- **Fallback:** Dijkstra (`dijkstra.ts`) when A* returns no path
- **Multi-floor:** Edges between `STAIRS` / `LIFT` nodes; +5 weight penalty for implicit cross-floor links
- **Metrics:** `distanceMeters`, `estimatedMinutes` from `FloorPlan.scaleMetersPerUnit` (default 0.45 m per % unit)

## Positioning phases

| Phase | Source | Implementation |
|-------|--------|----------------|
| 1 | QR code | `NavQrCode` → `QrPositionProvider` → `NavigationSession` |
| 2 | BLE beacon | `registerPositionProvider('BLE_BEACON', …)` |
| 3 | UWB | `registerPositionProvider('UWB', …)` |

Active session `currentNodeId` is used as route `fromNodeId` automatically.

## NL navigation

`parseSourceDestinationQuery()` supports:

- `Take me to the cafeteria`
- `Guide me from reception to student affairs office`

Flow: intent detect → search map entities → `computeRouteRequest()` → optional AI step polish → map overlay.

## Folder structure

```
server/src/modules/indoor-navigation/
  pathfinding/       A*, Dijkstra, metrics
  positioning/       PositionProvider, QR
  repositories/      nav graph, QR codes
  services/          route, navigation session
  controllers/       HTTP handlers
  routes/            /indoor-nav router

client/src/
  services/indoorNavApi.ts
  pages/QrScanPage.tsx
  pages/CampusMap.tsx   (enhanced route viz)

docs/indoor-navigation/
  ARCHITECTURE.md
  API.md
  ER-DIAGRAM.md
  DEPLOYMENT.md
```

## Performance

- Sparse corridor graphs: A* typically **&lt; 50 ms** for buildings with thousands of nodes
- Graph loaded per building once per request; suitable for 10k+ nodes with indexed `nav_nodes(buildingId, floor)`

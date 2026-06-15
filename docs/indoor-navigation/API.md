# Indoor Navigation API

Base URL: `/api/indoor-nav` (requires JWT unless noted)

## Floor plans & nodes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/floorplans` | User | Alias of `GET /map/buildings` |
| GET | `/nodes?buildingId=&floor=` | User | List navigation nodes |
| POST | `/nodes` | Admin | Alias of admin nav-graph node create |
| POST | `/edges` | Admin | Alias of admin nav-graph edge create |

## Routing

| Method | Path | Body / params | Response |
|--------|------|---------------|----------|
| POST | `/route` | `{ buildingId, toMarkerId?, toHallId?, q?, sourceQ?, fromNodeId?, saveSession? }` | Route + steps + polyline + metrics |
| GET | `/route/:sessionId` | — | Stored session + route payload |
| POST | `/navigation` | `{ message, buildingId? }` | NL query → route (supports from/to) |

### Example: POST /route

```json
{
  "buildingId": "uuid",
  "toMarkerId": "uuid",
  "sourceQ": "reception",
  "saveSession": true
}
```

Response fields (when found):

- `steps[]`, `polyline[]`, `segments[]`
- `distanceMeters`, `estimatedMinutes`, `pathfindingAlgorithm` (`astar` | `dijkstra`)
- `startLabel`, `startNodeId`, `goalNodeId`
- `sessionId` (if `saveSession: true`)

## Positioning (QR)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/position/qr` | `{ code }` | Set user position from QR scan |
| GET | `/session/active?buildingId=` | — | Current navigation session |
| POST | `/session/:id/complete` | — | End session |

## QR administration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/qr?buildingId=` | Admin | List QR codes |
| POST | `/qr` | Admin | `{ buildingId, navNodeId, label?, code? }` |
| DELETE | `/qr/:id` | Admin | Remove QR code |

## Legacy compatibility

Existing clients should continue using:

- `GET /api/map/nav-route` — same routing engine
- `POST /api/navigation/query` — now supports source/destination parsing

New clients should prefer `/api/indoor-nav/route` for session + metrics.

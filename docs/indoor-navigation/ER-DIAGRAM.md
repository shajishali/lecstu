# Indoor Navigation — ER Diagram

```mermaid
erDiagram
  MapBuilding ||--o{ FloorPlan : has
  MapBuilding ||--o{ MapMarker : has
  MapBuilding ||--o{ NavNode : has
  MapBuilding ||--o{ NavQrCode : has
  MapBuilding ||--o{ NavigationSession : has

  NavNode ||--o{ NavEdge : from
  NavNode ||--o{ NavEdge : to
  NavNode ||--o| MapMarker : links
  NavNode ||--o{ NavQrCode : has

  User ||--o{ NavigationSession : owns

  MapBuilding {
    uuid id PK
    string name
    string code
    int floors
    json metadata
  }

  FloorPlan {
    uuid id PK
    uuid buildingId FK
    int floor
    string imagePath
    json bounds
    float scaleMetersPerUnit
  }

  MapMarker {
    uuid id PK
    uuid buildingId FK
    int floor
    string label
    float x
    float y
    enum type
  }

  NavNode {
    uuid id PK
    uuid buildingId FK
    int floor
    string label
    float x
    float y
    enum type
    uuid mapMarkerId FK
  }

  NavEdge {
    uuid id PK
    uuid fromNodeId FK
    uuid toNodeId FK
    float weight
    bool bidirectional
  }

  NavQrCode {
    uuid id PK
    string code UK
    uuid buildingId FK
    uuid navNodeId FK
    bool isActive
  }

  NavigationSession {
    uuid id PK
    uuid userId FK
    uuid buildingId FK
    enum status
    enum positionSource
    uuid currentNodeId
    uuid destinationNodeId
    json routePayload
    int stepIndex
  }
```

## Notes

- **Routes are not persisted** as a separate table; optional snapshot in `NavigationSession.routePayload`.
- **Graph is the source of truth** for pathfinding; markers are display/search entities linked via `NavNode.mapMarkerId`.

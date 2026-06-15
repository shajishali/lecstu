"""
Spatial Graph Builder — constructs NetworkX navigation graph from detected features.
"""
from __future__ import annotations

import math
from typing import Any

import networkx as nx

from engine.logging_config import setup_logging

logger = setup_logging("spatial-graph")

MAX_EDGE_DIST = 22.0  # percent coordinates on floor plan


def _dist(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _node_id(label: str, idx: int) -> str:
    safe = "".join(c if c.isalnum() else "_" for c in label)[:24]
    return f"{safe}_{idx}"


def build_spatial_graph(
    rooms: list[dict],
    corridors: list[dict],
    doors: list[dict],
    entrances: list[dict] | None = None,
) -> dict[str, Any]:
    G = nx.Graph()
    nodes: list[dict[str, Any]] = []
    idx = 0

    def add_node(item: dict, default_type: str) -> str:
        nonlocal idx
        nid = _node_id(item.get("label", "node"), idx)
        idx += 1
        ntype = item.get("type", default_type)
        node = {
            "id": nid,
            "label": item.get("label", nid),
            "x": float(item["x"]),
            "y": float(item["y"]),
            "type": ntype,
            "confidence": float(item.get("confidence", 0.5)),
        }
        nodes.append(node)
        G.add_node(nid, **node)
        return nid

    entrance_ids: list[str] = []
    for ent in entrances or []:
        if ent.get("type") == "ENTRANCE":
            entrance_ids.append(add_node(ent, "ENTRANCE"))

    if not entrance_ids:
        entrance_ids.append(
            add_node(
                {"label": "Main entrance", "x": 50.0, "y": 92.0, "type": "ENTRANCE", "confidence": 0.5},
                "ENTRANCE",
            )
        )

    corridor_ids = [add_node(c, "CORRIDOR") for c in corridors]
    room_ids = [add_node(r, "ROOM") for r in rooms if r.get("type") != "DOOR"]
    door_ids = [add_node(d, "CORRIDOR") for d in doors]

    by_id = {n["id"]: n for n in nodes}
    edges: list[dict[str, Any]] = []

    def maybe_connect(a_id: str, b_id: str, label: str | None = None):
        if a_id == b_id:
            return
        a, b = by_id[a_id], by_id[b_id]
        w = _dist(a, b)
        if w > MAX_EDGE_DIST:
            return
        if not G.has_edge(a_id, b_id):
            G.add_edge(a_id, b_id, weight=w, label=label)
            edges.append({"from": a_id, "to": b_id, "weight": round(w, 2), "label": label})

    hub_id = corridor_ids[0] if corridor_ids else entrance_ids[0]
    for eid in entrance_ids:
        maybe_connect(eid, hub_id, "entrance to corridor")

    for cid in corridor_ids:
        maybe_connect(hub_id, cid)

    for rid in room_ids:
        nearest_c = min(corridor_ids or entrance_ids, key=lambda c: _dist(by_id[c], by_id[rid]))
        maybe_connect(nearest_c, rid, "corridor to room")

    for did in door_ids:
        nearest_c = min(corridor_ids or entrance_ids, key=lambda c: _dist(by_id[c], by_id[did]))
        maybe_connect(nearest_c, did, "door")
        if room_ids:
            nearest_r = min(room_ids, key=lambda r: _dist(by_id[r], by_id[did]))
            if _dist(by_id[did], by_id[nearest_r]) < 14:
                maybe_connect(did, nearest_r, "door to room")

    for i, a in enumerate(corridor_ids):
        for b in corridor_ids[i + 1 :]:
            if _dist(by_id[a], by_id[b]) < MAX_EDGE_DIST * 0.85:
                maybe_connect(a, b)

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "entrance_count": len(entrance_ids),
            "room_count": len(room_ids),
            "corridor_count": len(corridor_ids),
        },
        "graph": G,
    }

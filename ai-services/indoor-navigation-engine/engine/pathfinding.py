"""
Pathfinding Engine — A* on NetworkX graph using actual floor-plan coordinates.
"""
from __future__ import annotations

import math
from typing import Any

import networkx as nx

from engine.logging_config import setup_logging

logger = setup_logging("pathfinding")


def _heuristic(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def find_path(
    graph: nx.Graph,
    start_id: str,
    goal_id: str,
) -> dict[str, Any] | None:
    if start_id not in graph or goal_id not in graph:
        return None

    try:
        path_ids = nx.astar_path(
            graph,
            start_id,
            goal_id,
            heuristic=lambda u, v: _heuristic(graph.nodes[u], graph.nodes[v]),
            weight="weight",
        )
    except nx.NetworkXNoPath:
        return None

    path_nodes = [dict(graph.nodes[nid]) for nid in path_ids]
    polyline = [{"x": n["x"], "y": n["y"], "label": n["label"], "type": n["type"]} for n in path_nodes]

    total = 0.0
    for i in range(1, len(path_nodes)):
        total += _heuristic(path_nodes[i - 1], path_nodes[i])

    return {
        "path_node_ids": path_ids,
        "path_nodes": path_nodes,
        "polyline": polyline,
        "distance": round(total, 2),
    }


def resolve_start_goal(
    graph: nx.Graph,
    start_id: str | None,
    goal_label: str | None,
    goal_id: str | None = None,
) -> tuple[str | None, str | None]:
    """Pick entrance as start; match goal by label (case-insensitive partial)."""
    nodes = list(graph.nodes(data=True))
    if not nodes:
        return None, None

    if not start_id:
        entrances = [nid for nid, d in nodes if d.get("type") == "ENTRANCE"]
        start_id = entrances[0] if entrances else nodes[0][0]

    if goal_id and goal_id in graph:
        return start_id, goal_id

    if goal_label:
        gl = goal_label.lower()
        for nid, data in nodes:
            if gl in data.get("label", "").lower():
                return start_id, nid
        for nid, data in nodes:
            if data.get("type") == "ROOM" and any(tok in data.get("label", "").lower() for tok in gl.split()):
                return start_id, nid

    return start_id, None

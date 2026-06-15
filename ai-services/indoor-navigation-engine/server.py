"""LECSTU Floor Navigation AI Engine — FastAPI service (port 8004)."""
import json
import logging
import os
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine.direction_generator import generate_directions_from_api_payload
from engine.floor_processor import process_floor_map
from engine.intent_detector import detect_navigation_intent
from engine.logging_config import setup_logging
from engine.pathfinding import find_path, resolve_start_goal
from engine.spatial_graph import build_spatial_graph
import networkx as nx

logger = setup_logging("nav-engine")

app = FastAPI(title="LECSTU Indoor Navigation Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class IntentRequest(BaseModel):
    message: str


class DirectionsRequest(BaseModel):
    destinationLabel: str = ""
    buildingName: str | None = None
    polyline: list[dict] = Field(default_factory=list)
    pathNodes: list[dict] = Field(default_factory=list)


class PathRequest(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    startNodeId: str | None = None
    goalLabel: str | None = None
    goalNodeId: str | None = None


def _sanitize(obj):
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if hasattr(obj, "item"):
        return obj.item()
    return obj


def _build_nx_graph(nodes: list[dict], edges: list[dict]) -> nx.Graph:
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"], **{k: v for k, v in n.items() if k != "id"})
    for e in edges:
        G.add_edge(e["from"], e["to"], weight=e.get("weight", 1.0), label=e.get("label"))
    return G


@app.on_event("startup")
def warmup():
    def _load():
        try:
            from engine.ocr_engine import _get_easyocr

            logger.info("Loading EasyOCR model (first time may download ~100MB)...")
            _get_easyocr()
            logger.info("OCR engine ready.")
        except Exception as e:
            logger.warning("OCR warmup failed: %s", e)

    threading.Thread(target=_load, daemon=True, name="ocr-warmup").start()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "indoor-navigation-engine",
        "engine": "easyocr+opencv+networkx-v1",
    }


@app.post("/intent/detect")
def detect_intent(body: IntentRequest):
    result = detect_navigation_intent(body.message)
    return {
        "success": True,
        "data": {
            "isNavigation": result.is_navigation,
            "confidence": result.confidence,
            "intent": result.intent,
            "destinationQuery": result.destination_query,
            "buildingHint": result.building_hint,
            "debug": result.debug,
        },
    }


@app.post("/floor/process")
async def process_floor(file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    if not name.endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise HTTPException(400, "Image file required (jpg, png, webp)")

    data = await file.read()
    if len(data) < 500:
        raise HTTPException(400, "File too small")

    suffix = Path(name).suffix or ".jpg"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        with open(path, "wb") as f:
            f.write(data)
        result = _sanitize(process_floor_map(path))
        payload = {"success": True, "data": result}
        json.dumps(payload)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("floor process failed")
        raise HTTPException(500, f"Floor processing failed: {e}") from e
    finally:
        Path(path).unlink(missing_ok=True)


@app.post("/directions/generate")
def generate_directions(body: DirectionsRequest):
    if body.pathNodes:
        from engine.direction_generator import generate_directions

        steps_result = generate_directions(
            body.pathNodes,
            body.destinationLabel or body.pathNodes[-1].get("label", "destination"),
            body.buildingName,
        )
    elif body.polyline:
        steps_result = generate_directions_from_api_payload(body.model_dump())
    else:
        raise HTTPException(400, "Provide polyline or pathNodes")

    return {"success": True, "data": steps_result}


@app.post("/path/find")
def find_route(body: PathRequest):
    if not body.nodes or not body.edges:
        raise HTTPException(400, "nodes and edges required")

    G = _build_nx_graph(body.nodes, body.edges)
    start_id, goal_id = resolve_start_goal(G, body.startNodeId, body.goalLabel, body.goalNodeId)
    if not goal_id:
        raise HTTPException(404, f"Could not resolve destination: {body.goalLabel}")

    path = find_path(G, start_id, goal_id)
    if not path:
        raise HTTPException(404, "No path found in spatial graph")

    from engine.direction_generator import generate_directions

    dest_label = body.goalLabel or G.nodes[goal_id].get("label", "destination")
    directions = generate_directions(path["path_nodes"], dest_label)

    return {
        "success": True,
        "data": {
            **path,
            "startNodeId": start_id,
            "goalNodeId": goal_id,
            "directions": directions,
        },
    }

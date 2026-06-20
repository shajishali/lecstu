import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import {
  ArrowLeft,
  Check,
  GitBranch,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Trash2,
  Unlink,
} from 'lucide-react';
import ConfirmDialog from '@components/ConfirmDialog';
import { createQrCode, deleteQrCode, listQrCodes } from '@services/indoorNavApi';
import { clientToImagePercent, setFloorPlanCanvasAspect } from '@utils/floorPlanCanvas';
import { floorPlanImageUrl } from '@utils/floorPlanImageUrl';

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

const NODE_TYPES = ['CORRIDOR', 'STAIRS', 'LIFT', 'ENTRANCE', 'EXIT', 'ROOM'] as const;
const PATH_POINT_TYPES = ['CORRIDOR', 'STAIRS', 'LIFT'] as const;
const SNAP_RADIUS_PCT = 4.5;

const NODE_COLORS: Record<string, string> = {
  CORRIDOR: '#64748b',
  STAIRS: '#f97316',
  LIFT: '#06b6d4',
  ENTRANCE: '#ef4444',
  EXIT: '#a855f7',
  ROOM: '#3b82f6',
};

interface NavNode {
  id: string;
  floor: number;
  label: string;
  x: number;
  y: number;
  type: string;
  mapMarkerId: string | null;
  mapMarker?: { hall?: { id: string; name: string } | null } | null;
}

interface NavEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  bidirectional: boolean;
  label: string | null;
  from: { id: string; floor: number; label: string };
  to: { id: string; floor: number; label: string };
}

interface EditorContext {
  building: { id: string; name: string; code: string; floors: number };
  floor: number;
  floorPlan: { id: string; imagePath: string };
  nodes: NavNode[];
  edges: NavEdge[];
  markersWithoutNode: { id: string; label: string }[];
  halls: { id: string; name: string; building: string; floor: number }[];
  stats: { nodeCount: number; edgeCount: number; entranceCount: number };
}

type ToolMode = 'idle' | 'add' | 'connect' | 'select' | 'delete-line';
type PathWorkflowStep = 'idle' | 'adding' | 'connecting';

function isPlaceNode(n: NavNode): boolean {
  return n.mapMarkerId != null;
}

function isPathPoint(n: NavNode): boolean {
  return !isPlaceNode(n);
}

/** Admin-placed labels from Add path point (vs auto-build / engine import). */
function isManualPathPoint(n: NavNode): boolean {
  if (!isPathPoint(n)) return false;
  return /^(Path point \d+|Stairs \d+|Lift \d+)$/.test(n.label);
}

function isEdgeVisibleInPathEditor(
  edge: NavEdge,
  placeNavNodeIds: Set<string>,
  pathNodeIds: Set<string>
): boolean {
  const fromVisible = placeNavNodeIds.has(edge.fromNodeId) || pathNodeIds.has(edge.fromNodeId);
  const toVisible = placeNavNodeIds.has(edge.toNodeId) || pathNodeIds.has(edge.toNodeId);
  return fromVisible && toVisible;
}

interface PlaceMarker {
  markerId: string;
  navNodeId: string | null;
  label: string;
  x: number;
  y: number;
  legendNumber?: number | null;
}

type ConnectablePoint = { id: string; x: number; y: number; label: string };

function findSnapPoint(
  points: ConnectablePoint[],
  x: number,
  y: number,
  excludeId?: string | null
): ConnectablePoint | null {
  let best: ConnectablePoint | null = null;
  let bestD = SNAP_RADIUS_PCT;
  for (const p of points) {
    if (p.id === excludeId) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

type MarkerSnapshot = {
  id: string;
  label: string;
  x: number;
  y: number;
  legendNumber?: number | null;
};

function buildPlaceMarkers(
  markers: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    reviewStatus?: string;
    legendNumber?: number | null;
  }>,
  nodes: NavNode[]
): PlaceMarker[] {
  return markers
    .filter((m) => m.reviewStatus === 'approved')
    .map((m) => ({
      markerId: m.id,
      navNodeId: nodes.find((n) => n.mapMarkerId === m.id)?.id ?? null,
      label: m.label,
      x: m.x,
      y: m.y,
      legendNumber: m.legendNumber,
    }));
}

function buildPlaceMarkersFromSnapshot(snapshot: MarkerSnapshot[], nodes: NavNode[]): PlaceMarker[] {
  return snapshot.map((m) => ({
    markerId: m.id,
    navNodeId: nodes.find((n) => n.mapMarkerId === m.id)?.id ?? null,
    label: m.label,
    x: m.x,
    y: m.y,
    legendNumber: m.legendNumber,
  }));
}

interface IndoorNavGraphEditorProps {
  embedded?: boolean;
  buildingId?: string;
  floor?: number;
  /** Same uploaded JPG as Locations & publish — do not use a different/processed image. */
  floorPlanImageUrl?: string;
  onGraphChange?: () => void;
}

export default function IndoorNavGraphEditor({
  embedded = false,
  buildingId: controlledBuildingId,
  floor: controlledFloor,
  floorPlanImageUrl: controlledFloorPlanImageUrl,
  onGraphChange,
}: IndoorNavGraphEditorProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapImgRef = useRef<HTMLImageElement>(null);
  const floorPlanRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [buildings, setBuildings] = useState<
    { id: string; name: string; code: string; floors: number; floorPlans: { floor: number }[] }[]
  >([]);
  const [buildingId, setBuildingId] = useState(
    controlledBuildingId || searchParams.get('buildingId') || ''
  );
  const [floor, setFloor] = useState(
    controlledFloor ?? parseInt(searchParams.get('floor') || '0', 10)
  );
  const [ctx, setCtx] = useState<EditorContext | null>(null);
  const [placeMarkers, setPlaceMarkers] = useState<PlaceMarker[]>([]);
  const [testMarkerOptions, setTestMarkerOptions] = useState<
    Array<{ markerId: string; label: string; legendNumber?: number | null }>
  >([]);
  const [locationsLocked, setLocationsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pathOnlyMode = embedded;
  const [tool, setTool] = useState<ToolMode>(pathOnlyMode ? 'idle' : 'add');
  const [pathWorkflowStep, setPathWorkflowStep] = useState<PathWorkflowStep>('idle');
  const [nodeType, setNodeType] = useState<string>('CORRIDOR');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgePendingDelete, setEdgePendingDelete] = useState<NavEdge | null>(null);
  const [deletingEdge, setDeletingEdge] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectCursor, setConnectCursor] = useState<{ x: number; y: number } | null>(null);
  const [snapNodeId, setSnapNodeId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [testFromMarkerId, setTestFromMarkerId] = useState('');
  const [testToMarkerId, setTestToMarkerId] = useState('');
  const [testToHallId, setTestToHallId] = useState('');
  const [testPath, setTestPath] = useState<{ x: number; y: number }[] | null>(null);
  const [testSteps, setTestSteps] = useState<string[]>([]);
  const [qrCodes, setQrCodes] = useState<
    Array<{ id: string; code: string; label: string | null; navNode: { id: string; label: string; floor: number } }>
  >([]);

  const fetchQrCodes = useCallback(async () => {
    if (!buildingId) {
      setQrCodes([]);
      return;
    }
    try {
      const data = await listQrCodes(buildingId);
      setQrCodes(data || []);
    } catch {
      setQrCodes([]);
    }
  }, [buildingId]);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings');
      setBuildings(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load buildings');
    }
  }, []);

  const scrollToFloorPlan = () => {
    requestAnimationFrame(() => {
      floorPlanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToToolbar = () => {
    requestAnimationFrame(() => {
      toolbarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const loadEditor = useCallback(async (opts?: { silent?: boolean }) => {
    if (!buildingId) {
      setCtx(null);
      return;
    }
    if (!opts?.silent) {
      setLoading(true);
      setTestPath(null);
      setTestSteps([]);
    }
    try {
      const res = await api.get('/admin/map/nav-graph/editor', {
        params: { buildingId, floor },
      });
      const editorData = res.data.data as EditorContext;
      setCtx(editorData);
      if (embedded) {
        const locRes = await api.get(
          `/admin/buildings/${buildingId}/floorplan/${floor}/locations`
        );
        const locData = locRes.data.data;
        const locked = !!locData?.floorPlan?.locationsLockedAt;
        setLocationsLocked(locked);
        const snapshot = locData?.floorPlan?.lockedMarkerSnapshot as MarkerSnapshot[] | null;
        const locMarkers = locData?.markers || [];
        if (locked && snapshot?.length) {
          setPlaceMarkers(buildPlaceMarkersFromSnapshot(snapshot, editorData.nodes));
          setTestMarkerOptions(
            snapshot.map((m) => ({
              markerId: m.id,
              label: m.label,
              legendNumber: m.legendNumber,
            }))
          );
        } else {
          setPlaceMarkers(buildPlaceMarkers(locMarkers, editorData.nodes));
          setTestMarkerOptions(
            locMarkers.map((m: { id: string; label: string; legendNumber?: number | null }) => ({
              markerId: m.id,
              label: m.label,
              legendNumber: m.legendNumber,
            }))
          );
        }
      } else {
        setPlaceMarkers([]);
        setTestMarkerOptions([]);
        setLocationsLocked(false);
      }
      if (!opts?.silent) {
        setSelectedId(null);
        setSelectedEdgeId(null);
        setConnectFrom(null);
        setConnectCursor(null);
        setSnapNodeId(null);
      }
    } catch (err: unknown) {
      if (!opts?.silent) {
        setCtx(null);
        setPlaceMarkers([]);
      }
      showApiErrorToast(err, 'Upload floor plan first (Admin → Buildings)');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [buildingId, floor, embedded]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    if (controlledBuildingId) setBuildingId(controlledBuildingId);
  }, [controlledBuildingId]);

  useEffect(() => {
    if (controlledFloor !== undefined) setFloor(controlledFloor);
  }, [controlledFloor]);

  useEffect(() => {
    if (!embedded) {
      setSearchParams(buildingId ? { buildingId, floor: String(floor) } : {}, { replace: true });
    }
    if (pathOnlyMode) {
      setPathWorkflowStep('idle');
      setTool('idle');
    }
    loadEditor();
    void fetchQrCodes();
  }, [buildingId, floor, loadEditor, setSearchParams, fetchQrCodes, embedded, pathOnlyMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectFrom(null);
        setConnectCursor(null);
        setSnapNodeId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const notifyGraphChange = () => {
    onGraphChange?.();
  };

  const clientToPercent = (clientX: number, clientY: number) =>
    clientToImagePercent(clientX, clientY, canvasRef.current, mapImgRef.current);

  const cancelConnect = () => {
    setConnectFrom(null);
    setConnectCursor(null);
    setSnapNodeId(null);
  };

  const patchNodePosition = async (id: string, x: number, y: number) => {
    const node = ctx?.nodes.find((n) => n.id === id);
    if (pathOnlyMode && node && isPlaceNode(node)) return;
    try {
      await api.patch(`/admin/map/nav-graph/nodes/${id}`, { x, y });
    } catch (err) {
      showApiErrorToast(err, 'Failed to save position');
      loadEditor();
    }
  };

  const pathNodes = ctx?.nodes.filter((n) => !isPlaceNode(n)) ?? [];
  // Show every path junction (manual + auto) so existing walkway lines stay visible when extending.
  const visiblePathNodes = pathNodes;
  const placeNavNodeIds = useMemo(
    () => new Set(placeMarkers.map((p) => p.navNodeId).filter((id): id is string => !!id)),
    [placeMarkers]
  );
  const pathNodeIds = useMemo(() => new Set(pathNodes.map((n) => n.id)), [pathNodes]);
  const hasEstablishedPaths = (ctx?.edges.length ?? 0) > 0;

  const confirmPathPoints = () => {
    if (visiblePathNodes.length === 0) {
      showToast('info', 'Add at least one path point on the map first');
      return;
    }
    setPathWorkflowStep('connecting');
    setTool('connect');
    cancelConnect();
    scrollToToolbar();
  };

  const pathToolsLocked =
    pathOnlyMode &&
    (pathWorkflowStep === 'idle' || (pathWorkflowStep === 'adding' && !hasEstablishedPaths));

  const connectablePoints: ConnectablePoint[] = pathOnlyMode
    ? [
        ...placeMarkers
          .filter((p) => p.navNodeId)
          .map((p) => ({
            id: p.navNodeId!,
            x: p.x,
            y: p.y,
            label: p.label,
          })),
        ...pathNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, label: n.label })),
      ]
    : (ctx?.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, label: n.label })) ?? []);

  const displayPos = (nodeId: string): { x: number; y: number } | null => {
    const place = placeMarkers.find((p) => p.navNodeId === nodeId);
    if (place) return { x: place.x, y: place.y };
    const node = ctx?.nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : null;
  };

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.indoor-nav-pin, .nav-place-dot')) return;
    if (!ctx) return;

    if (tool === 'connect') {
      return;
    }

    if (tool === 'add') {
      if (pathOnlyMode && !locationsLocked) {
        showToast('info', 'Lock locations on Locations & publish first');
        return;
      }
      const { x, y } = clientToPercent(e.clientX, e.clientY);
      const pathJunctionCount = ctx.nodes.filter((n) => isPathPoint(n) && n.type === 'CORRIDOR').length;
      const label = pathOnlyMode
        ? nodeType === 'CORRIDOR'
          ? `Path point ${pathJunctionCount + 1}`
          : nodeType === 'STAIRS'
            ? `Stairs ${ctx.nodes.filter((n) => n.type === 'STAIRS' && isPathPoint(n)).length + 1}`
            : `Lift ${ctx.nodes.filter((n) => n.type === 'LIFT' && isPathPoint(n)).length + 1}`
        : nodeType === 'CORRIDOR'
          ? `Junction ${pathJunctionCount + 1}`
          : nodeType === 'STAIRS'
            ? `Stairs ${ctx.nodes.filter((n) => n.type === 'STAIRS').length + 1}`
            : nodeType === 'ENTRANCE'
              ? 'Main entrance'
              : `Node ${ctx.nodes.length + 1}`;
      setSaving(true);
      try {
        const res = await api.post('/admin/map/nav-graph/nodes', {
          buildingId,
          floor,
          label,
          x,
          y,
          type: nodeType,
        });
        const newNode = res.data.data as NavNode;
        setCtx((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: [...prev.nodes, newNode],
            stats: { ...prev.stats, nodeCount: prev.stats.nodeCount + 1 },
          };
        });
        setSelectedId(newNode.id);
        if (pathOnlyMode && ctx.edges.length > 0) {
          setPathWorkflowStep('connecting');
          showToast('info', `${label} placed — click Connect, then join it to the existing walkway`);
        } else if (!pathOnlyMode) {
          showToast('success', `Added ${label}`);
        }
        notifyGraphChange();
      } catch (err) {
        showApiErrorToast(err, 'Failed to add node');
      } finally {
        setSaving(false);
      }
    }
  };

  const connectNodes = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSaving(true);
    try {
      const res = await api.post('/admin/map/nav-graph/edges', {
        fromNodeId: fromId,
        toNodeId: toId,
        bidirectional: true,
      });
      const edge = res.data.data as NavEdge;
      setCtx((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          edges: [...prev.edges, edge],
          stats: { ...prev.stats, edgeCount: prev.stats.edgeCount + 1 },
        };
      });
      if (!pathOnlyMode) showToast('success', 'Walking path segment added');
      cancelConnect();
      notifyGraphChange();
    } catch (err) {
      showApiErrorToast(err, 'Failed to connect points');
    } finally {
      setSaving(false);
    }
  };

  const handlePointClick = async (
    pointId: string,
    x: number,
    y: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setSelectedEdgeId(null);
    setSelectedId(pointId);

    if (tool === 'delete-line') return;

    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(pointId);
        setConnectCursor({ x, y });
        return;
      }
      const targetId = snapNodeId && snapNodeId !== connectFrom ? snapNodeId : pointId;
      if (targetId === connectFrom) {
        cancelConnect();
        return;
      }
      await connectNodes(connectFrom, targetId);
    }
  };

  const handleNodeClick = async (node: NavNode, e: React.MouseEvent) => {
    await handlePointClick(node.id, node.x, node.y, e);
  };

  const handlePlaceClick = async (place: PlaceMarker, e: React.MouseEvent) => {
    if (!place.navNodeId) {
      showToast('info', 'Linking place to path graph…');
      await api.post('/admin/map/nav-graph/sync-markers', { buildingId, floor });
      await loadEditor({ silent: true });
      return;
    }
    await handlePointClick(place.navNodeId, place.x, place.y, e);
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    const node = ctx?.nodes.find((n) => n.id === selectedId);
    if (pathOnlyMode && node && isPlaceNode(node)) {
      showToast('info', 'Place locations are fixed — edit them in Locations & publish');
      return;
    }
    setSaving(true);
    try {
      await api.delete(`/admin/map/nav-graph/nodes/${selectedId}`);
      setCtx((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.filter((n) => n.id !== selectedId),
          edges: prev.edges.filter(
            (e) => e.fromNodeId !== selectedId && e.toNodeId !== selectedId
          ),
          stats: {
            ...prev.stats,
            nodeCount: Math.max(0, prev.stats.nodeCount - 1),
            edgeCount: prev.edges.filter(
              (e) => e.fromNodeId !== selectedId && e.toNodeId !== selectedId
            ).length,
          },
        };
      });
      showToast('success', 'Node removed');
      setSelectedId(null);
      notifyGraphChange();
    } catch (err) {
      showApiErrorToast(err, 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteEdge = async (edgeId: string) => {
    try {
      await api.delete(`/admin/map/nav-graph/edges/${edgeId}`);
      setCtx((prev) => {
        if (!prev) return prev;
        const edges = prev.edges.filter((e) => e.id !== edgeId);
        return {
          ...prev,
          edges,
          stats: { ...prev.stats, edgeCount: edges.length },
        };
      });
      setSelectedEdgeId(null);
      setEdgePendingDelete(null);
      showToast('success', 'Path segment removed');
      notifyGraphChange();
    } catch (err) {
      showApiErrorToast(err, 'Failed to remove path segment');
    }
  };

  const confirmDeleteEdge = async () => {
    if (!edgePendingDelete) return;
    setDeletingEdge(true);
    try {
      await deleteEdge(edgePendingDelete.id);
    } finally {
      setDeletingEdge(false);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (tool === 'connect' && connectFrom && ctx) {
      const { x, y } = clientToPercent(e.clientX, e.clientY);
      const snap = findSnapPoint(connectablePoints, x, y, connectFrom);
      if (snap) {
        setConnectCursor({ x: snap.x, y: snap.y });
        setSnapNodeId(snap.id);
      } else {
        setConnectCursor({ x, y });
        setSnapNodeId(null);
      }
    }
    if (!draggingId) return;
    const node = ctx?.nodes.find((n) => n.id === draggingId);
    if (pathOnlyMode && node && isPlaceNode(node)) return;
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    setCtx((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === draggingId ? { ...n, x, y } : n)),
      };
    });
  };

  const syncFromMarkers = async () => {
    if (!buildingId) return;
    setSaving(true);
    try {
      const res = await api.post('/admin/map/nav-graph/sync-markers', { buildingId, floor });
      const d = res.data.data;
      showToast('success', `Synced markers: ${d.created} new, ${d.updated} updated`);
      await loadEditor();
      notifyGraphChange();
    } catch (err) {
      showApiErrorToast(err, 'Sync failed');
    } finally {
      setSaving(false);
    }
  };

  const testPlaceOptions = useMemo(() => {
    if (testMarkerOptions.length) {
      return [...testMarkerOptions].sort((a, b) => {
        const an = a.legendNumber ?? 999;
        const bn = b.legendNumber ?? 999;
        if (an !== bn) return an - bn;
        return a.label.localeCompare(b.label);
      });
    }
    return (ctx?.nodes ?? [])
      .filter((n) => n.mapMarkerId)
      .map((n) => ({
        markerId: n.mapMarkerId!,
        label: n.label,
        legendNumber: null as number | null,
      }));
  }, [testMarkerOptions, ctx?.nodes]);

  const hallsOnFloor = useMemo(
    () => (ctx?.halls ?? []).filter((h) => h.floor === floor),
    [ctx?.halls, floor]
  );

  const runTestRoute = async () => {
    if (!buildingId) return;
    if (!testToMarkerId && !testToHallId) {
      showToast('info', 'Select a destination place on this floor plan');
      return;
    }
    if (testFromMarkerId && testToMarkerId && testFromMarkerId === testToMarkerId) {
      showToast('info', 'From and To must be different places');
      return;
    }
    try {
      const params: Record<string, string> = {
        buildingId,
        floor: String(floor),
      };
      if (testFromMarkerId) params.fromMarkerId = testFromMarkerId;
      if (testToMarkerId) params.toMarkerId = testToMarkerId;
      else if (testToHallId) params.toHallId = testToHallId;

      const res = await api.get('/map/nav-route', { params });
      const data = res.data.data;
      if (!data.found) {
        showToast('error', data.message || 'No path found');
        setTestPath(null);
        setTestSteps([]);
        return;
      }
      const onFloor = (data.polyline || []).filter(
        (p: { floor: number }) => p.floor === floor
      );
      setTestPath(onFloor.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })));
      const steps = (data.steps || []).map((s: string | { instruction?: string }) =>
        typeof s === 'string' ? s : s.instruction || ''
      );
      setTestSteps(steps.filter(Boolean));
      const dist =
        data.distanceMeters != null
          ? `${Math.round(data.distanceMeters)} m`
          : data.distance != null
            ? `${data.distance} units`
            : '';
      showToast('success', dist ? `Route found (${dist})` : 'Route found');
    } catch (err) {
      showApiErrorToast(err, 'Route test failed');
    }
  };

  const selected = ctx?.nodes.find((n) => n.id === selectedId);
  const floorOptions = ctx
    ? Array.from({ length: ctx.building.floors }, (_, i) => i)
    : buildings.find((b) => b.id === buildingId)
      ? Array.from({ length: buildings.find((b) => b.id === buildingId)!.floors }, (_, i) => i)
      : [0];
  const floorsWithPlans =
    buildings.find((b) => b.id === buildingId)?.floorPlans?.map((fp) => fp.floor) || [];

  const imageUrl = controlledFloorPlanImageUrl
    ? controlledFloorPlanImageUrl
    : ctx?.floorPlan?.imagePath
      ? floorPlanImageUrl(ctx.floorPlan.imagePath)
      : '';

  const nodeById = new Map(ctx?.nodes.map((n) => [n.id, n]) || []);

  return (
    <div className={embedded ? '' : 'indoor-editor-page'}>
      {!embedded && (
        <div className="admin-page-header">
          <div>
            <Link to="/admin/navigation" className="indoor-back-link">
              <ArrowLeft size={16} /> Indoor navigation
            </Link>
            <h1>Walking paths (navigation graph)</h1>
            <p>
              Place corridor junctions and stairs, connect nodes, then test A* routes to lecture
              halls.
            </p>
          </div>
        </div>
      )}

      <div ref={toolbarRef} className="indoor-toolbar scroll-mt-4">
        {pathOnlyMode && (
          <p className="mb-2 w-full text-sm text-slate-600">
            {pathWorkflowStep === 'idle' && (
              <>
                <strong>Step 1:</strong> Click <strong>Add path point</strong>, place junctions on
                the map, then confirm.
              </>
            )}
            {pathWorkflowStep === 'adding' && (
              <>
                <strong>Step 1:</strong> Place path points on the map, then click{' '}
                <strong>Confirm path points</strong>.
              </>
            )}
            {pathWorkflowStep === 'connecting' && (
              <>
                <strong>Step 2:</strong> Use <strong>Connect</strong> to join path points and places
                yourself — nothing is linked automatically.
              </>
            )}
          </p>
        )}
        {!embedded && (
          <>
            <label>
              Building
              <select
                value={buildingId}
                onChange={(e) => {
                  setBuildingId(e.target.value);
                  setFloor(0);
                }}
              >
                <option value="">Select building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Floor
              <select value={floor} onChange={(e) => setFloor(parseInt(e.target.value, 10))}>
                {floorOptions.map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                    {floorsWithPlans.includes(f) ? '' : ' — no JPG'}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          type="button"
          className={tool === 'add' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => {
            if (pathOnlyMode) setPathWorkflowStep('adding');
            setTool('add');
            cancelConnect();
            if (pathOnlyMode) scrollToFloorPlan();
          }}
        >
          <Plus size={14} /> {pathOnlyMode ? 'Add path point' : 'Add node'}
        </button>
        {pathOnlyMode && pathWorkflowStep === 'adding' && (
          <button
            type="button"
            className="btn-primary"
            onClick={confirmPathPoints}
            disabled={visiblePathNodes.length === 0}
          >
            <Check size={14} /> Confirm path points
          </button>
        )}
        <button
          type="button"
          className={tool === 'connect' ? 'btn-primary' : 'btn-secondary'}
          disabled={pathToolsLocked}
          onClick={() => {
            if (pathToolsLocked) return;
            setTool('connect');
            cancelConnect();
          }}
        >
          <Link2 size={14} /> Connect
        </button>
        <button
          type="button"
          className={tool === 'delete-line' ? 'btn-primary' : 'btn-secondary'}
          disabled={pathToolsLocked}
          onClick={() => {
            if (pathToolsLocked) return;
            setTool('delete-line');
            cancelConnect();
            setEdgePendingDelete(null);
            setSelectedEdgeId(null);
          }}
        >
          <Unlink size={14} /> Delete line
        </button>
        <button
          type="button"
          className={tool === 'select' ? 'btn-primary' : 'btn-secondary'}
          disabled={pathToolsLocked}
          onClick={() => {
            if (pathToolsLocked) return;
            setTool('select');
            cancelConnect();
          }}
        >
          <GitBranch size={14} /> {pathOnlyMode ? 'Move path point' : 'Select / drag'}
        </button>
        {tool === 'add' && !pathOnlyMode && (
          <label>
            Node type
            <select value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
              {NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
        {tool === 'add' && pathOnlyMode && (
          <label>
            Point type
            <select value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
              {PATH_POINT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'CORRIDOR' ? 'Path junction' : t}
                </option>
              ))}
            </select>
          </label>
        )}
        {!pathOnlyMode && (
          <button type="button" className="btn-secondary" onClick={syncFromMarkers} disabled={saving}>
            <RefreshCw size={14} /> Sync room markers
          </button>
        )}
        {connectFrom && (
          <button type="button" className="btn-secondary" onClick={cancelConnect}>
            Cancel line
          </button>
        )}
      </div>

      {loading && (
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading graph…</p>
        </div>
      )}

      {embedded && pathOnlyMode && !locationsLocked && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Go to <strong>Locations &amp; publish</strong>, place your red dots, then click{' '}
          <strong>Lock for Walking paths</strong> before drawing paths here.
        </p>
      )}
      {embedded && pathOnlyMode && locationsLocked && (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Using your <strong>locked</strong> floor plan and place positions from Locations &amp; publish.
        </p>
      )}

      {!loading && ctx && (
        <div className={embedded && pathOnlyMode ? 'space-y-2' : 'indoor-layout'}>
          <div className={embedded && pathOnlyMode ? '' : 'indoor-canvas-wrap'}>
            <div
              ref={floorPlanRef}
              className={`scroll-mt-4 ${
                embedded && pathOnlyMode
                  ? 'fp-map-panel'
                  : 'indoor-canvas indoor-nav-canvas'
              } ${pathOnlyMode ? 'path-only-mode' : ''} ${
                tool === 'add' ? 'add-mode' : ''
              } ${tool === 'connect' && connectFrom ? 'connect-mode' : ''} ${
                tool === 'delete-line' ? 'delete-line-mode' : ''
              }`}
            >
              <div
                ref={canvasRef}
                className="fp-map-canvas"
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={(e) => {
                  if (!draggingId) return;
                  const id = draggingId;
                  setDraggingId(null);
                  const { x, y } = clientToPercent(e.clientX, e.clientY);
                  void patchNodePosition(id, x, y);
                }}
                onMouseLeave={() => {
                  if (draggingId) setDraggingId(null);
                  if (tool === 'connect') {
                    setConnectCursor(null);
                    setSnapNodeId(null);
                  }
                }}
              >
                <img
                  ref={mapImgRef}
                  src={imageUrl}
                  alt={`${ctx.building.name} paths`}
                  draggable={false}
                  onLoad={(e) =>
                    setFloorPlanCanvasAspect(canvasRef.current, e.currentTarget)
                  }
                />
                <svg
                  className={`fp-map-overlay indoor-nav-edges ${
                    tool === 'delete-line' ? 'interactive-edges edges-clickable' : ''
                  }`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                {ctx.edges.map((edge) => {
                  if (
                    pathOnlyMode &&
                    !isEdgeVisibleInPathEditor(edge, placeNavNodeIds, pathNodeIds)
                  ) {
                    return null;
                  }
                  const from = displayPos(edge.fromNodeId);
                  const to = displayPos(edge.toNodeId);
                  if (!from || !to) return null;
                  const selected = selectedEdgeId === edge.id;
                  return (
                    <g key={edge.id} className="nav-edge-group">
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        className="nav-edge-hit"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (tool !== 'delete-line') return;
                          setSelectedEdgeId(edge.id);
                          setEdgePendingDelete(edge);
                        }}
                      />
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        className={`nav-edge ${selected ? 'nav-edge-selected' : ''}`}
                      />
                    </g>
                  );
                })}
                {tool === 'connect' && connectFrom && connectCursor && displayPos(connectFrom) && (
                  <line
                    x1={displayPos(connectFrom)!.x}
                    y1={displayPos(connectFrom)!.y}
                    x2={connectCursor.x}
                    y2={connectCursor.y}
                    className="nav-edge-preview"
                  />
                )}
                {testPath && testPath.length > 1 && (
                  <polyline
                    className="nav-edge-test"
                    fill="none"
                    points={testPath.map((p) => `${p.x},${p.y}`).join(' ')}
                  />
                )}
              </svg>
              {pathOnlyMode &&
                placeMarkers.map((p) => (
                  <button
                    key={p.markerId}
                    type="button"
                    className={`nav-place-dot ${
                      selectedId === p.navNodeId || connectFrom === p.navNodeId ? 'selected' : ''
                    } ${snapNodeId === p.navNodeId ? 'snap-target' : ''}`}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    title={`${p.legendNumber != null ? `#${p.legendNumber} — ` : ''}${p.label} (fixed in Locations tab)`}
                    onClick={(e) => void handlePlaceClick(p, e)}
                  />
                ))}
              {(pathOnlyMode ? visiblePathNodes : ctx.nodes).map((n) => {
                const isSnap = snapNodeId === n.id;
                const pinColor = NODE_COLORS[n.type] || '#64748b';
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`indoor-nav-pin indoor-marker-pin nav-path-pin ${
                      pathOnlyMode && !isManualPathPoint(n) ? 'nav-path-pin-auto' : ''
                    } ${selectedId === n.id || connectFrom === n.id ? 'selected' : ''} ${
                      isSnap ? 'snap-target' : ''
                    }`}
                    style={{
                      left: `${n.x}%`,
                      top: `${n.y}%`,
                      backgroundColor: pinColor,
                    }}
                    title={`${n.type}: ${n.label}`}
                    onClick={(e) => void handleNodeClick(n, e)}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (tool !== 'select') return;
                      setDraggingId(n.id);
                      setSelectedId(n.id);
                    }}
                  >
                    <span className="pin-label">{n.label}</span>
                  </button>
                );
              })}
              </div>
            </div>
            <p className="fp-hint">
              {pathOnlyMode && (
                <span className="block text-slate-500">
                  Small red dots = locked places from Locations &amp; publish. Coloured dots =
                  walkway junctions (lighter = auto-built, you can still connect to them).
                </span>
              )}
              {tool === 'idle' &&
                pathOnlyMode &&
                'Step 1: Click Add path point above, then click the corridor to place junctions.'}
              {tool === 'add' &&
                (pathOnlyMode
                  ? `Click the corridor to add path junctions (${visiblePathNodes.length} placed). When done, click Confirm path points above.`
                  : 'Click the map to add corridor junctions, stairs, or entrances.')}
              {pathOnlyMode && pathWorkflowStep === 'adding' && tool === 'add' && (
                <button
                  type="button"
                  className="btn-primary mt-2"
                  onClick={confirmPathPoints}
                  disabled={visiblePathNodes.length === 0}
                >
                  <Check size={14} /> Confirm path points
                </button>
              )}
              {tool === 'connect' &&
                (connectFrom
                  ? 'Move toward the next point — line snaps when close — then click to join.'
                  : 'Click a place or path point, then connect to the next point along the walkway.')}
              {tool === 'delete-line' && 'Click a path line, then confirm delete in the popup.'}
              {tool === 'select' &&
                (pathOnlyMode
                  ? 'Drag grey path points only. Places stay fixed.'
                  : 'Drag nodes to adjust positions.')}
            </p>
          </div>

          <aside className="indoor-sidebar">
            <div className="indoor-form-panel">
              <h3>Graph on this floor</h3>
              <p className="text-sm text-slate-600">
                {pathOnlyMode
                  ? `${placeMarkers.length} places (from Locations) · ${visiblePathNodes.length} path points · ${ctx.edges.filter((e) => isEdgeVisibleInPathEditor(e, placeNavNodeIds, pathNodeIds)).length} lines`
                  : `${ctx.stats.nodeCount} nodes · ${ctx.stats.edgeCount} edges · ${ctx.stats.entranceCount} entrance(s)`}
              </p>
              {ctx.stats.entranceCount === 0 && (
                <p className="text-sm text-amber-700">
                  Add at least one ENTRANCE node (or sync markers with an entrance).
                </p>
              )}
            </div>

            {selected && (
              <div className="indoor-form-panel">
                <h3>{selected.label}</h3>
                <p className="text-sm text-slate-600">{selected.type}</p>
                <button
                  type="button"
                  className="btn-secondary mb-2 w-full"
                  onClick={async () => {
                    try {
                      const qr = await createQrCode({
                        buildingId,
                        navNodeId: selected.id,
                        label: selected.label,
                      });
                      showToast('success', `QR created: ${qr.code}`);
                      void fetchQrCodes();
                    } catch (err) {
                      showApiErrorToast(err, 'Failed to create QR code');
                    }
                  }}
                >
                  <QrCode size={14} /> Generate QR for this node
                </button>
                {!(pathOnlyMode && isPlaceNode(selected)) && (
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    onClick={deleteSelected}
                    disabled={saving}
                  >
                    <Trash2 size={14} /> Delete node
                  </button>
                )}
                {pathOnlyMode && isPlaceNode(selected) && (
                  <p className="text-xs text-slate-500">
                    This is a fixed place from Locations &amp; publish — not movable here.
                  </p>
                )}
                <ul className="indoor-edge-list">
                  {ctx.edges
                    .filter((e) => e.fromNodeId === selected.id || e.toNodeId === selected.id)
                    .map((e) => {
                      const other =
                        e.fromNodeId === selected.id
                          ? nodeById.get(e.toNodeId)
                          : nodeById.get(e.fromNodeId);
                      return (
                        <li key={e.id}>
                          <span>
                            → {other?.label}
                            {other && other.floor !== floor ? ` (fl.${other.floor})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEdgeId(e.id);
                              setEdgePendingDelete(e);
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            <div className="indoor-form-panel">
              <h3>
                <QrCode size={16} className="inline" /> QR codes (floor {floor})
              </h3>
              {qrCodes.filter((q) => q.navNode.floor === floor).length === 0 ? (
                <p className="text-sm text-slate-500">Select a node and generate a QR code for positioning.</p>
              ) : (
                <ul className="indoor-edge-list">
                  {qrCodes
                    .filter((q) => q.navNode.floor === floor)
                    .map((q) => (
                      <li key={q.id}>
                        <span>
                          <strong>{q.navNode.label}</strong>
                          <br />
                          <code className="text-xs">{q.code}</code>
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteQrCode(q.id);
                            void fetchQrCodes();
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="indoor-form-panel">
              <h3>
                <Route size={16} className="inline" /> Test route (A*)
              </h3>
              <p className="mb-2 text-xs text-slate-500">
                Uses the numbered places from your locked floor plan. Leave From empty to start at the
                default entrance.
              </p>
              <label>
                From (start)
                <select
                  value={testFromMarkerId}
                  onChange={(e) => setTestFromMarkerId(e.target.value)}
                >
                  <option value="">— Default entrance —</option>
                  {testPlaceOptions.map((p) => (
                    <option key={`from-${p.markerId}`} value={p.markerId}>
                      {p.legendNumber != null ? `${p.legendNumber}. ${p.label}` : p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2">
                To (destination)
                <select
                  value={testToMarkerId || (testToHallId ? `hall:${testToHallId}` : '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith('hall:')) {
                      setTestToHallId(v.slice(5));
                      setTestToMarkerId('');
                    } else {
                      setTestToMarkerId(v);
                      setTestToHallId('');
                    }
                  }}
                >
                  <option value="">— Select place —</option>
                  {testPlaceOptions.length > 0 && (
                    <optgroup label="Floor plan places">
                      {testPlaceOptions.map((p) => (
                        <option key={`to-${p.markerId}`} value={p.markerId}>
                          {p.legendNumber != null ? `${p.legendNumber}. ${p.label}` : p.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {hallsOnFloor.length > 0 && (
                    <optgroup label="Linked lecture halls">
                      {hallsOnFloor.map((h) => (
                        <option key={`hall-${h.id}`} value={`hall:${h.id}`}>
                          {h.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {testPlaceOptions.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No floor plan places loaded — lock locations on Locations &amp; publish first.
                </p>
              )}
              <button
                type="button"
                className="btn-primary mt-3 w-full"
                onClick={() => void runTestRoute()}
                disabled={!testToMarkerId && !testToHallId}
              >
                Preview path on this floor
              </button>
              {testSteps.length > 0 && (
                <ol className="nav-test-steps">
                  {testSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
            </div>

            {ctx.markersWithoutNode.length > 0 && (
              <div className="indoor-checklist">
                <h4>Room markers not in graph</h4>
                <p className="text-sm text-slate-600">
                  Use &quot;Sync room markers&quot; to add ROOM nodes from Phase 6.5 pins.
                </p>
                <ul>
                  {ctx.markersWithoutNode.slice(0, 12).map((m) => (
                    <li key={m.id}>{m.label}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-slate-500">
              <Link to={`/admin/indoor-markers?buildingId=${buildingId}&floor=${floor}`}>
                Room map editor
              </Link>{' '}
              for hall pins · Stairs on floor N should connect to matching stairs on floor N±1.
            </p>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={!!edgePendingDelete}
        title="Delete path segment?"
        message={
          edgePendingDelete
            ? `Remove the walking path between "${edgePendingDelete.from.label}" and "${edgePendingDelete.to.label}"?`
            : ''
        }
        confirmLabel="Delete"
        loading={deletingEdge}
        onCancel={() => {
          setEdgePendingDelete(null);
          setSelectedEdgeId(null);
        }}
        onConfirm={() => void confirmDeleteEdge()}
      />
    </div>
  );
}

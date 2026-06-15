import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import api from '@services/api';
import FloorPlanRouteMap from '@components/FloorPlanRouteMap';
import { floorPlanImageUrl } from '@utils/floorPlanImageUrl';
import type { NavGraphEdgeLite, NavGraphNodeLite } from '@utils/navGraphDisplay';

export type LinkPreviewNode = {
  nodeId: string;
  label: string;
  x: number;
  y: number;
};

export type BuildingLinkPreviewTarget = {
  floor: number;
  localBuildingId: string;
  localBuildingCode: string;
  remoteBuildingId: string;
  remoteBuildingCode: string;
  localNode: LinkPreviewNode | null;
  remoteNode: LinkPreviewNode | null;
  paired: boolean;
};

type Props = {
  target: BuildingLinkPreviewTarget | null;
  onClose: () => void;
  onEditFloor?: (buildingId: string, floor: number) => void;
};

function floorTitle(floor: number): string {
  return floor === 0 ? 'Ground floor' : `Floor ${floor}`;
}

function BuildingLinkMapPanel({
  buildingId,
  buildingCode,
  floor,
  connectionNode,
  sideLabel,
}: {
  buildingId: string;
  buildingCode: string;
  floor: number;
  connectionNode: LinkPreviewNode | null;
  sideLabel: string;
}) {
  const [nodes, setNodes] = useState<NavGraphNodeLite[]>([]);
  const [edges, setEdges] = useState<NavGraphEdgeLite[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [graphRes, buildingsRes] = await Promise.all([
          api.get('/map/nav-graph', { params: { buildingId, floor } }),
          api.get('/map/buildings'),
        ]);
        if (cancelled) return;
        const graph = graphRes.data.data;
        setNodes(graph?.nodes ?? []);
        setEdges(graph?.edges ?? []);
        const b = (buildingsRes.data.data || []).find((x: { id: string }) => x.id === buildingId);
        const fp = b?.floorPlans?.find((p: { floor: number }) => p.floor === floor);
        setImagePath(fp?.imagePath ?? null);
      } catch {
        if (!cancelled) {
          setNodes([]);
          setEdges([]);
          setImagePath(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, floor]);

  const nodeFromGraph = useMemo(() => {
    if (!connectionNode) return null;
    const n = nodes.find((x) => x.id === connectionNode.nodeId);
    if (n) return { x: n.x, y: n.y, label: n.label };
    return { x: connectionNode.x, y: connectionNode.y, label: connectionNode.label };
  }, [connectionNode, nodes]);

  if (loading) {
    return (
      <div className="building-link-map-panel rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Loading {buildingCode} {floorTitle(floor)}…
      </div>
    );
  }

  if (!imagePath) {
    return (
      <div className="building-link-map-panel rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No floor plan for {buildingCode} · {floorTitle(floor)}. Upload it under Floor plan tab.
      </div>
    );
  }

  if (!nodeFromGraph) {
    return (
      <div className="building-link-map-panel rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No doorway node on {buildingCode} · {floorTitle(floor)}. Add a path point or entrance in
        Walking paths.
      </div>
    );
  }

  return (
    <div className="building-link-map-panel">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{sideLabel}</p>
      <p className="mb-2 text-sm font-medium text-slate-800">
        {buildingCode} · {floorTitle(floor)}
      </p>
      <FloorPlanRouteMap
        imageUrl={floorPlanImageUrl(imagePath)}
        imageAlt={`${buildingCode} ${floorTitle(floor)}`}
        nodes={nodes}
        edges={edges}
        routePath={[]}
        routeStart={{
          x: nodeFromGraph.x,
          y: nodeFromGraph.y,
          label: nodeFromGraph.label,
        }}
      >
        <span
          className="building-link-highlight-ring"
          style={{ left: `${nodeFromGraph.x}%`, top: `${nodeFromGraph.y}%` }}
          aria-hidden
        />
      </FloorPlanRouteMap>
      <p className="mt-2 text-xs text-slate-600">
        <span className="building-link-dot-legend" aria-hidden /> Doorway node:{' '}
        <strong>{nodeFromGraph.label}</strong>
      </p>
    </div>
  );
}

export default function BuildingLinkPreviewModal({ target, onClose, onEditFloor }: Props) {
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [target, onClose]);

  if (!target) return null;

  const canPreview = target.localNode || target.remoteNode;

  return createPortal(
    <div className="building-link-preview-backdrop" role="dialog" aria-modal="true">
      <div className="building-link-preview-modal">
        <div className="building-link-preview-header">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Building link · {floorTitle(target.floor)}
            </h3>
            <p className="text-sm text-slate-600">
              {target.localBuildingCode} ↔ {target.remoteBuildingCode}
              {target.paired ? ' · linked' : ' · preview before linking'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {!canPreview ? (
          <p className="p-4 text-sm text-amber-800">
            No nodes to show. Place doorway markers and connect them to corridors on this floor in
            Walking paths.
          </p>
        ) : (
          <div className="building-link-preview-maps">
            <BuildingLinkMapPanel
              buildingId={target.localBuildingId}
              buildingCode={target.localBuildingCode}
              floor={target.floor}
              connectionNode={target.localNode}
              sideLabel="This building"
            />
            <div className="building-link-preview-bridge" aria-hidden>
              <span className="building-link-preview-bridge-line" />
              <span className="building-link-preview-bridge-label">same floor</span>
              <span className="building-link-preview-bridge-line" />
            </div>
            <BuildingLinkMapPanel
              buildingId={target.remoteBuildingId}
              buildingCode={target.remoteBuildingCode}
              floor={target.floor}
              connectionNode={target.remoteNode}
              sideLabel="Neighbor building"
            />
          </div>
        )}

        <div className="building-link-preview-footer">
          <p className="text-xs text-slate-500">
            Blue <strong>A</strong> marks the doorway node used for this link. If it looks wrong,
            open Walking paths and move the node or pick a better doorway.
          </p>
          <div className="flex flex-wrap gap-2">
            {onEditFloor && target.localNode && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => {
                  onEditFloor(target.localBuildingId, target.floor);
                  onClose();
                }}
              >
                <ExternalLink size={14} />
                Edit {target.localBuildingCode} · {floorTitle(target.floor)}
              </button>
            )}
            {onEditFloor && target.remoteNode && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => {
                  onEditFloor(target.remoteBuildingId, target.floor);
                  onClose();
                }}
              >
                <ExternalLink size={14} />
                Edit {target.remoteBuildingCode} · {floorTitle(target.floor)}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

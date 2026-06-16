import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [lockedPlaces, setLockedPlaces] = useState<
    Map<string, { x: number; y: number; label: string }>
  >(new Map());
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const [graphRes, locRes] = await Promise.all([
          api.get('/admin/map/nav-graph/editor', { params: { buildingId, floor } }),
          api.get(`/admin/buildings/${buildingId}/floorplan/${floor}/locations`),
        ]);
        if (cancelled) return;
        const data = graphRes.data.data;
        const locData = locRes.data.data;
        setNodes(
          (data?.nodes ?? []).map(
            (n: {
              id: string;
              x: number;
              y: number;
              label: string;
              type: string;
              mapMarkerId?: string | null;
            }) => ({
              id: n.id,
              x: n.x,
              y: n.y,
              label: n.label,
              type: n.type,
              mapMarkerId: n.mapMarkerId ?? null,
            })
          )
        );
        setEdges(
          (data?.edges ?? []).map((e: { id: string; fromNodeId: string; toNodeId: string }) => ({
            id: e.id,
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
          }))
        );
        const fp = data?.floorPlan;
        setImagePath((fp?.lockedImagePath || fp?.imagePath) ?? null);

        const snap = locData?.floorPlan?.lockedMarkerSnapshot as
          | Array<{ id: string; label: string; x: number; y: number }>
          | null
          | undefined;
        const places = new Map<string, { x: number; y: number; label: string }>();
        if (locData?.floorPlan?.locationsLockedAt && Array.isArray(snap)) {
          for (const m of snap) {
            places.set(m.id, { x: m.x, y: m.y, label: m.label });
          }
        }
        setLockedPlaces(places);
      } catch {
        if (!cancelled) {
          setNodes([]);
          setEdges([]);
          setLockedPlaces(new Map());
          setImagePath(null);
          setLoadError('Could not load floor plan data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildingId, floor]);

  const pin = useMemo(() => {
    if (!connectionNode) return null;
    const n = nodes.find((x) => x.id === connectionNode.nodeId);
    if (n?.mapMarkerId) {
      const locked = lockedPlaces.get(n.mapMarkerId);
      if (locked) return { x: locked.x, y: locked.y, label: locked.label };
    }
    if (n) return { x: n.x, y: n.y, label: n.label };
    if (Number.isFinite(connectionNode.x) && Number.isFinite(connectionNode.y)) {
      return { x: connectionNode.x, y: connectionNode.y, label: connectionNode.label };
    }
    return null;
  }, [connectionNode, nodes, lockedPlaces]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Loading {buildingCode} · {floorTitle(floor)}…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {loadError}
      </div>
    );
  }

  if (!imagePath) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No floor plan for {buildingCode} · {floorTitle(floor)}. Upload it under the Floor plan tab.
      </div>
    );
  }

  if (!pin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Place <strong>{connectionNode?.label ?? 'this location'}</strong> on {buildingCode} ·{' '}
        {floorTitle(floor)} in Locations &amp; publish, then sync walking paths.
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
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
        routeStart={{ x: pin.x, y: pin.y, label: pin.label }}
      />
      <p className="mt-2 text-xs text-slate-600">
        Linked place: <strong>{pin.label}</strong>
      </p>
    </div>
  );
}

export default function BuildingLinkPreviewModal({ target, onClose, onEditFloor }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="building-link-preview-title"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 id="building-link-preview-title" className="text-lg font-semibold text-slate-900">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!canPreview ? (
            <p className="text-sm text-amber-800">
              No places to show. Select doorway or entrance markers on this floor first.
            </p>
          ) : (
            <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
              <BuildingLinkMapPanel
                buildingId={target.localBuildingId}
                buildingCode={target.localBuildingCode}
                floor={target.floor}
                connectionNode={target.localNode}
                sideLabel="This building"
              />
              <div
                className="flex shrink-0 flex-row items-center justify-center gap-2 px-2 lg:flex-col lg:py-16"
                aria-hidden
              >
                <span className="hidden h-px w-8 bg-slate-300 lg:block lg:h-12 lg:w-px" />
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  same floor
                </span>
                <span className="hidden h-px w-8 bg-slate-300 lg:block lg:h-12 lg:w-px" />
              </div>
              <BuildingLinkMapPanel
                buildingId={target.remoteBuildingId}
                buildingCode={target.remoteBuildingCode}
                floor={target.floor}
                connectionNode={target.remoteNode}
                sideLabel="Connected building"
              />
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs text-slate-500">
            Pin <strong>A</strong> marks the linked place on each floor plan. To adjust, open
            Locations &amp; publish or Walking paths for that building.
          </p>
          <div className="flex flex-wrap gap-2">
            {onEditFloor && target.localNode && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
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
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
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

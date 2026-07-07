import { useCallback, useEffect, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import IndoorNavGraphEditor from '@pages/admin/IndoorNavGraphEditor';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Lightbulb,
  Network,
  RefreshCw,
} from 'lucide-react';

interface GraphValidation {
  healthy: boolean;
  nodeCount: number;
  edgeCount: number;
  entranceCount: number;
  stairsCount: number;
  liftCount: number;
  placeNodeCount?: number;
  pathPointCount?: number;
  isConnected: boolean;
  componentCount?: number;
  issues: string[];
  warnings?: string[];
  suggestions?: string[];
  orphanNodes: Array<{ id: string; label: string; type: string }>;
  disconnectedDetails?: Array<{ id: string; label: string; type: string; kind: 'place' | 'path' }>;
  markersWithoutNode?: Array<{ id: string; label: string }>;
}

interface Props {
  buildingId: string;
  floor: number;
  hasFloorPlan: boolean;
  floorPlanImageUrl?: string;
  locationsLocked?: boolean;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

export default function FloorNavGraphTab({
  buildingId,
  floor,
  hasFloorPlan,
  floorPlanImageUrl,
  locationsLocked = false,
}: Props) {
  const [validation, setValidation] = useState<GraphValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [building, setBuilding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const loadValidation = useCallback(async () => {
    if (!buildingId || !hasFloorPlan) {
      setValidation(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/admin/buildings/${buildingId}/floorplan/${floor}/nav-graph/validate`);
      setValidation(res.data.data);
    } catch (err) {
      setValidation(null);
      showApiErrorToast(err, 'Could not validate walking paths');
    } finally {
      setLoading(false);
    }
  }, [buildingId, floor, hasFloorPlan]);

  useEffect(() => {
    void loadValidation();
  }, [loadValidation]);

  const checkThisFloor = async () => {
    setChecking(true);
    try {
      const res = await api.get(`/admin/buildings/${buildingId}/floorplan/${floor}/nav-graph/validate`);
      const v = res.data.data as GraphValidation;
      setValidation(v);
      setLastCheckedAt(new Date());
      if (v.healthy) {
        showToast('success', `${floorLabel(floor)}: all places and path points are connected`);
      } else {
        const disconnected = v.disconnectedDetails?.length ?? v.orphanNodes.length;
        showToast(
          'info',
          `${floorLabel(floor)}: ${disconnected} disconnected node(s) - see list below`
        );
      }
    } catch (err) {
      showApiErrorToast(err, 'Connection check failed');
    } finally {
      setChecking(false);
    }
  };

  const clearAutoPoints = async () => {
    setClearing(true);
    try {
      const res = await api.post(
        `/admin/buildings/${buildingId}/floorplan/${floor}/nav-graph/clear-auto`
      );
      const v = res.data.data?.validation as GraphValidation;
      setValidation(v);
      const removedPoints = res.data.data?.removedPoints ?? res.data.data?.removed ?? 0;
      const removedEdges = res.data.data?.removedMarkerEdges ?? 0;
      showToast(
        'success',
        removedPoints > 0 || removedEdges > 0
          ? `Cleared ${removedPoints} auto point(s) and ${removedEdges} auto place link(s)`
          : 'No auto paths to remove'
      );
      setEditorKey((k) => k + 1);
    } catch (err) {
      showApiErrorToast(err, 'Could not clear auto points');
    } finally {
      setClearing(false);
    }
  };

  const restoreBackup = async () => {
    setRestoring(true);
    try {
      const res = await api.post(
        `/admin/buildings/${buildingId}/floorplan/${floor}/nav-graph/restore`
      );
      const v = res.data.data?.validation as GraphValidation;
      const r = res.data.data?.restored as { pathNodes?: number; edgesRestored?: number };
      setValidation(v);
      showToast(
        'success',
        `Restored ${r?.pathNodes ?? 0} path point(s) and ${r?.edgesRestored ?? 0} line(s) from backup`
      );
      setEditorKey((k) => k + 1);
    } catch (err) {
      showApiErrorToast(err, 'No backup to restore on this floor');
    } finally {
      setRestoring(false);
    }
  };

  const rebuildGraph = async () => {
    setBuilding(true);
    try {
      const res = await api.post(`/admin/buildings/${buildingId}/floorplan/${floor}/nav-graph/build`);
      const v = res.data.data?.validation as GraphValidation;
      setValidation(v);
      if (v?.healthy) {
        showToast('success', 'Auto paths generated - review on the map below');
      } else {
        const detail = v?.issues?.[0] || 'See the yellow box below';
        showToast('info', `Auto build done. Fix needed: ${detail}`);
      }
      setEditorKey((k) => k + 1);
    } catch (err) {
      showApiErrorToast(err, 'Auto build failed');
    } finally {
      setBuilding(false);
    }
  };

  const disconnected =
    validation?.disconnectedDetails ??
    validation?.orphanNodes.map((n) => ({
      ...n,
      kind: 'path' as const,
    })) ??
    [];

  if (!hasFloorPlan) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        Upload a floor plan first, then draw walking paths manually on the map below.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* TEMP: per-floor connection check - remove when all floors done */}
      <div className="rounded-xl border-2 border-[var(--color-primary)]/30 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <Network size={18} className="text-[var(--color-primary)]" />
              Check this floor - connections
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Validates <strong>{floorLabel(floor)}</strong> only - every place (red dot) and path
              point must be linked to the walkway graph.
            </p>
          </div>
          <button
            type="button"
            disabled={checking || loading}
            onClick={() => void checkThisFloor()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Network size={16} />
            {checking ? 'Checking…' : 'Check all nodes connected'}
          </button>
        </div>

        {loading && !validation ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : validation ? (
          <div className="space-y-3 text-sm">
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                validation.healthy
                  ? 'bg-emerald-50 text-emerald-900'
                  : 'bg-amber-50 text-amber-900'
              }`}
            >
              {validation.healthy ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {validation.healthy
                    ? 'All connected - this floor is ready for routing'
                    : 'Not fully connected yet'}
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  {validation.placeNodeCount ?? '-'} places · {validation.pathPointCount ?? '-'} path
                  points · {validation.edgeCount} lines · {validation.entranceCount} entrance(s)
                  {validation.isConnected ? ' · one network' : ` · ${validation.componentCount ?? '?'} separate section(s)`}
                </p>
                {lastCheckedAt && (
                  <p className="mt-1 text-xs opacity-75">
                    Last checked {lastCheckedAt.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {disconnected.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/40 px-3 py-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">
                  Disconnected ({disconnected.length}) - connect these
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-slate-700">
                  {disconnected.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
                          d.kind === 'place'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.kind === 'place' ? 'Place' : 'Path'}
                      </span>
                      <span>
                        {d.label}
                        <span className="text-slate-400"> ({d.type})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validation.issues.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Fix these
                </p>
                <ul className="list-inside list-disc text-slate-700">
                  {validation.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* TEMP: navigation suggestions - remove when all floors done */}
      {validation && (validation.suggestions?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-900">
            <Lightbulb size={16} />
            Comments &amp; suggestions (this floor)
          </h2>
          <p className="mb-3 text-xs text-violet-800/80">
            Optional extras for more efficient navigation - path points, places, or links you could
            add. Temporary helper; remove after setup is complete.
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            {validation.suggestions!.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-violet-500">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <GitBranch size={18} /> Graph tools
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadValidation()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              type="button"
              disabled={restoring}
              onClick={() => void restoreBackup()}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {restoring ? 'Restoring…' : 'Restore backup'}
            </button>
            <button
              type="button"
              disabled={clearing}
              onClick={() => void clearAutoPoints()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear auto paths'}
            </button>
            <button
              type="button"
              disabled={building}
              onClick={() => void rebuildGraph()}
              title="Optional shortcut only - blocked when manual paths exist."
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {building ? 'Building…' : 'Auto-build (optional shortcut)'}
            </button>
          </div>
        </div>

        {(validation?.warnings?.length ?? 0) > 0 && (
          <ul className="list-inside list-disc text-sm text-slate-500">
            {validation!.warnings!.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      {!locationsLocked && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Lock required:</strong> Open <strong>Locations &amp; publish</strong>, position your
          red dots, then click <strong>Lock for Walking paths</strong>. Until then this tab cannot use
          your exact map.
        </p>
      )}
      {locationsLocked && (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <strong>Locked map active:</strong> Places are fixed from when you clicked Lock. Draw paths
          manually only - add <strong>path points</strong>, then <strong>Connect</strong> them to each
          other and to places.
        </p>
      )}

      <IndoorNavGraphEditor
        key={editorKey}
        embedded
        buildingId={buildingId}
        floor={floor}
        floorPlanImageUrl={floorPlanImageUrl}
        onGraphChange={loadValidation}
      />
    </div>
  );
}

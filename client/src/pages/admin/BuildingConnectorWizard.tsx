import { useCallback, useEffect, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import BuildingLinkPreviewModal, {
  type BuildingLinkPreviewTarget,
} from '@components/BuildingLinkPreviewModal';
import { ArrowLeftRight, Eye, Link2, RefreshCw, Sparkles, Trash2, Unlink } from 'lucide-react';

interface FloorLinkRow {
  floor: number;
  allowed: boolean;
  localNode: { nodeId: string; label: string; x: number; y: number } | null;
  remoteNode: { nodeId: string; label: string; buildingCode: string; x: number; y: number } | null;
  edgeId: string | null;
  paired: boolean;
}

interface NeighborLinks {
  neighborCode: string;
  neighborName: string;
  neighborBuildingId: string;
  floors: FloorLinkRow[];
  pairedCount: number;
  expectedCount: number;
}

interface Suggestion {
  floor: number;
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  neighborCode: string;
  reason: string;
}

interface Props {
  buildingId: string;
  currentFloor?: number;
  onEditOnFloor?: (buildingId: string, floor: number) => void;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'G' : `F${floor}`;
}

export default function BuildingConnectorWizard({
  buildingId,
  currentFloor,
  onEditOnFloor,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [autoPairing, setAutoPairing] = useState(false);
  const [buildingCode, setBuildingCode] = useState('');
  const [neighbors, setNeighbors] = useState<NeighborLinks[]>([]);
  const [totalPaired, setTotalPaired] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [preview, setPreview] = useState<BuildingLinkPreviewTarget | null>(null);

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const [statusRes, sugRes] = await Promise.all([
        api.get(`/admin/buildings/${buildingId}/building-connectors`),
        api.get(`/admin/buildings/${buildingId}/building-connectors/suggestions`),
      ]);
      const data = statusRes.data.data;
      setBuildingCode(data.building?.code ?? '');
      setNeighbors(data.neighbors ?? []);
      setTotalPaired(data.totalPaired ?? 0);
      setTotalExpected(data.totalExpected ?? 0);
      setSuggestions(sugRes.data.data ?? []);
    } catch (err) {
      showApiErrorToast(err, 'Could not load building links');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPreview = (
    neighbor: NeighborLinks,
    row: FloorLinkRow
  ) => {
    if (!row.allowed) return;
    setPreview({
      floor: row.floor,
      localBuildingId: buildingId,
      localBuildingCode: buildingCode,
      remoteBuildingId: neighbor.neighborBuildingId,
      remoteBuildingCode: neighbor.neighborCode,
      localNode: row.localNode
        ? {
            nodeId: row.localNode.nodeId,
            label: row.localNode.label,
            x: row.localNode.x,
            y: row.localNode.y,
          }
        : null,
      remoteNode: row.remoteNode
        ? {
            nodeId: row.remoteNode.nodeId,
            label: row.remoteNode.label,
            x: row.remoteNode.x,
            y: row.remoteNode.y,
          }
        : null,
      paired: row.paired,
    });
  };

  const pairFloor = async (fromNodeId: string, toNodeId: string, label: string) => {
    setPairing(true);
    try {
      await api.post(`/admin/buildings/${buildingId}/building-connectors/pair`, {
        fromNodeId,
        toNodeId,
      });
      showToast('success', `Linked ${label}`);
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Could not create link');
    } finally {
      setPairing(false);
    }
  };

  const removeEdge = async (edgeId: string) => {
    setPairing(true);
    try {
      await api.delete(`/admin/buildings/${buildingId}/building-connectors/${edgeId}`);
      showToast('success', 'Building link removed');
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Could not remove link');
    } finally {
      setPairing(false);
    }
  };

  const runAutoPair = async () => {
    setAutoPairing(true);
    try {
      const res = await api.post(`/admin/buildings/${buildingId}/building-connectors/auto-pair`, {});
      const paired = res.data.data?.paired ?? 0;
      showToast(
        'success',
        paired > 0 ? `Auto-linked ${paired} same-floor connection(s)` : 'No new links to create'
      );
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Auto-pair failed');
    } finally {
      setAutoPairing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading horizontal links…</p>;
  }

  const floorFilterNote =
    currentFloor !== undefined
      ? ` Showing links for ${floorLabel(currentFloor)} — switch floor above to link other levels.`
      : '';

  return (
    <div className="space-y-6">
      <BuildingLinkPreviewModal
        target={preview}
        onClose={() => setPreview(null)}
        onEditFloor={onEditOnFloor}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <ArrowLeftRight size={18} className="text-[var(--color-primary)]" />
              Horizontal links (same-floor buildings)
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              <strong>{buildingCode}</strong> connects to neighboring buildings on matching floors.
              Link Academic ↔ Administration on every shared floor; Administration ↔ Laboratory on
              floors 0–9 only. Laboratory floors 10–11 connect to Academic only (Administration has
              no matching floors).{floorFilterNote}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              disabled={autoPairing || suggestions.length === 0}
              onClick={() => void runAutoPair()}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <Sparkles size={14} />
              {autoPairing ? 'Linking…' : `Auto-link (${suggestions.length})`}
            </button>
          </div>
        </div>

        <p className="text-sm font-medium text-slate-700">
          {totalPaired}/{totalExpected} floor links paired
        </p>
      </div>

      {neighbors.map((neighbor) => {
        const visibleFloors =
          currentFloor !== undefined
            ? neighbor.floors.filter((row) => row.floor === currentFloor)
            : neighbor.floors;
        if (currentFloor !== undefined && visibleFloors.length === 0) return null;

        return (
        <div
          key={neighbor.neighborCode}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h4 className="font-medium text-slate-900">
              {buildingCode} ↔ {neighbor.neighborCode}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({neighbor.neighborName}) · {neighbor.pairedCount}/{neighbor.expectedCount} linked
              </span>
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Floor</th>
                  <th className="px-4 py-2">This building</th>
                  <th className="px-4 py-2">{neighbor.neighborCode}</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleFloors.map((row) => (
                  <tr
                    key={row.floor}
                    className={`border-b border-slate-50 ${!row.allowed ? 'bg-slate-50/80 text-slate-400' : ''} ${
                      currentFloor === row.floor ? 'bg-[var(--color-primary)]/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{floorLabel(row.floor)}</td>
                    <td className="px-4 py-2">
                      {row.allowed
                        ? row.localNode?.label ?? '— no doorway node'
                        : 'Not linked on this floor'}
                    </td>
                    <td className="px-4 py-2">
                      {row.allowed ? row.remoteNode?.label ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {!row.allowed ? (
                        <span className="text-xs">N/A</span>
                      ) : row.paired ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <Link2 size={14} /> Linked
                        </span>
                      ) : row.localNode && row.remoteNode ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Unlink size={14} /> Ready to link
                        </span>
                      ) : (
                        <span className="text-amber-700">Place markers + paths</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {row.allowed && (row.localNode || row.remoteNode) && (
                          <button
                            type="button"
                            onClick={() => openPreview(neighbor, row)}
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-[var(--color-primary)]"
                          >
                            <Eye size={14} /> View on map
                          </button>
                        )}
                        {row.paired && row.edgeId ? (
                          <button
                            type="button"
                            disabled={pairing}
                            onClick={() => void removeEdge(row.edgeId!)}
                            className="inline-flex items-center gap-1 text-red-600 hover:underline"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        ) : row.allowed && row.localNode && row.remoteNode ? (
                          <button
                            type="button"
                            disabled={pairing}
                            onClick={() =>
                              void pairFloor(
                                row.localNode!.nodeId,
                                row.remoteNode!.nodeId,
                                `${row.localNode!.label} ↔ ${row.remoteNode!.label}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                          >
                            <Link2 size={14} /> Link
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}

      {(() => {
        const floorSuggestions = suggestions.filter(
          (s) => currentFloor === undefined || s.floor === currentFloor
        );
        if (floorSuggestions.length === 0) return null;
        return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Suggested links</p>
          <ul className="space-y-2 text-sm">
            {floorSuggestions.slice(0, 12).map((s) => (
              <li key={`${s.floor}-${s.fromNodeId}-${s.toNodeId}`} className="flex flex-wrap gap-2">
                <span>
                  {floorLabel(s.floor)} → {s.neighborCode}: {s.fromLabel} ↔ {s.toLabel}
                </span>
                <button
                  type="button"
                  disabled={pairing}
                  onClick={() => void pairFloor(s.fromNodeId, s.toNodeId, s.fromLabel)}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Link
                </button>
              </li>
            ))}
          </ul>
        </div>
        );
      })()}
    </div>
  );
}

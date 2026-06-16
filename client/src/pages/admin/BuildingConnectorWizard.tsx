import { useCallback, useEffect, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import BuildingLinkPreviewModal, {
  type BuildingLinkPreviewTarget,
} from '@components/BuildingLinkPreviewModal';
import {
  ArrowLeftRight,
  Eye,
  Link2,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface ConnectorNode {
  nodeId: string;
  label: string;
  floor: number;
  x: number;
  y: number;
}

interface ConnectableNeighbor {
  id: string;
  code: string;
  name: string;
}

interface ExistingLink {
  edgeId: string;
  localNode: { nodeId: string; label: string; x: number; y: number };
  remoteNode: { nodeId: string; label: string; buildingCode: string; x: number; y: number };
}

interface FloorLinkOptions {
  building: { id: string; code: string; name: string };
  floor: number;
  connectableNeighbors: ConnectableNeighbor[];
  localNodes: ConnectorNode[];
  remoteNodes: (ConnectorNode & { buildingCode: string })[];
  existingLinks: ExistingLink[];
  selectedNeighbor: ConnectableNeighbor | null;
}

interface Props {
  buildingId: string;
  currentFloor?: number;
  onEditOnFloor?: (buildingId: string, floor: number) => void;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'G' : `F${floor}`;
}

function floorLabelLong(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

export default function BuildingConnectorWizard({
  buildingId,
  currentFloor,
  onEditOnFloor,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [autoPairing, setAutoPairing] = useState(false);
  const [options, setOptions] = useState<FloorLinkOptions | null>(null);
  const [totalPaired, setTotalPaired] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [preview, setPreview] = useState<BuildingLinkPreviewTarget | null>(null);

  const [selectedNeighborCode, setSelectedNeighborCode] = useState('');
  const [localNodeId, setLocalNodeId] = useState('');
  const [remoteNodeId, setRemoteNodeId] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const [statusRes, sugRes] = await Promise.all([
        api.get(`/admin/buildings/${buildingId}/building-connectors`),
        api.get(`/admin/buildings/${buildingId}/building-connectors/suggestions`),
      ]);
      const data = statusRes.data.data;
      setTotalPaired(data.totalPaired ?? 0);
      setTotalExpected(data.totalExpected ?? 0);
      const suggestions = sugRes.data.data ?? [];
      setSuggestionCount(
        currentFloor === undefined
          ? suggestions.length
          : suggestions.filter((s: { floor: number }) => s.floor === currentFloor).length
      );
    } catch {
      /* summary is optional */
    }
  }, [buildingId, currentFloor]);

  const loadFloorOptions = useCallback(async () => {
    if (!buildingId || currentFloor === undefined) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { floor: currentFloor };
      if (selectedNeighborCode) params.neighborCode = selectedNeighborCode;
      const res = await api.get<{ success: boolean; data: FloorLinkOptions }>(
        `/admin/buildings/${buildingId}/building-connectors/floor-options`,
        { params }
      );
      setOptions(res.data.data);
      await loadSummary();
    } catch (err) {
      showApiErrorToast(err, 'Could not load horizontal link options');
    } finally {
      setLoading(false);
    }
  }, [buildingId, currentFloor, selectedNeighborCode, loadSummary]);

  useEffect(() => {
    void loadFloorOptions();
  }, [loadFloorOptions]);

  useEffect(() => {
    setSelectedNeighborCode('');
    setLocalNodeId('');
    setRemoteNodeId('');
  }, [buildingId, currentFloor]);

  useEffect(() => {
    setLocalNodeId('');
    setRemoteNodeId('');
  }, [selectedNeighborCode]);

  const pairNodes = async (fromNodeId: string, toNodeId: string, label: string) => {
    setPairing(true);
    try {
      await api.post(`/admin/buildings/${buildingId}/building-connectors/pair`, {
        fromNodeId,
        toNodeId,
      });
      showToast('success', `Linked ${label}`);
      await loadFloorOptions();
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
      await loadFloorOptions();
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
      await loadFloorOptions();
    } catch (err) {
      showApiErrorToast(err, 'Auto-pair failed');
    } finally {
      setAutoPairing(false);
    }
  };

  const openPreview = (local: ConnectorNode, remote: ConnectorNode & { buildingCode: string }) => {
    if (!options?.selectedNeighbor) return;
    setPreview({
      floor: currentFloor ?? 0,
      localBuildingId: buildingId,
      localBuildingCode: options.building.code,
      remoteBuildingId: options.selectedNeighbor.id,
      remoteBuildingCode: options.selectedNeighbor.code,
      localNode: {
        nodeId: local.nodeId,
        label: local.label,
        x: local.x,
        y: local.y,
      },
      remoteNode: {
        nodeId: remote.nodeId,
        label: remote.label,
        x: remote.x,
        y: remote.y,
      },
      paired: true,
    });
  };

  if (currentFloor === undefined) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Select a building and floor above to create horizontal links between buildings.
      </p>
    );
  }

  if (loading && !options) {
    return <p className="text-sm text-slate-500">Loading horizontal links…</p>;
  }

  const buildingCode = options?.building.code ?? '';
  const selectedNeighbor = options?.selectedNeighbor;
  const localNodes = options?.localNodes ?? [];
  const remoteNodes = options?.remoteNodes ?? [];
  const existingLinks = options?.existingLinks ?? [];
  const connectableNeighbors = options?.connectableNeighbors ?? [];

  const localSelected = localNodes.find((n) => n.nodeId === localNodeId);
  const remoteSelected = remoteNodes.find((n) => n.nodeId === remoteNodeId);
  const canCreateLink = !!localNodeId && !!remoteNodeId && localNodeId !== remoteNodeId;

  const connectionRules =
    buildingCode === 'ADMIN'
      ? 'Administration can link to Academic on every shared floor, and to Laboratory on floors 0–9.'
      : buildingCode === 'ACAD'
        ? 'Academic links to Administration only on the same floor.'
        : buildingCode === 'LAB'
          ? 'Laboratory links to Administration only on floors 0–9 (Administration has no floors 10–11).'
          : 'Select doorway or corridor locations on the same floor in each building.';

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
              On <strong>{floorLabelLong(currentFloor)}</strong> for{' '}
              <strong>{options?.building.name ?? buildingCode}</strong>: {connectionRules}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadFloorOptions()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              disabled={autoPairing || suggestionCount === 0}
              onClick={() => void runAutoPair()}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <Sparkles size={14} />
              {autoPairing ? 'Linking…' : `Auto-link (${suggestionCount})`}
            </button>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-700">
          {totalPaired}/{totalExpected} floor links paired campus-wide
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-1 font-semibold text-slate-900">Create a horizontal link</h4>
        <p className="mb-4 text-sm text-slate-500">
          Step 1 — pick the building on this floor. Step 2 — pick one place (room, entrance, etc.) in
          each building to connect. Path points are not shown.
        </p>

        {connectableNeighbors.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No connectable buildings on {floorLabelLong(currentFloor)} for{' '}
            <strong>{buildingCode}</strong>. Try another floor or building.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">
                1. Building to connect with
              </span>
              <select
                className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
                value={selectedNeighborCode}
                onChange={(e) => setSelectedNeighborCode(e.target.value)}
              >
                <option value="">Select connectable building…</option>
                {connectableNeighbors.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.code} — {n.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedNeighborCode && selectedNeighbor && (
              <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-slate-700">
                    2. Place in <strong>{buildingCode}</strong> ({floorLabel(currentFloor)})
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-slate-50 disabled:text-slate-400"
                    value={localNodeId}
                    disabled={localNodes.length === 0}
                    onChange={(e) => setLocalNodeId(e.target.value)}
                  >
                    <option value="">
                      {localNodes.length === 0
                        ? 'No places on this floor yet'
                        : 'Select place in this building…'}
                    </option>
                    {localNodes.map((n) => (
                      <option key={n.nodeId} value={n.nodeId}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  {localNodes.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-800">
                      Place markers in <strong>Locations &amp; publish</strong> first.
                    </p>
                  )}
                </label>

                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-slate-700">
                    3. Place in <strong>{selectedNeighbor.code}</strong> ({floorLabel(currentFloor)})
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-slate-50 disabled:text-slate-400"
                    value={remoteNodeId}
                    disabled={remoteNodes.length === 0}
                    onChange={(e) => setRemoteNodeId(e.target.value)}
                  >
                    <option value="">
                      {remoteNodes.length === 0
                        ? 'No places on this floor yet'
                        : `Select place in ${selectedNeighbor.code}…`}
                    </option>
                    {remoteNodes.map((n) => (
                      <option key={n.nodeId} value={n.nodeId}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  {remoteNodes.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-800">
                      Switch building header to {selectedNeighbor.code} and add locations on this
                      floor, or use <strong>Locations &amp; publish</strong>.
                    </p>
                  )}
                </label>
              </div>
            )}

            {selectedNeighborCode && (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={pairing || !canCreateLink}
                  onClick={() =>
                    void pairNodes(
                      localNodeId,
                      remoteNodeId,
                      `${localSelected?.label ?? 'location'} ↔ ${remoteSelected?.label ?? 'location'}`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Link2 size={16} />
                  {pairing ? 'Linking…' : 'Create link'}
                </button>
                {localSelected && remoteSelected && (
                  <button
                    type="button"
                    onClick={() => openPreview(localSelected, remoteSelected)}
                    className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-[var(--color-primary)]"
                  >
                    <Eye size={14} /> Preview on map
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedNeighbor && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h4 className="font-medium text-slate-900">
              Existing links — {buildingCode} ↔ {selectedNeighbor.code} on {floorLabel(currentFloor)}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({existingLinks.length} linked)
              </span>
            </h4>
          </div>
          {existingLinks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No links yet between these buildings on this floor. Use the form above to connect two
              locations.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">{buildingCode}</th>
                    <th className="px-4 py-2">{selectedNeighbor.code}</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {existingLinks.map((row) => {
                    const local: ConnectorNode = {
                      nodeId: row.localNode.nodeId,
                      label: row.localNode.label,
                      floor: currentFloor,
                      x: row.localNode.x,
                      y: row.localNode.y,
                    };
                    const remote: ConnectorNode & { buildingCode: string } = {
                      nodeId: row.remoteNode.nodeId,
                      label: row.remoteNode.label,
                      floor: currentFloor,
                      x: row.remoteNode.x,
                      y: row.remoteNode.y,
                      buildingCode: row.remoteNode.buildingCode,
                    };
                    return (
                      <tr key={row.edgeId} className="border-b border-slate-50">
                        <td className="px-4 py-2">{row.localNode.label}</td>
                        <td className="px-4 py-2">{row.remoteNode.label}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openPreview(local, remote)}
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-[var(--color-primary)]"
                            >
                              <Eye size={14} /> View on map
                            </button>
                            <button
                              type="button"
                              disabled={pairing}
                              onClick={() => void removeEdge(row.edgeId)}
                              className="inline-flex items-center gap-1 text-red-600 hover:underline"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

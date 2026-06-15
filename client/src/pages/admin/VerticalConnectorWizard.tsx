import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import {
  VERTICAL_SHAFT_BUILDING_GUIDE,
  VERTICAL_SHAFT_DEFINITIONS,
  expectedFloorsForShaft,
  getVerticalShaftDef,
  shaftHomeBuildingLabel,
  verticalShaftAllowedInBuilding,
  verticalShaftsForBuilding,
} from '@constants/verticalShafts';
import { ArrowUpDown, Link2, RefreshCw, Sparkles, Trash2, Unlink } from 'lucide-react';
interface VerticalNode {
  id: string;
  label: string;
  floor: number;
  type: string;
  pairedNodeId: string | null;
  pairedFloor: number | null;
  edgeId: string | null;
}

interface VerticalEdge {
  id: string;
  label: string | null;
  fromFloor: number;
  toFloor: number;
  fromLabel: string;
  toLabel: string;
}

interface Suggestion {
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  fromFloor: number;
  toFloor: number;
  type: string;
  reason: string;
}

interface Props {
  buildingId: string;
  buildingCode?: string;
  currentFloor?: number;
  /** Auto-link matching staircase/lift nodes when the section opens. */
  autoPairOnLoad?: boolean;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground (G)' : `Floor ${floor}`;
}

/** Standard shaft names (see verticalShafts.ts for building + floor rules). */

type ShaftFloorOption = {
  floor: number;
  node: VerticalNode | null;
  onMap: boolean;
};

function pickNodeOnFloor(nodes: VerticalNode[], floor: number): VerticalNode | null {
  const onFloor = nodes.filter((n) => n.floor === floor);
  if (onFloor.length === 0) return null;
  const stairs = onFloor.find((n) => n.type === 'STAIRS');
  return stairs ?? onFloor[0];
}

function buildShaftFloorOptions(nodes: VerticalNode[], shaftName: string): ShaftFloorOption[] {
  const matched = nodesForCanonicalName(nodes, shaftName);
  return expectedFloorsForShaft(shaftName).map((floor) => {
    const node = pickNodeOnFloor(matched, floor);
    return { floor, node, onMap: node !== null };
  });
}
function compactShaftLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s*&\s*/g, '&').replace(/\s+/g, ' ');
}

function normalizeShaftLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, '&')
    .replace(/\b(staircase|stairs|stair|lift|elevator)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shaftNumberFromName(name: string): string | null {
  const m = name.match(/(\d+)\s*$/);
  return m ? m[1] : null;
}

function labelsMatchCanonical(nodeLabel: string, canonicalName: string): boolean {
  if (normalizeShaftLabel(nodeLabel) === normalizeShaftLabel(canonicalName)) return true;
  if (compactShaftLabel(nodeLabel) === compactShaftLabel(canonicalName)) return true;
  const want = shaftNumberFromName(canonicalName);
  if (!want) return false;
  if (!/stair|lift|elevator/i.test(nodeLabel)) return false;
  const nodeNum =
    nodeLabel.match(/(?:staircase|stairs|stair|lift|elevator)[^0-9]*(\d+)/i)?.[1] ??
    nodeLabel.match(/(\d+)\s*$/i)?.[1];
  return nodeNum === want;
}

function nodesForCanonicalName(nodes: VerticalNode[], canonicalName: string): VerticalNode[] {
  return nodes.filter((n) => labelsMatchCanonical(n.label, canonicalName));
}

export default function VerticalConnectorWizard({
  buildingId,
  buildingCode = '',
  currentFloor,
  autoPairOnLoad = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [autoPairing, setAutoPairing] = useState(false);
  const [nodes, setNodes] = useState<VerticalNode[]>([]);
  const [edges, setEdges] = useState<VerticalEdge[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [unpairedCount, setUnpairedCount] = useState(0);
  const [pickShaft, setPickShaft] = useState('');
  const [pickFromFloor, setPickFromFloor] = useState('');
  const [pickToFloor, setPickToFloor] = useState('');
  const [apiBuildingCode, setApiBuildingCode] = useState('');
  const autoPairedRef = useRef(false);

  const resolvedBuildingCode = (buildingCode || apiBuildingCode).toUpperCase();
  const shaftsForThisBuilding = useMemo(
    () => (resolvedBuildingCode ? verticalShaftsForBuilding(resolvedBuildingCode) : []),
    [resolvedBuildingCode]
  );
  const otherBuildingShafts = useMemo(
    () =>
      VERTICAL_SHAFT_DEFINITIONS.filter(
        (d) =>
          resolvedBuildingCode &&
          !d.buildingCodes.includes(resolvedBuildingCode as 'ACAD' | 'ADMIN' | 'LAB')
      ),
    [resolvedBuildingCode]
  );
  const buildingGuide = useMemo(
    () => VERTICAL_SHAFT_BUILDING_GUIDE.find((g) => g.code === resolvedBuildingCode),
    [resolvedBuildingCode]
  );

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/buildings/${buildingId}/vertical-connectors`);
      const data = res.data.data;
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
      setSuggestions(data.suggestions ?? []);
      setUnpairedCount(data.unpairedCount ?? 0);
      setApiBuildingCode(data.building?.code ?? '');
    } catch (err) {
      showApiErrorToast(err, 'Could not load vertical connectors');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    autoPairedRef.current = false;
    setPickShaft('');
    setPickFromFloor('');
    setPickToFloor('');
  }, [buildingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoPairOnLoad || autoPairedRef.current || loading || suggestions.length === 0) return;
    autoPairedRef.current = true;
    void (async () => {
      setAutoPairing(true);
      try {
        const res = await api.post(`/admin/buildings/${buildingId}/vertical-connectors/auto-pair`, {});
        const paired = res.data.data?.paired ?? 0;
        if (paired > 0) {
          showToast('success', `Auto-linked ${paired} staircase/lift connection(s)`);
        }
        await load();
      } catch (err) {
        showApiErrorToast(err, 'Auto-link staircases failed');
      } finally {
        setAutoPairing(false);
      }
    })();
  }, [autoPairOnLoad, buildingId, loading, suggestions.length, load]);

  const pairManual = async () => {
    if (!pickShaft || pickFromFloor === '' || pickToFloor === '') {
      showToast('info', 'Select stairs/lift name, from floor, and to floor');
      return;
    }
    if (pickFromFloor === pickToFloor) {
      showToast('info', 'From and To must be different floors');
      return;
    }
    const shaftNodes = nodesForCanonicalName(nodes, pickShaft);
    const fromNode = pickNodeOnFloor(shaftNodes, Number(pickFromFloor));
    const toNode = pickNodeOnFloor(shaftNodes, Number(pickToFloor));
    if (!fromNode || !toNode) {
      showToast(
        'info',
        `Place ${pickShaft} on ${floorLabel(Number(!fromNode ? pickFromFloor : pickToFloor))} in Locations & publish first`
      );
      return;
    }
    setPairing(true);
    try {
      await api.post(`/admin/buildings/${buildingId}/vertical-connectors/pair`, {
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
      });
      showToast(
        'success',
        `Linked ${pickShaft}: ${floorLabel(fromNode.floor)} ↔ ${floorLabel(toNode.floor)}`
      );
      setPickFromFloor('');
      setPickToFloor('');
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Could not pair nodes');
    } finally {
      setPairing(false);
    }
  };

  const pairSuggestion = async (s: Suggestion) => {
    setPairing(true);
    try {
      await api.post(`/admin/buildings/${buildingId}/vertical-connectors/pair`, {
        fromNodeId: s.fromNodeId,
        toNodeId: s.toNodeId,
      });
      showToast('success', `Linked ${s.fromLabel} ↔ ${s.toLabel}`);
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Could not pair');
    } finally {
      setPairing(false);
    }
  };

  const runAutoPair = async () => {
    setAutoPairing(true);
    try {
      const res = await api.post(`/admin/buildings/${buildingId}/vertical-connectors/auto-pair`, {});
      const paired = res.data.data?.paired ?? 0;
      showToast('success', paired > 0 ? `Auto-linked ${paired} vertical link(s)` : 'No new pairs to create');
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Auto-pair failed');
    } finally {
      setAutoPairing(false);
    }
  };

  const removeEdge = async (edgeId: string) => {
    try {
      await api.delete(`/admin/buildings/${buildingId}/vertical-connectors/${edgeId}`);
      showToast('success', 'Vertical link removed');
      await load();
    } catch (err) {
      showApiErrorToast(err, 'Could not remove link');
    }
  };

  const unpaired = nodes.filter((n) => !n.pairedNodeId);
  const floors = [...new Set(nodes.map((n) => n.floor))].sort((a, b) => a - b);
  const shaftFloorOptions = pickShaft ? buildShaftFloorOptions(nodes, pickShaft) : [];
  const fromFloorOptions = shaftFloorOptions;
  const toFloorOptions = shaftFloorOptions.filter(
    (opt) => pickFromFloor === '' || opt.floor !== Number(pickFromFloor)
  );
  const fromOpt = shaftFloorOptions.find((o) => o.floor === Number(pickFromFloor));
  const toOpt = shaftFloorOptions.find((o) => o.floor === Number(pickToFloor));
  const canCreateLink =
    !!pickShaft &&
    pickFromFloor !== '' &&
    pickToFloor !== '' &&
    pickFromFloor !== pickToFloor &&
    verticalShaftAllowedInBuilding(pickShaft, resolvedBuildingCode);

  const floorLinkStatus = (node: VerticalNode | null, onMap: boolean) => {
    if (!onMap || !node) return ' · not on map yet';
    if (node.pairedNodeId) {
      const pairedFloor = node.pairedFloor;
      return pairedFloor !== null ? ` · linked to ${floorLabel(pairedFloor)}` : ' · linked';
    }
    return '';
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vertical links…</p>;
  }

  const floorHint =
    currentFloor !== undefined
      ? ` Viewing ${floorLabel(currentFloor)} — links span all floors in this building.`
      : '';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <ArrowUpDown size={18} className="text-[var(--color-primary)]" />
              Vertical links (staircase &amp; lift)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Connect staircase and lift nodes across floors. Academic: LIFT 1–2 (G–F9) ·
              Administration: LIFT 3 (G–F9) · Laboratory: LIFT 4–5 (G–F11).
              {floorHint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              disabled={autoPairing || suggestions.length === 0}
              onClick={() => void runAutoPair()}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {autoPairing ? 'Pairing…' : `Auto-pair (${suggestions.length})`}
            </button>
          </div>
        </div>

        {buildingGuide && (
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm text-blue-950">
            <p className="font-medium">{buildingGuide.label} ({resolvedBuildingCode})</p>
            <p className="mt-1 text-xs text-blue-900/90">
              Link <strong>{buildingGuide.shafts}</strong> below — {buildingGuide.floors}.
            </p>
          </div>
        )}

        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {VERTICAL_SHAFT_BUILDING_GUIDE.map((guide) => (
            <div
              key={guide.code}
              className={`rounded-lg border px-3 py-2 text-xs ${
                guide.code === resolvedBuildingCode
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <p className="font-semibold text-slate-800">{guide.label}</p>
              <p className="mt-1">{guide.shafts}</p>
              <p className="mt-0.5 text-slate-500">{guide.floors}</p>
              {guide.code === resolvedBuildingCode ? (
                <p className="mt-1.5 font-medium text-[var(--color-primary)]">
                  Active — use Stairs &amp; Lift Name below
                </p>
              ) : (
                <p className="mt-1.5 italic text-slate-500">
                  Guide only — switch building above to link these
                </p>
              )}
            </div>
          ))}
        </div>

        {otherBuildingShafts.length > 0 && (
          <p className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Other buildings: </span>
            {otherBuildingShafts
              .map((d) => `${d.name} (${shaftHomeBuildingLabel(d)})`)
              .join(' · ')}
            . Select that building in the header to link them.
          </p>
        )}

        {resolvedBuildingCode && !VERTICAL_SHAFT_DEFINITIONS.some((d) =>
          d.buildingCodes.includes(resolvedBuildingCode as 'ACAD' | 'ADMIN' | 'LAB')
        ) && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This building has no standard staircase/lift shafts. Switch to Academic, Administration,
            or Laboratory.
          </p>
        )}

        {nodes.length === 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No staircase or lift nodes on this building yet. Place{' '}
            <strong>Stairs &amp; lift (same spot)</strong> markers in{' '}
            <strong>Locations &amp; publish</strong>, then return here to link floors.
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {nodes.length} vertical node(s)
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
            {edges.length} link(s)
          </span>
          {unpairedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
              {unpairedCount} unpaired
            </span>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-800">
              Suggested pairs
            </p>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li
                  key={`${s.fromNodeId}-${s.toNodeId}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {floorLabel(s.fromFloor)} <strong>{s.fromLabel}</strong>
                    {' ↔ '}
                    {floorLabel(s.toFloor)} <strong>{s.toLabel}</strong>
                    <span className="ml-1 text-xs text-slate-500">({s.reason})</span>
                  </span>
                  <button
                    type="button"
                    disabled={pairing}
                    onClick={() => void pairSuggestion(s)}
                    className="inline-flex items-center gap-1 rounded border border-violet-300 bg-white px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
                  >
                    <Link2 size={12} /> Pair
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 font-medium text-slate-700">Stairs &amp; Lift Name</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={pickShaft}
              onChange={(e) => {
                setPickShaft(e.target.value);
                setPickFromFloor('');
                setPickToFloor('');
              }}
            >
              <option value="">Select stairs &amp; lift…</option>
              {shaftsForThisBuilding.length === 0 ? (
                <option value="" disabled>
                  No shafts for this building — see guide above
                </option>
              ) : (
                shaftsForThisBuilding.map((def) => {
                  const onMap = nodesForCanonicalName(nodes, def.name).length;
                  const expected = def.maxFloor + 1;
                  return (
                    <option key={def.name} value={def.name}>
                      {def.name} · {onMap}/{expected} floors on map
                    </option>
                  );
                })
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 font-medium text-slate-700">From</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
              value={pickFromFloor}
              disabled={!pickShaft}
              onChange={(e) => {
                setPickFromFloor(e.target.value);
                if (e.target.value !== '' && e.target.value === pickToFloor) {
                  setPickToFloor('');
                }
              }}
            >
              <option value="">Select floor…</option>
              {fromFloorOptions.map((opt) => (
                <option key={`from-${opt.floor}`} value={String(opt.floor)}>
                  {floorLabel(opt.floor)}
                  {floorLinkStatus(opt.node, opt.onMap)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 font-medium text-slate-700">To</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
              value={pickToFloor}
              disabled={!pickShaft || pickFromFloor === ''}
              onChange={(e) => setPickToFloor(e.target.value)}
            >
              <option value="">Select floor…</option>
              {toFloorOptions.map((opt) => (
                <option key={`to-${opt.floor}`} value={String(opt.floor)}>
                  {floorLabel(opt.floor)}
                  {floorLinkStatus(opt.node, opt.onMap)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {pickShaft && (
          <p className="mb-3 text-xs text-slate-500">
            <strong>{pickShaft}</strong> serves{' '}
            {floorLabel(0)} through {floorLabel(getVerticalShaftDef(pickShaft)?.maxFloor ?? 0)} in{' '}
            {buildingGuide?.label ?? resolvedBuildingCode}. On map:{' '}
            {shaftFloorOptions
              .filter((o) => o.onMap)
              .map((o) => floorLabel(o.floor))
              .join(', ') || 'none yet'}
            .
            {shaftFloorOptions.some((o) => !o.onMap) && (
              <span className="text-amber-800">
                {' '}
                Missing:{' '}
                {shaftFloorOptions
                  .filter((o) => !o.onMap)
                  .map((o) => floorLabel(o.floor))
                  .join(', ')}
                .
              </span>
            )}
          </p>
        )}
        {pickShaft && (fromOpt || toOpt) && (!fromOpt?.onMap || !toOpt?.onMap) && (
          <p className="mb-3 text-xs text-amber-800">
            {!fromOpt?.onMap && pickFromFloor !== '' && (
              <span>
                Place <strong>{pickShaft}</strong> on {floorLabel(Number(pickFromFloor))} in{' '}
                <strong>Locations &amp; publish</strong> before linking.{' '}
              </span>
            )}
            {!toOpt?.onMap && pickToFloor !== '' && (
              <span>
                Place <strong>{pickShaft}</strong> on {floorLabel(Number(pickToFloor))} in{' '}
                <strong>Locations &amp; publish</strong> before linking.
              </span>
            )}
          </p>
        )}
        <button
          type="button"
          disabled={pairing || !canCreateLink}
          onClick={() => void pairManual()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Link2 size={16} />
          {pairing ? 'Linking…' : 'Create vertical link'}
        </button>
      </div>

      {edges.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Active vertical links</h3>
          <ul className="space-y-2 text-sm">
            {edges.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span>
                  {floorLabel(e.fromFloor)} <strong>{e.fromLabel}</strong>
                  {' ↔ '}
                  {floorLabel(e.toFloor)} <strong>{e.toLabel}</strong>
                  {e.label && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs uppercase">
                      {e.label}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void removeEdge(e.id)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unpaired.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Unlink size={16} /> Unpaired nodes
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {floors.map((f) => {
              const onFloor = unpaired.filter((n) => n.floor === f);
              if (onFloor.length === 0) return null;
              return (
                <div key={f} className="rounded-lg bg-white p-2 text-xs">
                  <p className="mb-1 font-semibold text-slate-700">{floorLabel(f)}</p>
                  <ul className="space-y-0.5 text-slate-600">
                    {onFloor.map((n) => (
                      <li key={n.id}>
                        {n.label} <span className="text-slate-400">({n.type})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

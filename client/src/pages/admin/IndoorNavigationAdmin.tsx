import { useCallback, useEffect, useRef, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import FloorPlanReviewPanel from '@pages/admin/FloorPlanReviewPanel';
import FloorNavGraphTab from '@pages/admin/FloorNavGraphTab';
import VerticalConnectorWizard from '@pages/admin/VerticalConnectorWizard';
import BuildingConnectorWizard from '@pages/admin/BuildingConnectorWizard';
import { floorPlanImageUrl } from '@utils/floorPlanImageUrl';
import {
  ArrowLeftRight,
  ClipboardCheck,
  GitBranch,
  MapPin,
  MoveVertical,
  Sparkles,
  Upload,
} from 'lucide-react';

type AdminTab = 'setup' | 'review' | 'graph' | 'horizontal' | 'vertical';

interface FloorPlan {
  id: string;
  floor: number;
  imagePath: string;
  publishStatus?: string;
  locationsLockedAt?: string | null;
  lockedImagePath?: string | null;
}

interface Building {
  id: string;
  name: string;
  code: string;
  floors: number;
  floorPlans: FloorPlan[];
}

interface SetupStatus {
  phase: string;
  allBuildingsExist: boolean;
  phase11Target: number;
  phase11Uploaded: number;
  phase11Published: number;
  activeFloors: number[];
  buildings: Array<{
    code: string;
    name: string;
    phase11MissingFloors: number[];
    phase11PublishedCount: number;
  }>;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

export default function IndoorNavigationAdmin() {
  const [tab, setTab] = useState<AdminTab>('setup');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [reviewTick, setReviewTick] = useState(0);
  const [imagePreviewVersion, setImagePreviewVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const goToLocationsAfterAnalyze = () => {
    setReviewTick((t) => t + 1);
    setTab('review');
  };

  const selected = buildings.find((b) => b.id === buildingId);
  const floorPlan = selected?.floorPlans.find((fp) => fp.floor === floor);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings');
      const list: Building[] = res.data.data || [];
      setBuildings(list);
      if (!buildingId && list[0]) setBuildingId(list[0].id);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  const fetchSetupStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings/setup-status');
      setSetupStatus(res.data.data);
    } catch {
      setSetupStatus(null);
    }
  }, []);

  useEffect(() => {
    void fetchBuildings();
    void fetchSetupStatus();
  }, [fetchBuildings, fetchSetupStatus]);

  const seedFaculty = async () => {
    setSeeding(true);
    try {
      await api.post('/admin/buildings/seed-faculty');
      showToast('success', 'Administration, Academic, and Laboratory buildings registered');
      await fetchBuildings();
      await fetchSetupStatus();
    } catch (err) {
      showApiErrorToast(err, 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const runAnalyzeForFloor = async (building: Building, floorIndex: number) => {
    await api.post(`/admin/buildings/${building.id}/floorplan/${floorIndex}/analyze-ai`, {}, {
      timeout: 240000,
    });
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('floorplan', file);
      fd.append('floor', String(floor));
      await api.post(`/admin/buildings/${selected.id}/floorplan`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setImagePreviewVersion((v) => v + 1);
      setReviewTick((t) => t + 1);
      await fetchBuildings();
      await fetchSetupStatus();
      const wasPublished = floorPlan?.publishStatus === 'PUBLISHED';
      showToast(
        'success',
        wasPublished
          ? `${floorLabel(floor)} replaced — re-lock locations and publish when ready`
          : `${floorLabel(floor)} uploaded — click Run AI analyze to detect rooms`
      );
    } catch (err) {
      showApiErrorToast(err, 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runAnalyze = async () => {
    if (!selected || !floorPlan) return;
    setAnalyzing(true);
    try {
      await runAnalyzeForFloor(selected, floor);
      showToast('success', 'AI analysis complete — review and approve locations');
      goToLocationsAfterAnalyze();
      await fetchBuildings();
      await fetchSetupStatus();
    } catch (err) {
      showApiErrorToast(err, 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <MapPin className="text-[var(--color-primary)]" size={26} />
          Indoor Navigation Setup
        </h1>
        <p className="mt-1 text-slate-600">
          Upload floor plans, run AI room detection, review locations, then publish for students.
        </p>
      </div>

      {setupStatus && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Phase {setupStatus.phase}: <strong>{setupStatus.phase11Uploaded}</strong> /{' '}
              {setupStatus.phase11Target} active floor maps (Ground + First) ·{' '}
              <strong>{setupStatus.phase11Published}</strong> published
            </span>
            {!setupStatus.allBuildingsExist && (
              <button
                type="button"
                disabled={seeding}
                onClick={() => void seedFaculty()}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {seeding ? 'Registering…' : 'Register 3 faculty buildings'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('setup')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === 'setup'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-slate-600'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <Upload size={16} /> Floor plan
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('review')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === 'review'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-slate-600'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <ClipboardCheck size={16} /> Locations &amp; publish
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('graph')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === 'graph'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-slate-600'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <GitBranch size={16} /> Walking paths
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('horizontal')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === 'horizontal'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-slate-600'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <ArrowLeftRight size={16} /> Horizontal links
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('vertical')}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === 'vertical'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-slate-600'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <MoveVertical size={16} /> Vertical links
          </span>
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 font-medium text-slate-700">Building</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 font-medium text-slate-700">Floor</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={floor}
            onChange={(e) => setFloor(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: selected?.floors ?? 1 }, (_, i) => (
              <option key={i} value={i}>
                {floorLabel(i)}
                {floorPlan && i === floor && floorPlan.publishStatus === 'PUBLISHED' ? ' ✓ published' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tab === 'setup' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Upload size={18} /> Floor plan image
          </h2>
          {floorPlan ? (
            <img
              src={floorPlanImageUrl(floorPlan.imagePath, imagePreviewVersion)}
              key={`${floorPlan.imagePath}-${imagePreviewVersion}`}
              alt={floorLabel(floor)}
              className="mb-3 max-h-80 w-full rounded-lg border border-slate-100 object-contain"
            />
          ) : (
            <div className="mb-3 flex h-48 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
              No image for this floor yet
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading || analyzing}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : floorPlan ? 'Replace image' : 'Upload image'}
            </button>
            {floorPlan && (
              <button
                type="button"
                disabled={uploading || analyzing}
                onClick={() => void runAnalyze()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Sparkles size={16} />
                {analyzing ? 'Analyzing…' : 'Run AI analyze'}
              </button>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Upload saves immediately. Then run <strong>AI analyze</strong> (may take 1–3 min) to
            detect rooms and corridors, and approve locations in the next tab.
          </p>
          {analyzing && (
            <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              AI is reading room labels from your floor plan — you can stay on this page.
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            File naming: <code>ADMIN_floor0.jpg</code>, <code>ACAD_floor1.jpg</code>, etc.
          </p>
        </div>
      )}

      {tab === 'review' && selected && (
        <FloorPlanReviewPanel
          key={`${selected.id}-${floor}-${reviewTick}`}
          buildingId={selected.id}
          floor={floor}
          imageUrl={
            floorPlan ? floorPlanImageUrl(floorPlan.imagePath, imagePreviewVersion) : undefined
          }
          onUpdated={() => {
            void fetchBuildings();
            void fetchSetupStatus();
          }}
        />
      )}

      {tab === 'graph' && selected && (
        <FloorNavGraphTab
          buildingId={selected.id}
          floor={floor}
          hasFloorPlan={!!floorPlan}
          floorPlanImageUrl={
            floorPlan
              ? floorPlanImageUrl(
                  floorPlan.locationsLockedAt && floorPlan.lockedImagePath
                    ? floorPlan.lockedImagePath
                    : floorPlan.imagePath,
                  imagePreviewVersion
                )
              : undefined
          }
          locationsLocked={!!floorPlan?.locationsLockedAt}
        />
      )}

      {tab === 'horizontal' && selected && (
        <BuildingConnectorWizard
          buildingId={selected.id}
          currentFloor={floor}
          onEditOnFloor={(bid, fl) => {
            setBuildingId(bid);
            setFloor(fl);
          }}
        />
      )}

      {tab === 'vertical' && selected && (
        <VerticalConnectorWizard
          buildingId={selected.id}
          buildingCode={selected.code}
          currentFloor={floor}
          autoPairOnLoad
        />
      )}
    </div>
  );
}

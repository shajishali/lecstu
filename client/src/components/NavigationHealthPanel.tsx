import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import api, { showApiErrorToast } from '@services/api';

type HealthData = {
  services: {
    vision: { label: string; port: number; healthy: boolean; url: string };
    navigation: { label: string; port: number; healthy: boolean; url: string };
  };
  setup: {
    phase11Uploaded: number;
    phase11Target: number;
    phase11Published: number;
  };
  graphs: {
    total: number;
    healthy: number;
    phase11Total: number;
    phase11Healthy: number;
    floors: Array<{
      buildingCode: string;
      floor: number;
      publishStatus: string;
      healthy: boolean;
      nodeCount: number;
      edgeCount: number;
      isConnected: boolean;
      issues: string[];
    }>;
  };
};

function floorLabel(floor: number) {
  return floor === 0 ? 'G' : `F${floor}`;
}

export default function NavigationHealthPanel() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/navigation/health');
      setData(res.data.data);
    } catch (err) {
      showApiErrorToast(err, 'Could not load navigation health');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <p className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Checking AI services and graph connectivity…
      </p>
    );
  }

  if (!data) return null;

  const { services, setup, graphs } = data;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Activity size={16} className="text-[var(--color-primary)]" />
          System health
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {([services.vision, services.navigation] as const).map((svc) => (
          <div
            key={svc.label}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              svc.healthy ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            {svc.healthy ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            ) : (
              <XCircle size={16} className="shrink-0 text-amber-600" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-slate-800">
                {svc.label}{' '}
                <span className="font-normal text-slate-500">:{svc.port}</span>
              </p>
              <p className="truncate text-xs text-slate-500">{svc.url}</p>
            </div>
            <span className="ml-auto text-xs font-medium">{svc.healthy ? 'Up' : 'Down'}</span>
          </div>
        ))}
      </div>

      <p className="mb-2 text-xs text-slate-600">
        Phase 11 maps: <strong>{setup.phase11Uploaded}</strong> / {setup.phase11Target} uploaded ·{' '}
        <strong>{setup.phase11Published}</strong> published · graphs{' '}
        <strong>{graphs.phase11Healthy}</strong> / {graphs.phase11Total} healthy (G + F1)
      </p>

      {graphs.floors.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 text-xs">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-2 py-1.5 font-medium">Floor</th>
                <th className="px-2 py-1.5 font-medium">Publish</th>
                <th className="px-2 py-1.5 font-medium">Graph</th>
                <th className="px-2 py-1.5 font-medium">Nodes</th>
              </tr>
            </thead>
            <tbody>
              {graphs.floors.map((row) => (
                <tr key={`${row.buildingCode}-${row.floor}`} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    {row.buildingCode} · {floorLabel(row.floor)}
                  </td>
                  <td className="px-2 py-1.5">{row.publishStatus}</td>
                  <td className="px-2 py-1.5">
                    {row.healthy ? (
                      <span className="text-emerald-700">OK</span>
                    ) : (
                      <span className="text-amber-800" title={row.issues.join('; ')}>
                        Fix needed
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.nodeCount} / {row.edgeCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

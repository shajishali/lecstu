import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { showApiErrorToast } from '@services/api';
import { MapPin, Monitor, Navigation, RefreshCw } from 'lucide-react';
import { buildCampusMapUrl, buildGuideAllTodayUrl } from '@utils/mapGuide';

export interface TodayCampusSlot {
  id: string;
  startTime: string;
  endTime: string;
  course: { name: string; code: string };
  lecturerName: string;
  hall: { id: string; name: string; building: string; floor: number };
  mapBuildingId: string | null;
  mapBuildingName: string | null;
  markerId: string | null;
  floor: number;
  isNow: boolean;
  isNext: boolean;
  isUpcoming: boolean;
  isOnline: boolean;
}

interface TodayOnCampusData {
  date: string;
  dayOfWeek: string;
  slots: TodayCampusSlot[];
  hasMultipleLocations: boolean;
  locationCount: number;
  onlineCount: number;
  onCampusCount: number;
  hasOnlineClasses: boolean;
  hasOnCampusClasses: boolean;
  serverTime: string;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground' : `Floor ${floor}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function allLecturesFinished(slots: TodayCampusSlot[]): boolean {
  return (
    slots.length > 0 &&
    slots.every((slot) => !slot.isNow && !slot.isNext && !slot.isUpcoming)
  );
}

function getAllDoneGreeting(serverTime: string): string {
  const hour = parseInt(serverTime.split(':')[0], 10);
  if (Number.isNaN(hour)) return 'All lectures finished for today! Well done.';
  if (hour < 12) return 'All lectures finished for today! Enjoy the rest of your morning.';
  if (hour < 17) return 'All lectures finished for today! Enjoy your afternoon.';
  return 'All lectures finished for today! Have a great evening.';
}

function daySummary(data: TodayOnCampusData): string {
  const parts: string[] = [];
  if (data.onCampusCount > 0) {
    parts.push(`${data.onCampusCount} on campus`);
  }
  if (data.onlineCount > 0) {
    parts.push(`${data.onlineCount} online`);
  }
  return parts.join(' · ');
}

function navigateUrl(slot: TodayCampusSlot): string {
  if (!slot.mapBuildingId) return '/map';
  return buildCampusMapUrl({
    buildingId: slot.mapBuildingId,
    floor: slot.floor,
    hallId: slot.hall.id,
    markerId: slot.markerId || undefined,
    destination: slot.hall.name,
    guide: slot.hall.name,
  });
}

interface TodayOnCampusProps {
  compact?: boolean;
  className?: string;
}

export default function TodayOnCampus({ compact = false, className = '' }: TodayOnCampusProps) {
  const [data, setData] = useState<TodayOnCampusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/timetable/my/today');
      setData(res.data.data);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load today\'s classes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onUpdate = () => load(true);
    window.addEventListener('timetable-updated', onUpdate);
    return () => window.removeEventListener('timetable-updated', onUpdate);
  }, [load]);

  if (loading) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
        <p className="text-sm text-slate-500">Loading today&apos;s schedule…</p>
      </div>
    );
  }

  if (!data) return null;

  const dayLabel =
    data.dayOfWeek.charAt(0) + data.dayOfWeek.slice(1).toLowerCase();
  const finishedForToday = allLecturesFinished(data.slots);
  const summary = daySummary(data);
  const onCampusSlots = data.slots.filter((s) => !s.isOnline);

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Today&apos;s schedule</h3>
          <p className="text-xs text-slate-500">
            {dayLabel} · {data.date}
            {summary && <span className="ml-1 font-medium text-slate-700">· {summary}</span>}
            {data.hasMultipleLocations && (
              <span className="ml-1 font-medium text-amber-700">
                · {data.locationCount} different rooms
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.hasMultipleLocations && onCampusSlots.length > 1 && !finishedForToday && (
            <Link
              to={buildGuideAllTodayUrl()}
              className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Guide all today
            </Link>
          )}
          <button
            type="button"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => load(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {data.slots.length > 0 && !finishedForToday && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2.5">
          {data.hasOnCampusClasses && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              <MapPin size={12} />
              {data.onCampusCount} on campus
            </span>
          )}
          {data.hasOnlineClasses && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
              <Monitor size={12} />
              {data.onlineCount} online lecture{data.onlineCount !== 1 ? 's' : ''} today
            </span>
          )}
        </div>
      )}

      {data.slots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No classes scheduled for today.</p>
      ) : finishedForToday ? (
        <div className="px-4 py-8 text-center">
          <p className="text-3xl" aria-hidden>
            ✓
          </p>
          <p className="mt-2 text-base font-semibold text-slate-800">
            {getAllDoneGreeting(data.serverTime)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            You completed {data.slots.length} class{data.slots.length !== 1 ? 'es' : ''} today
            {summary ? ` (${summary})` : ''}. Rest well - see you next time!
          </p>
        </div>
      ) : (
        <ul className={`list-none p-0 ${compact ? 'divide-y divide-slate-100' : 'space-y-0'}`}>
          {data.slots.map((slot) => (
            <li
              key={slot.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                slot.isNow ? 'bg-emerald-50' : slot.isNext ? 'bg-sky-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </span>
                  {slot.isOnline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      <Monitor size={10} />
                      Online
                    </span>
                  )}
                  {slot.isNow && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Now
                    </span>
                  )}
                  {!slot.isNow && slot.isNext && (
                    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Next
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-medium text-[var(--color-primary)]">
                  {slot.course.name}
                </p>
                <p className="text-xs text-slate-600">
                  {slot.lecturerName}
                  {!slot.isOnline && ` · ${slot.hall.name}`}
                </p>
                {slot.isOnline ? (
                  <p className="flex items-center gap-1 text-xs font-medium text-sky-700">
                    <Monitor size={12} />
                    Online lecture - join via your course platform or lecturer&apos;s link
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} />
                    {slot.mapBuildingName || slot.hall.building} · {floorLabel(slot.floor)}
                  </p>
                )}
              </div>
              {slot.isOnline ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                  <Monitor size={14} />
                  Online
                </span>
              ) : (
                <Link
                  to={navigateUrl(slot)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                >
                  <Navigation size={14} />
                  Navigate
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

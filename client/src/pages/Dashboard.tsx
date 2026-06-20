import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import {
  Calendar,
  Users,
  Map,
  GraduationCap,
  Bell,
  BarChart3,
  Clock,
} from 'lucide-react';
import TodayOnCampus from '@components/TodayOnCampus';
import IndoorNavigationPanel from '@components/IndoorNavigationPanel';
import { usePendingAppointmentCount } from '@hooks/usePendingAppointmentCount';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
};

interface SlotData {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  year?: number;
  month?: number;
  week?: number;
  course: { name: string; code: string };
}

function getCurrentDay(): string {
  const jsDay = new Date().getDay();
  if (jsDay >= 1 && jsDay <= 5) return DAYS[jsDay - 1];
  return '';
}

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function computeNextLectureAndTodayCount(flat: SlotData[]): { nextLecture: string; todayCount: number } {
  const today = getCurrentDay();
  const nowStr = getCurrentTimeStr();
  if (!today || flat.length === 0) {
    return { nextLecture: 'No classes scheduled', todayCount: 0 };
  }
  const todaySlots = flat
    .filter((s) => s.dayOfWeek === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayCount = todaySlots.length;
  const nextSlot = todaySlots.find((s) => s.startTime > nowStr);
  if (nextSlot) {
    return {
      nextLecture: `${nextSlot.course.name} - ${formatTime(nextSlot.startTime)}`,
      todayCount,
    };
  }
  const dayIdx = DAYS.indexOf(today);
  const upcomingDays = DAYS.slice(dayIdx + 1).concat(DAYS.slice(0, dayIdx));
  for (const day of upcomingDays) {
    const daySlots = flat
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (daySlots.length > 0) {
      const first = daySlots[0];
      return {
        nextLecture: `${first.course.name} - ${DAY_LABELS[day]} ${formatTime(first.startTime)}`,
        todayCount,
      };
    }
  }
  return {
    nextLecture: todayCount > 0 ? 'No more classes today' : 'No classes scheduled',
    todayCount,
  };
}

function computeLecturerTodayCount(flat: SlotData[]): number {
  const today = getCurrentDay();
  if (!today) return 0;
  return flat.filter((s) => s.dayOfWeek === today).length;
}

function formatPendingAppointments(count: number): string {
  if (count === 0) return 'None pending';
  return `${count} pending`;
}

function applyLecturerCardUpdates(
  base: { title: string; desc: string; icon: React.ReactNode; color: string }[],
  todayCount: number,
  pendingCount: number,
) {
  return base.map((c) => {
    if (c.title === 'My Classes Today') {
      return { ...c, desc: `${todayCount} lecture${todayCount !== 1 ? 's' : ''}` };
    }
    if (c.title === 'Appointments') {
      return { ...c, desc: formatPendingAppointments(pendingCount) };
    }
    return c;
  });
}

const roleCardsBase: Record<string, { title: string; desc: string; icon: React.ReactNode; color: string }[]> = {
  ADMIN: [
    { title: 'Total Users', desc: '122 registered', icon: <Users size={24} />, color: '#3b82f6' },
    { title: 'Timetable Entries', desc: '30 scheduled', icon: <Calendar size={24} />, color: '#8b5cf6' },
    { title: 'Lecture Halls', desc: '10 configured', icon: <Map size={24} />, color: '#06b6d4' },
    { title: 'Notifications', desc: '3 pending', icon: <Bell size={24} />, color: '#f59e0b' },
  ],
  LECTURER: [
    { title: 'My Classes Today', desc: '3 lectures', icon: <Calendar size={24} />, color: '#3b82f6' },
    { title: 'Appointments', desc: '—', icon: <Users size={24} />, color: '#8b5cf6' },
    { title: 'Office Hours', desc: '2:00 - 4:00 PM', icon: <Clock size={24} />, color: '#f59e0b' },
  ],
  STUDENT: [
    { title: 'Next Lecture', desc: '-', icon: <GraduationCap size={24} />, color: '#3b82f6' },
    { title: 'My Schedule', desc: '-', icon: <Calendar size={24} />, color: '#8b5cf6' },
    { title: 'Analytics', desc: 'Attendance: 92%', icon: <BarChart3 size={24} />, color: '#f59e0b' },
  ],
};

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-amber-100 text-amber-800',
  LECTURER: 'bg-violet-100 text-violet-800',
  STUDENT: 'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)]',
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const studentGroupId =
    user?.role === 'STUDENT' ? user?.studentGroupMemberships?.[0]?.group?.id : undefined;
  const pendingAppointmentCount = usePendingAppointmentCount(user?.role);
  const [cards, setCards] = useState<{ title: string; desc: string; icon: React.ReactNode; color: string }[]>([]);

  const fetchTimetable = useCallback(async () => {
    if (!user) return;
    const base = roleCardsBase[user.role] || [];
    if (user.role === 'ADMIN' || (user.role !== 'STUDENT' && user.role !== 'LECTURER')) {
      setCards(base);
      return;
    }
    try {
      const res = await api.get<{ success: boolean; data?: { flat?: SlotData[] } }>('/timetable/my');
      const flat = res.data?.data?.flat ?? [];
      if (user.role === 'STUDENT') {
        const { nextLecture, todayCount } = computeNextLectureAndTodayCount(flat);
        setCards(
          base.map((c) => {
            if (c.title === 'Next Lecture') return { ...c, desc: nextLecture };
            if (c.title === 'My Schedule') return { ...c, desc: `${todayCount} class${todayCount !== 1 ? 'es' : ''} today` };
            return c;
          })
        );
      } else if (user.role === 'LECTURER') {
        const todayCount = computeLecturerTodayCount(flat);
        setCards(applyLecturerCardUpdates(base, todayCount, pendingAppointmentCount));
      } else {
        setCards(base);
      }
    } catch {
      if (user.role === 'LECTURER') {
        setCards(applyLecturerCardUpdates(base, 0, pendingAppointmentCount));
      } else {
        setCards(base);
      }
    }
  }, [user?.id, user?.role, studentGroupId, pendingAppointmentCount]);

  useEffect(() => {
    if (!user) {
      setCards([]);
      return;
    }
    const base = roleCardsBase[user.role] || [];
    if (user.role === 'ADMIN') {
      setCards(base);
      return;
    }
    setCards(base);
    if (user.role === 'STUDENT' || user.role === 'LECTURER') {
      fetchTimetable();
    }
  }, [user, fetchTimetable]);

  useEffect(() => {
    if (user?.role !== 'LECTURER') return;
    setCards((prev) =>
      prev.map((c) =>
        c.title === 'Appointments'
          ? { ...c, desc: formatPendingAppointments(pendingAppointmentCount) }
          : c,
      ),
    );
  }, [pendingAppointmentCount, user?.role]);

  useEffect(() => {
    const onTimetableUpdated = () => fetchTimetable();
    window.addEventListener('timetable-updated', onTimetableUpdated);
    return () => window.removeEventListener('timetable-updated', onTimetableUpdated);
  }, [fetchTimetable]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.firstName}!</h1>
        <p className="mt-1 text-slate-500">
          {user?.role === 'ADMIN' && 'System administration overview'}
          {user?.role === 'LECTURER' && "Here's your day at a glance"}
          {user?.role === 'STUDENT' && "Here's what's happening today"}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {cards.map((card) => {
          const cardBody = (
            <>
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: card.color + '18', color: card.color }}
              >
                {card.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">{card.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{card.desc}</p>
              </div>
            </>
          );
          const className =
            'flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm transition-shadow hover:shadow-md no-underline text-inherit';
          if (user?.role === 'LECTURER' && card.title === 'Appointments') {
            return (
              <Link key={card.title} to="/appointments" className={className}>
                {cardBody}
              </Link>
            );
          }
          return (
            <div key={card.title} className={className}>
              {cardBody}
            </div>
          );
        })}
      </div>

      {user?.role === 'STUDENT' && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TodayOnCampus />
          <IndoorNavigationPanel />
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-800">Your Profile</h3>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="w-[120px] border-b border-slate-100 py-2 text-sm font-medium text-slate-500">Name</td>
                <td className="border-b border-slate-100 py-2 text-sm">{user?.firstName} {user?.lastName}</td>
              </tr>
              <tr>
                <td className="border-b border-slate-100 py-2 text-sm font-medium text-slate-500">Email</td>
                <td className="border-b border-slate-100 py-2 text-sm">{user?.email}</td>
              </tr>
              <tr>
                <td className="border-b border-slate-100 py-2 text-sm font-medium text-slate-500">Role</td>
                <td className="border-b border-slate-100 py-2 text-sm">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${roleBadgeColors[user?.role || ''] || 'bg-slate-200 text-slate-600'}`}>
                    {user?.role}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2 text-sm font-medium text-slate-500">Department</td>
                <td className="py-2 text-sm">{user?.department?.name || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

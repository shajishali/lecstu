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
  BookOpen,
  Clock,
} from 'lucide-react';
import TodayOnCampus from '@components/TodayOnCampus';
import IndoorNavigationPanel from '@components/IndoorNavigationPanel';
import { usePendingAppointmentCount } from '@hooks/usePendingAppointmentCount';
import { usePendingApprovalsCount } from '@hooks/usePendingApprovalsCount';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const ALL_DAYS = [...WEEKDAYS, 'SATURDAY', 'SUNDAY'];
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

interface SlotData {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  course: { name: string; code: string };
}

interface ScheduleSlotData {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotType: string;
}

interface AdminStats {
  users: { total: number };
  facilities: { halls: number };
  operations: { timetableEntries: number };
}

type DashboardCard = {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
};

function getCurrentDay(): string {
  const jsDay = new Date().getDay();
  if (jsDay === 0) return 'SUNDAY';
  return ALL_DAYS[jsDay - 1];
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
  const dayIdx = ALL_DAYS.indexOf(today);
  const upcomingDays = ALL_DAYS.slice(dayIdx + 1).concat(ALL_DAYS.slice(0, dayIdx));
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

function computeStudentWeeklyOverview(flat: SlotData[]): string {
  if (flat.length === 0) return 'No classes scheduled';
  const courseCount = new Set(flat.map((s) => s.course.code)).size;
  return `${courseCount} course${courseCount !== 1 ? 's' : ''} · ${flat.length} class${flat.length !== 1 ? 'es' : ''}/week`;
}

function computeOfficeHoursDesc(slots: ScheduleSlotData[]): string {
  const officeSlots = slots
    .filter((s) => s.slotType === 'OFFICE_HOUR')
    .sort((a, b) => {
      const dayDiff = ALL_DAYS.indexOf(a.dayOfWeek) - ALL_DAYS.indexOf(b.dayOfWeek);
      return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
    });

  if (officeSlots.length === 0) return 'None scheduled';

  const today = getCurrentDay();
  const nowStr = getCurrentTimeStr();
  const todaySlots = officeSlots.filter((s) => s.dayOfWeek === today);
  const activeToday = todaySlots.find((s) => s.endTime > nowStr);
  if (activeToday) {
    return `Today ${formatTime(activeToday.startTime)} – ${formatTime(activeToday.endTime)}`;
  }
  const laterToday = todaySlots.find((s) => s.startTime > nowStr);
  if (laterToday) {
    return `Today ${formatTime(laterToday.startTime)} – ${formatTime(laterToday.endTime)}`;
  }

  const dayIdx = today ? ALL_DAYS.indexOf(today) : -1;
  const upcomingDays =
    dayIdx >= 0 ? ALL_DAYS.slice(dayIdx + 1).concat(ALL_DAYS.slice(0, dayIdx)) : ALL_DAYS;
  for (const day of upcomingDays) {
    const daySlots = officeSlots.filter((s) => s.dayOfWeek === day);
    if (daySlots.length > 0) {
      const slot = daySlots[0];
      return `${DAY_LABELS[day]} ${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`;
    }
  }

  const first = officeSlots[0];
  return `${DAY_LABELS[first.dayOfWeek]} ${formatTime(first.startTime)} – ${formatTime(first.endTime)}`;
}

function formatPendingCount(count: number, noun: string): string {
  if (count === 0) return `None pending`;
  return `${count} pending ${noun}${count !== 1 ? 's' : ''}`;
}

function buildRoleCards(role: string, loading: boolean): DashboardCard[] {
  const placeholder = loading ? 'Loading…' : '—';
  const cards: Record<string, DashboardCard[]> = {
    ADMIN: [
      { title: 'Total Users', desc: placeholder, icon: <Users size={24} />, color: '#3b82f6', href: '/admin/users' },
      { title: 'Timetable Entries', desc: placeholder, icon: <Calendar size={24} />, color: '#8b5cf6', href: '/admin/timetable' },
      { title: 'Lecture Halls', desc: placeholder, icon: <Map size={24} />, color: '#06b6d4', href: '/admin/halls' },
      { title: 'Pending Approvals', desc: placeholder, icon: <Bell size={24} />, color: '#f59e0b', href: '/approvals' },
    ],
    LECTURER: [
      { title: 'My Classes Today', desc: placeholder, icon: <Calendar size={24} />, color: '#3b82f6', href: '/lecturer/schedule' },
      { title: 'Appointments', desc: placeholder, icon: <Users size={24} />, color: '#8b5cf6', href: '/appointments' },
      { title: 'Office Hours', desc: placeholder, icon: <Clock size={24} />, color: '#f59e0b', href: '/lecturer/schedule' },
    ],
    STUDENT: [
      { title: 'Next Lecture', desc: placeholder, icon: <GraduationCap size={24} />, color: '#3b82f6', href: '/timetable' },
      { title: 'My Schedule', desc: placeholder, icon: <Calendar size={24} />, color: '#8b5cf6', href: '/timetable' },
      { title: 'My Courses', desc: placeholder, icon: <BookOpen size={24} />, color: '#f59e0b', href: '/timetable' },
    ],
  };
  return cards[role] || [];
}

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-amber-100 text-amber-800',
  LECTURER: 'bg-violet-100 text-violet-800',
  STUDENT: 'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)]',
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const pendingAppointmentCount = usePendingAppointmentCount(user?.role);
  const pendingApprovalsCount = usePendingApprovalsCount();
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    const base = buildRoleCards(user.role, true);
    setCards(base);
    setLoading(true);

    if (user.role === 'ADMIN') {
      try {
        const res = await api.get<{ success: boolean; data?: AdminStats }>('/admin/stats');
        const stats = res.data?.data;
        setCards(
          buildRoleCards('ADMIN', false).map((c) => {
            if (c.title === 'Total Users') {
              return { ...c, desc: `${stats?.users.total ?? 0} registered` };
            }
            if (c.title === 'Timetable Entries') {
              return { ...c, desc: `${stats?.operations.timetableEntries ?? 0} scheduled` };
            }
            if (c.title === 'Lecture Halls') {
              return { ...c, desc: `${stats?.facilities.halls ?? 0} configured` };
            }
            if (c.title === 'Pending Approvals') {
              return { ...c, desc: formatPendingCount(pendingApprovalsCount, 'approval') };
            }
            return c;
          }),
        );
      } catch {
        setCards(buildRoleCards('ADMIN', false));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (user.role === 'STUDENT' || user.role === 'LECTURER') {
      try {
        const res = await api.get<{
          success: boolean;
          data?: { flat?: SlotData[]; scheduleSlots?: ScheduleSlotData[] };
        }>('/timetable/my');
        const flat = res.data?.data?.flat ?? [];
        const scheduleSlots = res.data?.data?.scheduleSlots ?? [];

        if (user.role === 'STUDENT') {
          const { nextLecture, todayCount } = computeNextLectureAndTodayCount(flat);
          const weeklyOverview = computeStudentWeeklyOverview(flat);
          setCards(
            buildRoleCards('STUDENT', false).map((c) => {
              if (c.title === 'Next Lecture') return { ...c, desc: nextLecture };
              if (c.title === 'My Schedule') {
                return { ...c, desc: `${todayCount} class${todayCount !== 1 ? 'es' : ''} today` };
              }
              if (c.title === 'My Courses') return { ...c, desc: weeklyOverview };
              return c;
            }),
          );
        } else {
          const todayCount = computeLecturerTodayCount(flat);
          const officeHours = computeOfficeHoursDesc(scheduleSlots);
          setCards(
            buildRoleCards('LECTURER', false).map((c) => {
              if (c.title === 'My Classes Today') {
                return { ...c, desc: `${todayCount} lecture${todayCount !== 1 ? 's' : ''}` };
              }
              if (c.title === 'Appointments') {
                return { ...c, desc: formatPendingCount(pendingAppointmentCount, 'appointment') };
              }
              if (c.title === 'Office Hours') return { ...c, desc: officeHours };
              return c;
            }),
          );
        }
      } catch {
        if (user.role === 'LECTURER') {
          setCards(
            buildRoleCards('LECTURER', false).map((c) => {
              if (c.title === 'Appointments') {
                return { ...c, desc: formatPendingCount(pendingAppointmentCount, 'appointment') };
              }
              return c;
            }),
          );
        } else {
          setCards(buildRoleCards('STUDENT', false));
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    setCards(buildRoleCards(user.role, false));
    setLoading(false);
  }, [user, pendingAppointmentCount, pendingApprovalsCount]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (user?.role === 'LECTURER') {
      setCards((prev) =>
        prev.map((c) =>
          c.title === 'Appointments'
            ? { ...c, desc: formatPendingCount(pendingAppointmentCount, 'appointment') }
            : c,
        ),
      );
    }
    if (user?.role === 'ADMIN') {
      setCards((prev) =>
        prev.map((c) =>
          c.title === 'Pending Approvals'
            ? { ...c, desc: formatPendingCount(pendingApprovalsCount, 'approval') }
            : c,
        ),
      );
    }
  }, [pendingAppointmentCount, pendingApprovalsCount, user?.role]);

  useEffect(() => {
    const onTimetableUpdated = () => fetchDashboard();
    window.addEventListener('timetable-updated', onTimetableUpdated);
    return () => window.removeEventListener('timetable-updated', onTimetableUpdated);
  }, [fetchDashboard]);

  const studentGroup = user?.studentGroupMemberships?.[0]?.group;
  const studentBatch = user?.studentGroupMemberships?.[0]?.selectedBatchYearLabel;

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
                <p className={`mt-0.5 text-xs text-slate-500 ${loading && card.desc === 'Loading…' ? 'animate-pulse' : ''}`}>
                  {card.desc}
                </p>
              </div>
            </>
          );
          const className =
            'flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm transition-shadow hover:shadow-md no-underline text-inherit';
          if (card.href) {
            return (
              <Link key={card.title} to={card.href} className={className}>
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
              {user?.role === 'STUDENT' && (
                <tr>
                  <td className="border-b border-slate-100 py-2 text-sm font-medium text-slate-500">Group</td>
                  <td className="border-b border-slate-100 py-2 text-sm">
                    {studentGroup?.name || '-'}
                    {studentBatch ? ` · ${studentBatch}` : ''}
                  </td>
                </tr>
              )}
              {user?.role === 'LECTURER' && (
                <>
                  <tr>
                    <td className="border-b border-slate-100 py-2 text-sm font-medium text-slate-500">Timetable code</td>
                    <td className="border-b border-slate-100 py-2 text-sm">{user?.timetableCode || '-'}</td>
                  </tr>
                  {user?.lecturerOffice && (
                    <tr>
                      <td className="border-b border-slate-100 py-2 text-sm font-medium text-slate-500">Office</td>
                      <td className="border-b border-slate-100 py-2 text-sm">
                        {user.lecturerOffice.roomNumber}, {user.lecturerOffice.building}
                        {user.lecturerOffice.floor > 0 ? ` (Floor ${user.lecturerOffice.floor})` : ' (Ground)'}
                      </td>
                    </tr>
                  )}
                </>
              )}
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

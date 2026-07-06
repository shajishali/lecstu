import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import NotificationCenter from '@components/NotificationCenter';
import ChatWidget from '@components/ChatWidget';
import LanguageSwitcher from '@components/LanguageSwitcher';
import SidebarNotificationPopover from '@components/SidebarNotificationPopover';
import {
  LayoutDashboard,
  LogOut,
  User,
  Calendar,
  Map,
  Bell,
  Users,
  GraduationCap,
  Settings,
  ShieldCheck,
  Building,
  Layers,
  DoorOpen,
  MapPin,
  Menu,
  X,
  DoorClosed,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSidebarBadgeCounts } from '@hooks/useSidebarBadgeCounts';
import { useNotificationStore } from '@store/notificationStore';
import { getSidebarSectionConfig } from '@config/sidebarNotifications';

const navByRole: Record<string, { label: string; path: string; icon: React.ReactNode }[]> = {
  ADMIN: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Admin Panel', path: '/admin', icon: <ShieldCheck size={18} /> },
    { label: 'Approvals', path: '/approvals', icon: <Bell size={18} /> },
    { label: 'Users', path: '/admin/users', icon: <Users size={18} /> },
    { label: 'Timetable', path: '/admin/timetable', icon: <Calendar size={18} /> },
    { label: 'Groups', path: '/admin/groups', icon: <Layers size={18} /> },
    { label: 'Halls', path: '/admin/halls', icon: <Building size={18} /> },
    { label: 'Offices', path: '/admin/offices', icon: <DoorOpen size={18} /> },
    { label: 'Indoor Navigation', path: '/admin/navigation', icon: <MapPin size={18} /> },
    { label: 'Hall Availability', path: '/halls/availability', icon: <DoorClosed size={18} /> },
    { label: 'Lecturers', path: '/lecturers', icon: <GraduationCap size={18} /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
    { label: 'Settings', path: '/settings', icon: <Settings size={18} /> },
  ],
  LECTURER: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Schedule', path: '/lecturer/schedule', icon: <Calendar size={18} /> },
    { label: 'Approvals', path: '/approvals', icon: <Bell size={18} /> },
    { label: 'Hall Availability', path: '/halls/availability', icon: <DoorClosed size={18} /> },
    { label: 'Lecturers', path: '/lecturers', icon: <GraduationCap size={18} /> },
    { label: 'Appointments', path: '/appointments', icon: <Users size={18} /> },
    { label: 'Find My Way', path: '/navigate', icon: <Map size={18} /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
  ],
  STUDENT: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Timetable', path: '/timetable', icon: <Calendar size={18} /> },
    { label: 'Approvals', path: '/approvals', icon: <Bell size={18} /> },
    { label: 'Hall Availability', path: '/halls/availability', icon: <DoorClosed size={18} /> },
    { label: 'Lecturers', path: '/lecturers', icon: <GraduationCap size={18} /> },
    { label: 'Book Appointment', path: '/appointments', icon: <GraduationCap size={18} /> },
    { label: 'Find My Way', path: '/navigate', icon: <Map size={18} /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
  ],
};

function isPathActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function SidebarNavItemWithPopover({
  item,
  sectionConfig,
  badgeCount,
  showBadge,
  popoverOpen,
  onOpen,
  onScheduleClose,
  onCancelClose,
  onClosePopover,
  onSidebarClose,
}: {
  item: { label: string; path: string; icon: React.ReactNode };
  sectionConfig: NonNullable<ReturnType<typeof getSidebarSectionConfig>>;
  badgeCount: number;
  showBadge: boolean;
  popoverOpen: boolean;
  onOpen: () => void;
  onScheduleClose: () => void;
  onCancelClose: () => void;
  onClosePopover: () => void;
  onSidebarClose: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onScheduleClose}
    >
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-400 no-underline transition-colors hover:bg-white/5 hover:text-white ${
            isActive ? 'border-l-2 border-white bg-white/15 text-white' : 'border-l-2 border-transparent'
          }`
        }
        onClick={() => {
          onSidebarClose();
          onClosePopover();
        }}
      >
        <span className="relative flex items-center justify-center">
          {item.icon}
          {showBadge && (
            <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-[var(--color-primary)]">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>
        <span>{item.label}</span>
      </NavLink>
      <SidebarNotificationPopover
        open={popoverOpen}
        onClose={onClosePopover}
        anchorRef={anchorRef}
        config={sectionConfig}
        onNavigate={onSidebarClose}
        onMouseEnter={onCancelClose}
      />
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popoverPath, setPopoverPath] = useState<string | null>(null);
  const popoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarBadges = useSidebarBadgeCounts();
  const unreadNotificationCount = useNotificationStore((s) => s.unreadCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  const links = user ? navByRole[user.role] || [] : [];

  useEffect(() => {
    if (user) fetchUnreadCount();
  }, [user, fetchUnreadCount]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openPopover = (path: string) => {
    if (popoverCloseTimerRef.current) {
      clearTimeout(popoverCloseTimerRef.current);
      popoverCloseTimerRef.current = null;
    }
    setPopoverPath(path);
  };

  const scheduleClosePopover = () => {
    popoverCloseTimerRef.current = setTimeout(() => setPopoverPath(null), 150);
  };

  const cancelClosePopover = () => {
    if (popoverCloseTimerRef.current) {
      clearTimeout(popoverCloseTimerRef.current);
      popoverCloseTimerRef.current = null;
    }
  };

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        style={{ backgroundColor: 'var(--color-primary)' }}
        className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col text-white transition-transform duration-250 ease-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-primary)] px-5 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="LECSTU" className="h-8 w-auto" />
          </Link>
          <button
            type="button"
            className="flex p-1 text-slate-400 hover:text-white md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {links.map((item) => {
            const sectionConfig = getSidebarSectionConfig(user?.role, item.path);
            const onSectionPage = isPathActive(location.pathname, item.path);
            const sectionBadge =
              sectionConfig && !onSectionPage ? (sidebarBadges[item.path] ?? 0) : 0;
            const showGlobalNotificationBadge =
              item.path === '/notifications' &&
              unreadNotificationCount > 0 &&
              !isPathActive(location.pathname, '/notifications');
            const badgeCount = sectionBadge > 0 ? sectionBadge : showGlobalNotificationBadge ? unreadNotificationCount : 0;
            const showBadge = badgeCount > 0;
            const hasPopover = Boolean(sectionConfig);

            const navLinkContent = (
              <>
                <span className="relative flex items-center justify-center">
                  {item.icon}
                  {showBadge && (
                    <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-[var(--color-primary)]">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </>
            );

            const navLink = (
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-slate-400 no-underline transition-colors hover:bg-white/5 hover:text-white ${
                    isActive ? 'border-l-2 border-white bg-white/15 text-white' : 'border-l-2 border-transparent'
                  }`
                }
                onClick={() => {
                  setSidebarOpen(false);
                  setPopoverPath(null);
                }}
              >
                {navLinkContent}
              </NavLink>
            );

            if (!hasPopover) {
              return <div key={item.path}>{navLink}</div>;
            }

            return (
              <SidebarNavItemWithPopover
                key={item.path}
                item={item}
                sectionConfig={sectionConfig!}
                badgeCount={badgeCount}
                showBadge={showBadge}
                popoverOpen={popoverPath === item.path}
                onOpen={() => openPopover(item.path)}
                onScheduleClose={scheduleClosePopover}
                onCancelClose={cancelClosePopover}
                onClosePopover={() => setPopoverPath(null)}
                onSidebarClose={() => setSidebarOpen(false)}
              />
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-primary)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{user?.role}</div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ml-[250px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-primary)] px-6 shadow-sm [background-color:var(--color-primary)]">
          <button
            type="button"
            className="flex p-1 text-slate-300 hover:text-white md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <LanguageSwitcher darkNav />
            <NotificationCenter darkNav />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/20 text-white">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User size={18} />
                )}
              </div>
              <span className="text-sm font-semibold text-white">
                {user?.firstName} {user?.lastName}
              </span>
            </div>

            <button
              type="button"
              className="flex items-center rounded border border-white/20 p-2 text-slate-300 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-7">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}

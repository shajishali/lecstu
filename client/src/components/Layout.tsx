import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import {
  LayoutDashboard,
  LogOut,
  User,
  Calendar,
  Map,
  Bell,
  MessageSquare,
  Users,
  GraduationCap,
  Settings,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navByRole: Record<string, { label: string; path: string; icon: React.ReactNode }[]> = {
  ADMIN: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Admin Panel', path: '/admin', icon: <ShieldCheck size={18} /> },
    { label: 'Users', path: '/admin/users', icon: <Users size={18} /> },
    { label: 'Timetable', path: '/timetable', icon: <Calendar size={18} /> },
    { label: 'Campus Map', path: '/map', icon: <Map size={18} /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
    { label: 'Settings', path: '/settings', icon: <Settings size={18} /> },
  ],
  LECTURER: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Timetable', path: '/timetable', icon: <Calendar size={18} /> },
    { label: 'Appointments', path: '/appointments', icon: <Users size={18} /> },
    { label: 'AI Assistant', path: '/assistant', icon: <MessageSquare size={18} /> },
    { label: 'Campus Map', path: '/map', icon: <Map size={18} /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
  ],
  STUDENT: [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Timetable', path: '/timetable', icon: <Calendar size={18} /> },
    { label: 'Book Appointment', path: '/appointments', icon: <GraduationCap size={18} /> },
    { label: 'AI Assistant', path: '/assistant', icon: <MessageSquare size={18} /> },
    { label: 'Campus Map', path: '/map', icon: <Map size={18} /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
  ],
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = user ? navByRole[user.role] || [] : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-brand">LECSTU</h2>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-role">
            {user?.role}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-wrapper">
        {/* Top navbar */}
        <header className="top-navbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="navbar-spacer" />

          <div className="navbar-right">
            <div className="user-info">
              <div className="user-avatar">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="" />
                ) : (
                  <User size={18} />
                )}
              </div>
              <span className="user-name">
                {user?.firstName} {user?.lastName}
              </span>
            </div>

            <button className="btn-logout" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

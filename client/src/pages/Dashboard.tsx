import { useAuthStore } from '@store/authStore';
import {
  Calendar,
  Users,
  MessageSquare,
  Map,
  GraduationCap,
  Bell,
  BarChart3,
  Clock,
} from 'lucide-react';

const roleCards: Record<string, { title: string; desc: string; icon: React.ReactNode; color: string }[]> = {
  ADMIN: [
    { title: 'Total Users', desc: '122 registered', icon: <Users size={24} />, color: '#3b82f6' },
    { title: 'Timetable Entries', desc: '30 scheduled', icon: <Calendar size={24} />, color: '#8b5cf6' },
    { title: 'Lecture Halls', desc: '10 configured', icon: <Map size={24} />, color: '#06b6d4' },
    { title: 'Notifications', desc: '3 pending', icon: <Bell size={24} />, color: '#f59e0b' },
  ],
  LECTURER: [
    { title: 'My Classes Today', desc: '3 lectures', icon: <Calendar size={24} />, color: '#3b82f6' },
    { title: 'Appointments', desc: '2 pending', icon: <Users size={24} />, color: '#8b5cf6' },
    { title: 'AI Assistant', desc: 'Ask anything', icon: <MessageSquare size={24} />, color: '#10b981' },
    { title: 'Office Hours', desc: '2:00 – 4:00 PM', icon: <Clock size={24} />, color: '#f59e0b' },
  ],
  STUDENT: [
    { title: 'Next Lecture', desc: 'Data Structures — 10:00 AM', icon: <GraduationCap size={24} />, color: '#3b82f6' },
    { title: 'My Schedule', desc: '5 classes today', icon: <Calendar size={24} />, color: '#8b5cf6' },
    { title: 'AI Assistant', desc: 'Ask about campus', icon: <MessageSquare size={24} />, color: '#10b981' },
    { title: 'Analytics', desc: 'Attendance: 92%', icon: <BarChart3 size={24} />, color: '#f59e0b' },
  ],
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const cards = user ? roleCards[user.role] || [] : [];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.firstName}!</h1>
        <p className="dashboard-subtitle">
          {user?.role === 'ADMIN' && 'System administration overview'}
          {user?.role === 'LECTURER' && 'Here\'s your day at a glance'}
          {user?.role === 'STUDENT' && 'Here\'s what\'s happening today'}
        </p>
      </div>

      <div className="dashboard-grid">
        {cards.map((card) => (
          <div key={card.title} className="dash-card">
            <div className="dash-card-icon" style={{ backgroundColor: card.color + '18', color: card.color }}>
              {card.icon}
            </div>
            <div className="dash-card-body">
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-info">
        <div className="info-card">
          <h3>Your Profile</h3>
          <table className="info-table">
            <tbody>
              <tr><td>Name</td><td>{user?.firstName} {user?.lastName}</td></tr>
              <tr><td>Email</td><td>{user?.email}</td></tr>
              <tr><td>Role</td><td><span className={`badge badge-${user?.role?.toLowerCase()}`}>{user?.role}</span></td></tr>
              <tr><td>Department</td><td>{user?.department?.name || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

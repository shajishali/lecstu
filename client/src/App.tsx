import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@store/authStore';
import Layout from '@components/Layout';
import ProtectedRoute from '@components/ProtectedRoute';
import ToastContainer from '@components/Toast';
import Login from '@pages/Login';
import Register from '@pages/Register';
import Dashboard from '@pages/Dashboard';
import Profile from '@pages/Profile';
import AdminDashboard from '@pages/admin/AdminDashboard';
import AdminApprovals from '@pages/admin/AdminApprovals';
import UserManagement from '@pages/admin/UserManagement';
import TimetableManagement from '@pages/admin/TimetableManagement';
import GroupManagement from '@pages/admin/GroupManagement';
import HallManagement from '@pages/admin/HallManagement';
import OfficeManagement from '@pages/admin/OfficeManagement';
import IndoorNavigationAdmin from '@pages/admin/IndoorNavigationAdmin';
import SimpleIndoorGuide from '@pages/SimpleIndoorGuide';
import TimetableRoute from '@components/TimetableRoute';
import LecturerMySchedule from '@pages/LecturerMySchedule';
import HallAvailability from '@pages/HallAvailability';
import LecturerDirectory from '@pages/LecturerDirectory';
import LecturerProfile from '@pages/LecturerProfile';
import Appointments from '@pages/Appointments';
import BookAppointment from '@pages/BookAppointment';
import Notifications from '@pages/Notifications';
import GuidedMap from '@pages/GuidedMap';
import VoiceAssistant from '@pages/VoiceAssistant';
import Settings from '@pages/admin/Settings';

/** Preserve query params when redirecting legacy /map links to /navigate. */
function MapLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const buildingId = searchParams.get('buildingId');
  const label =
    searchParams.get('q') ||
    searchParams.get('destination') ||
    searchParams.get('guide');
  const next = new URLSearchParams();
  if (buildingId) next.set('buildingId', buildingId);
  if (label) next.set('q', label);
  const qs = next.toString();
  return <Navigate to={qs ? `/navigate?${qs}` : '/navigate'} replace />;
}

/** Multi-leg “today” keeps Guided Map; other /map/guide links go to /navigate. */
function MapGuideEntry() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('today') === '1') return <GuidedMap />;
  return <MapLegacyRedirect />;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, getMe } = useAuthStore();

  useEffect(() => {
    getMe();
  }, [getMe]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading LECSTU...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/approvals"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminApprovals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/timetable"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <TimetableManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/halls"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <HallManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/courses"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <PlaceholderPage title="Course Management" phase="3.3" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/groups"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <GroupManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/offices"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <OfficeManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/navigation"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <IndoorNavigationAdmin />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/buildings" element={<Navigate to="/admin/navigation" replace />} />
        <Route path="/admin/markers" element={<Navigate to="/admin/navigation" replace />} />
        <Route path="/admin/indoor-markers" element={<Navigate to="/admin/navigation" replace />} />
        <Route path="/admin/indoor-nav" element={<Navigate to="/admin/navigation" replace />} />
        <Route path="/admin/indoor-nav/graph" element={<Navigate to="/admin/navigation" replace />} />

        <Route path="/timetable" element={<TimetableRoute />} />
        <Route
          path="/lecturer/schedule"
          element={
            <ProtectedRoute roles={['LECTURER']}>
              <LecturerMySchedule />
            </ProtectedRoute>
          }
        />
        <Route path="/halls/availability" element={<HallAvailability />} />
        <Route path="/lecturers" element={<LecturerDirectory />} />
        <Route path="/lecturers/:id" element={<LecturerProfile />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/book/:lecturerId" element={<BookAppointment />} />
        <Route path="/assistant" element={<VoiceAssistant />} />
        <Route path="/navigate" element={<SimpleIndoorGuide />} />
        <Route path="/map" element={<MapLegacyRedirect />} />
        <Route path="/map/scan" element={<Navigate to="/navigate" replace />} />
        <Route path="/map/guide" element={<MapGuideEntry />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center text-slate-500">
      <h2 className="mb-2 text-2xl text-slate-700">{title}</h2>
      <p>This feature is under development.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <AppRoutes />
    </BrowserRouter>
  );
}

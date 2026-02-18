import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import TimetableManagement from '@pages/admin/TimetableManagement';
import GroupManagement from '@pages/admin/GroupManagement';
import HallManagement from '@pages/admin/HallManagement';
import OfficeManagement from '@pages/admin/OfficeManagement';
import BuildingManagement from '@pages/admin/BuildingManagement';
import MarkerManagement from '@pages/admin/MarkerManagement';

function AppRoutes() {
  const { isAuthenticated, isLoading, getMe } = useAuthStore();

  useEffect(() => {
    getMe();
  }, [getMe]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading LECSTU...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      {/* Protected routes inside Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />

        {/* Admin-only routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <PlaceholderPage title="User Management" phase="3.5" />
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
          path="/admin/buildings"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <BuildingManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/markers"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <MarkerManagement />
            </ProtectedRoute>
          }
        />

        {/* Placeholder routes — to be built in later phases */}
        <Route path="/timetable" element={<PlaceholderPage title="Timetable" phase="3" />} />
        <Route path="/appointments" element={<PlaceholderPage title="Appointments" phase="4" />} />
        <Route path="/assistant" element={<PlaceholderPage title="AI Assistant" phase="8" />} />
        <Route path="/map" element={<PlaceholderPage title="Campus Map" phase="5" />} />
        <Route path="/notifications" element={<PlaceholderPage title="Notifications" phase="6" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" phase="6" />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="placeholder-page">
      <h2>{title}</h2>
      <p>This feature will be implemented in Phase {phase}.</p>
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

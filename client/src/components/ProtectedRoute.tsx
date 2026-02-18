import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import type { UserRole } from '../types/auth';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="forbidden-screen">
        <h1>403</h1>
        <p>You don't have permission to access this page.</p>
        <a href="/dashboard">Go to Dashboard</a>
      </div>
    );
  }

  return <>{children}</>;
}

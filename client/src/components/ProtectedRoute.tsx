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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-6xl font-bold text-red-500">403</h1>
        <p className="mb-4 text-slate-500">You don't have permission to access this page.</p>
        <a
          href="/dashboard"
          className="text-[var(--color-primary)] hover:underline"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import type { AuthRole } from '@/providers/AuthProvider';

type ProtectedRouteProps = {
  allowedRole?: AuthRole;
};

export function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { user, rol, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRole && rol !== allowedRole) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
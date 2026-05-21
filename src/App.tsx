import { useEffect } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, useNavigate } from 'react-router-dom';

import { SecretarioLayout } from '@/components/layout/SecretarioLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { DocenteLayout } from '@/components/layout/DocenteLayout';
import { useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { DocenteDashboardPage } from '@/features/docente/DashboardPage';
import { EstadoHoyPage } from '@/features/docente/EstadoHoyPage';
import { DeclararAsincronicaPage } from '@/features/docente/DeclararAsincronica';
import { EmergenciaFormPage } from '@/features/docente/EmergenciaForm';
import { SecretarioDashboardPage } from '@/features/secretario/DashboardPage';
import { CarrerasPage } from '@/features/secretario/academico/CarrerasPage';
import { MateriasPage } from '@/features/secretario/academico/MateriasPage';
import { AsignacionesPage } from '@/features/secretario/asignaciones/AsignacionesPage';
import { EmergenciasPage } from '@/features/secretario/emergencias/EmergenciasPage';
import { ImportacionPage } from '@/features/secretario/importacion/ImportacionPage';
import { ConfiguracionPage } from '@/features/secretario/configuracion/ConfiguracionPage';
import { ReportesPage } from '@/features/secretario/reportes/ReportesPage';
import SlotsPage from '@/features/secretario/academico/SlotsPage';
import CalendarioPage from '@/features/secretario/calendario/CalendarioPage';
import DocentesPage from '@/features/secretario/usuarios/DocentesPage';
import SecretariosPage from '@/features/secretario/usuarios/SecretariosPage';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">403</p>
        <h1 className="mt-3 text-3xl font-semibold text-primary">Acceso denegado</h1>
        <p className="mt-3 text-muted-foreground">No tenés permisos para ver esta sección.</p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, rol, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user || !rol) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={rol === 'docente' ? '/docente/dashboard' : '/secretario/dashboard'} replace />;
}

function LoginRedirectIfAuthenticated() {
  const { user, rol, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user && rol) {
      navigate(rol === 'docente' ? '/docente/dashboard' : '/secretario/dashboard', { replace: true });
    }
  }, [isLoading, navigate, rol, user]);

  return <LoginPage />;
}

export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Docente</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-brand-neutral p-6">
        <p className="text-sm text-muted-foreground">Esta sección queda lista para la próxima iteración funcional.</p>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/login',
    element: <LoginRedirectIfAuthenticated />,
  },
  {
    path: '/403',
    element: <AccessDeniedPage />,
  },
  {
    element: <ProtectedRoute allowedRole="docente" />,
    children: [
      {
        element: <DocenteLayout />,
        children: [
          {
            path: '/docente',
            element: <Navigate to="/docente/dashboard" replace />,
          },
          {
            path: '/docente/dashboard',
            element: <DocenteDashboardPage />,
          },
          {
            path: '/docente/asincronica',
            element: <DeclararAsincronicaPage />,
          },
          {
            path: '/docente/emergencia',
            element: <EmergenciaFormPage />,
          },
        ],
      },
      {
        path: '/chequeo',
        element: <EstadoHoyPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRole="secretario" />,
    children: [
      {
        element: <SecretarioLayout />,
        children: [
          {
            path: '/secretario',
            element: <Navigate to="/secretario/dashboard" replace />,
          },
          {
            path: '/secretario/dashboard',
            element: <SecretarioDashboardPage />,
          },
          {
            path: '/secretario/carreras',
            element: <CarrerasPage />,
          },
          {
            path: '/secretario/materias',
            element: <MateriasPage />,
          },
          {
            path: '/secretario/slots',
            element: <SlotsPage />,
          },
          {
            path: '/secretario/asignaciones',
            element: <AsignacionesPage />,
          },
          {
            path: '/secretario/calendario',
            element: <CalendarioPage />,
          },
          {
            path: '/secretario/docentes',
            element: <DocentesPage />,
          },
          {
            path: '/secretario/secretarios',
            element: <SecretariosPage />,
          },
          {
            path: '/secretario/emergencias',
            element: <EmergenciasPage />,
          },
          {
            path: '/secretario/reportes',
            element: <ReportesPage />,
          },
          {
            path: '/secretario/importacion',
            element: <ImportacionPage />,
          },
          {
            path: '/secretario/importacion-siu',
            element: <ImportacionPage />,
          },
          {
            path: '/secretario/configuracion',
            element: <ConfiguracionPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

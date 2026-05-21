import { GraduationCap, Home, LogOut, QrCode, TriangleAlert, Clock3 } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

type DocenteNavItem = {
  label: string;
  to: string;
  icon: typeof Home;
};

const navItems: DocenteNavItem[] = [
  { label: 'Inicio', to: '/docente/dashboard', icon: Home },
  { label: 'Escanear QR', to: '/chequeo', icon: QrCode },
  { label: 'Clase Asincrónica', to: '/docente/asincronica', icon: Clock3 },
  { label: 'Emergencia', to: '/docente/emergencia', icon: TriangleAlert },
];

export function DocenteLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/docente/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-primary">ICES</p>
              <p className="text-xs text-muted-foreground">Control docente</p>
            </div>
          </NavLink>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">{user ? `${user.first_name} ${user.last_name}` : 'Docente'}</p>
              <p className="text-xs text-muted-foreground">Sesión activa</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/98 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Icon className="mb-1 h-4 w-4" />
                <span className="text-center leading-none">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

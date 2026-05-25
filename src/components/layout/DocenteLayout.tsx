import { Home, LogOut, QrCode, TriangleAlert, Clock3 } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/ices-superior.svg';

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
    <div className="min-h-screen bg-brand-neutral text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#162839]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <NavLink to="/docente/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7FAF9] shadow-sm overflow-hidden p-1 border border-white/10">
                <img src={logo} alt="ICES Logo" className="h-full w-full object-contain" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">ICES</p>
                <p className="text-xs text-[#b5c8df]">Control docente</p>
              </div>
            </NavLink>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[#0060ac] text-white shadow-sm'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user ? `${user.first_name} ${user.last_name}` : 'Docente'}</p>
              <p className="text-xs text-[#b5c8df]">Sesión activa</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hidden sm:inline-flex border-white/20 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="sm:hidden text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#162839]/98 px-2 py-2 backdrop-blur md:hidden">
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
                    isActive
                      ? 'bg-[#0060ac] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white',
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

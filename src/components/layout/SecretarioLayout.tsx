import { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LogOut,
  Settings2,
  ShieldAlert,
  UserCog,
  Users,
  Menu,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/ices-superior.svg';

type SidebarGroup = {
  label: string;
  items: Array<{
    label: string;
    to: string;
    icon: typeof GraduationCap;
  }>;
};

const sidebarGroups: SidebarGroup[] = [
  {
    label: 'Académico',
    items: [
      { label: 'Carreras', to: '/secretario/carreras', icon: GraduationCap },
      { label: 'Materias', to: '/secretario/materias', icon: BookOpen },
      { label: 'Calendario', to: '/secretario/calendario', icon: CalendarDays },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Emergencias', to: '/secretario/emergencias', icon: ShieldAlert },
      { label: 'Reportes', to: '/secretario/reportes', icon: FileText },
      { label: 'Importación SIU', to: '/secretario/importacion', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Usuarios',
    items: [
      { label: 'Docentes', to: '/secretario/docentes', icon: Users },
      { label: 'Secretarios', to: '/secretario/secretarios', icon: UserCog },
    ],
  },
  {
    label: 'Sistema',
    items: [{ label: 'Configuración', to: '/secretario/configuracion', icon: Settings2 }],
  },
];

export function SecretarioLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNavigation = (onItemClick?: () => void) => (
    <nav className="space-y-5">
      {sidebarGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#96a9be]">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-[#0060ac] text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-brand-neutral text-foreground lg:flex">
      {/* Mobile Sidebar Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300',
          mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-white/10 bg-[#162839] transition-transform duration-300 ease-in-out lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-20 items-center justify-between gap-3 border-b border-white/10 px-6">
          <a
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-white/80 hover:bg-white/10 hover:text-white"
            href="/secretario/dashboard"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7FAF9] shadow-sm overflow-hidden p-1.5 border border-white/10">
              <img src={logo} alt="ICES Logo" className="h-full w-full object-contain" />
            </div>

            <div>
              <p className="text-sm font-semibold text-white">ICES Admin</p>
              <p className="text-xs text-[#b5c8df]">Control Institucional</p>
            </div>
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {renderNavigation(() => setMobileSidebarOpen(false))}
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-[#162839] lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-white/80 hover:bg-white/10 hover:text-white" href="/secretario/dashboard">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7FAF9] shadow-sm overflow-hidden p-1.5 border border-white/10">
              <img src={logo} alt="ICES Logo" className="h-full w-full object-contain" />
            </div>

            <div>
              <p className="text-sm font-semibold text-white">ICES Admin</p>
              <p className="text-xs text-[#b5c8df]">Control Institucional</p>
            </div>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {renderNavigation()}
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-80">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#162839]/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              <div>
                <p className="text-sm font-medium text-[#b5c8df]">Secretaría</p>
                <h1 className="text-lg font-semibold text-white">Panel institucional</h1>
              </div>
            </div>

            <div className="relative">
              <Button variant="outline" className="hidden gap-2 md:inline-flex border-white/20 text-white hover:bg-white/10 hover:text-white bg-transparent" onClick={() => setMenuOpen((value) => !value)}>
                <span className="max-w-48 truncate">{user ? `${user.first_name} ${user.last_name}` : 'Usuario'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10 hover:text-white" onClick={() => setMenuOpen((value) => !value)}>
                <Users className="h-4 w-4" />
              </Button>

              {menuOpen ? (
                <Card className="absolute right-0 top-12 z-50 w-56 border-white/10 bg-[#2C3E50] p-2 shadow-lg">
                  <div className="px-3 py-2 text-sm text-white">
                    <p className="font-medium text-white">{user ? `${user.first_name} ${user.last_name}` : 'Usuario autenticado'}</p>
                    <p className="text-xs text-[#b5c8df]">{user?.rol ?? 'secretario'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-white/10"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </Button>
                </Card>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

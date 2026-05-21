import { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers3,
  LogOut,
  Settings2,
  ShieldAlert,
  UserCog,
  Users,
  ClipboardList,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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
      { label: 'Horarios', to: '/secretario/slots', icon: Layers3 },
      { label: 'Asignaciones', to: '/secretario/asignaciones', icon: ClipboardList },
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

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-neutral text-foreground lg:flex">
      <aside className="hidden w-80 shrink-0 border-r border-border bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground" href="/secretario/carreras">
                      
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          
          <div>
            <p className="text-sm font-semibold text-primary">ICES Admin</p>
            <p className="text-xs text-muted-foreground">Institutional Control</p>
          </div>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <nav className="space-y-5">
            {sidebarGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
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
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-80">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Secretaría</p>
              <h1 className="text-lg font-semibold text-primary">Panel institucional</h1>
            </div>

            <div className="relative">
              <Button variant="outline" className="hidden gap-2 md:inline-flex" onClick={() => setMenuOpen((value) => !value)}>
                <span className="max-w-48 truncate">{user ? `${user.first_name} ${user.last_name}` : 'Usuario'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((value) => !value)}>
                <Users className="h-4 w-4" />
              </Button>

              {menuOpen ? (
                <Card className="absolute right-0 top-12 z-50 w-56 border-border bg-card p-2 shadow-lg">
                  <div className="px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{user ? `${user.first_name} ${user.last_name}` : 'Usuario autenticado'}</p>
                    <p className="text-xs text-muted-foreground">{user?.rol ?? 'secretario'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
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

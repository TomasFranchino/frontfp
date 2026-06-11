import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, GraduationCap, Users, CalendarDays, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MateriaDocentesTab } from './MateriaDocentesTab';
import { MateriaHorariosTab } from './MateriaHorariosTab';

// Temporarily import the Materia type or define it here if we don't have it globally exported.
type CarreraResumen = {
  id: number;
  codigo: string;
  nombre: string;
};

export type Materia = {
  id: number;
  codigo_siu: string;
  nombre: string;
  anio: number;
  activa: boolean;
  carreras: CarreraResumen[];
};

// We create a function to fetch the single materia. Note: this endpoint might need to be created in the backend if it doesn't exist,
// or we can fetch all and filter for now. Assuming `/academico/materias/:id` exists.
async function fetchMateria(id: string): Promise<Materia> {
  const { data } = await api.get<Materia>(`/academico/materias/${id}`);
  return data;
}

export function MateriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'docentes' | 'horarios'>('info');

  const { data: materia, isLoading, isError } = useQuery({
    queryKey: ['academico', 'materias', id],
    queryFn: () => fetchMateria(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !materia) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-destructive mb-4">Error al cargar la materia o no encontrada.</p>
        <Button variant="outline" onClick={() => navigate('/secretario/materias')}>Volver a Materias</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen -m-4 sm:-m-6 lg:-m-8">
      {/* Sticky Header with Tabs */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 pt-6 pb-0">
        <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
          {/* Breadcrumb / Title Area */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0"
              onClick={() => navigate('/secretario/materias')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground bg-muted/50">
                  {materia.codigo_siu}
                </Badge>
                {materia.activa ? (
                  <Badge variant="secondary" className="border-green-200 bg-green-100 text-green-700 font-normal text-xs">
                    Activa
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="border-border bg-muted text-muted-foreground font-normal text-xs">
                    Inactiva
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">{materia.nombre}</h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                {materia.carreras.length > 0 
                  ? materia.carreras.map(c => c.codigo).join(', ') 
                  : 'Sin carreras asignadas'}
                <span className="text-border">•</span>
                {materia.anio}º Año
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-6 mt-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'info' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Info className="h-4 w-4" />
              Información General
            </button>
            <button
              onClick={() => setActiveTab('docentes')}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'docentes' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Users className="h-4 w-4" />
              Cuerpo Docente
            </button>
            <button
              onClick={() => setActiveTab('horarios')}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'horarios' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Horarios
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-muted/20">
        <div className="max-w-6xl mx-auto w-full">
          {activeTab === 'info' && (
            <div className="grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-semibold text-primary">Información General</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Nombre</p>
                    <p className="font-medium text-foreground">{materia.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Código SIU</p>
                    <p className="font-medium text-foreground">{materia.codigo_siu}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Año de cursado</p>
                    <p className="font-medium text-foreground">{materia.anio}º Año</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Estado</p>
                    <p className="font-medium text-foreground">{materia.activa ? 'Activa' : 'Inactiva'}</p>
                  </div>
                </div>
              </div>
              
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <h2 className="text-lg font-semibold text-primary">Carreras Asociadas</h2>
                  <Badge variant="outline" className="bg-muted/50">{materia.carreras.length}</Badge>
                </div>
                {materia.carreras.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay carreras asociadas a esta materia.</p>
                ) : (
                  <div className="space-y-3 pt-2">
                    {materia.carreras.map((carrera) => (
                      <div key={carrera.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <p className="font-medium text-sm text-foreground">{carrera.codigo}</p>
                        <p className="text-xs text-muted-foreground">{carrera.nombre}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'docentes' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm min-h-[300px]">
                 <MateriaDocentesTab materiaId={materia.id} />
              </div>
            </div>
          )}

          {activeTab === 'horarios' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm min-h-[300px]">
                 <MateriaHorariosTab materiaId={materia.id} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

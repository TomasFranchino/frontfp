import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowRight, 
  FileSpreadsheet, 
  Users, 
  Settings, 
  CalendarRange, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  GraduationCap, 
  AlertTriangle,
  BookOpen,
  Calendar,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

type DocenteEnAula = {
  docente_id: number;
  docente_nombre: string;
  materia_nombre: string;
  hora_entrada: string;
  tipo_clase: string;
  ubicacion_validada: boolean | null;
};

type DashboardStats = {
  docentes_activos: number;
  emergencias_pendientes: number;
  clases_hoy: number;
  docentes_en_aula: DocenteEnAula[];
};

type SolicitudEmergencia = {
  id: number;
  docente_nombre: string;
  materia_nombre: string;
  fecha: string;
  estado: string;
  nota_docente: string;
};

async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/auth/secretario/dashboard-stats');
  return data;
}

async function fetchEmergenciasPendientes(): Promise<SolicitudEmergencia[]> {
  const { data } = await api.get<SolicitudEmergencia[]>('/asistencia/admin/emergencias/pendientes');
  return data;
}

type ResolverEmergenciaPayload = {
  id: number;
  aprobar: boolean;
  nota_secretaria: string;
};

async function resolverEmergencia({ id, aprobar, nota_secretaria }: ResolverEmergenciaPayload): Promise<void> {
  await api.patch(`/asistencia/admin/emergencias/${id}/resolver`, {
    aprobar,
    nota_secretaria,
  });
}

const resolverEmergenciaSchema = z.object({
  nota_secretaria: z.string().min(1, 'La nota de Secretaría es obligatoria.'),
});

type ResolverEmergenciaFormValues = z.infer<typeof resolverEmergenciaSchema>;

export function SecretarioDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudEmergencia | null>(null);
  const [approvalIntent, setApprovalIntent] = useState<boolean>(true);

  // Fetch de estadísticas con refresco automático cada 30 segundos
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['secretario', 'dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // 30 segundos
  });

  // Fetch de emergencias pendientes
  const { data: emergencias, isLoading: emergenciasLoading } = useQuery({
    queryKey: ['asistencia', 'admin', 'emergencias', 'pendientes'],
    queryFn: fetchEmergenciasPendientes,
  });

  const form = useForm<ResolverEmergenciaFormValues>({
    resolver: zodResolver(resolverEmergenciaSchema) as any,
    defaultValues: {
      nota_secretaria: '',
    },
  });

  const resolverMutation = useMutation({
    mutationFn: resolverEmergencia,
    onSuccess: () => {
      toast.success(approvalIntent ? 'Emergencia aprobada correctamente.' : 'Emergencia rechazada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['secretario', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'admin', 'emergencias', 'pendientes'] });
      setSelectedSolicitud(null);
      form.reset({ nota_secretaria: '' });
    },
  });

  const handleOpenResolver = (solicitud: SolicitudEmergencia, aprobar: boolean) => {
    setSelectedSolicitud(solicitud);
    setApprovalIntent(aprobar);
    form.reset({ nota_secretaria: '' });
  };

  const handleCloseResolver = () => {
    setSelectedSolicitud(null);
    form.reset({ nota_secretaria: '' });
  };

  const onSubmit = (values: ResolverEmergenciaFormValues) => {
    if (!selectedSolicitud) return;
    resolverMutation.mutate({
      id: selectedSolicitud.id,
      aprobar: approvalIntent,
      nota_secretaria: values.nota_secretaria,
    });
  };

  const kpis = [
    {
      label: 'Docentes Activos',
      value: stats?.docentes_activos ?? 0,
      description: 'Usuarios habilitados en el sistema',
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      link: '/secretario/docentes',
    },
    {
      label: 'Clases Hoy',
      value: stats?.clases_hoy ?? 0,
      description: 'Bloques horarios programados para hoy',
      icon: CalendarRange,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      link: '/secretario/slots',
    },
    {
      label: 'Docentes en Aula',
      value: stats?.docentes_en_aula.length ?? 0,
      description: 'Fichajes de entrada activos actualmente',
      icon: Activity,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      isLive: (stats?.docentes_en_aula.length ?? 0) > 0,
    },
    {
      label: 'Emergencias Pendientes',
      value: stats?.emergencias_pendientes ?? 0,
      description: 'Reportes técnicos que requieren revisión',
      icon: ShieldAlert,
      color: (stats?.emergencias_pendientes ?? 0) > 0 
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse border border-rose-200 dark:border-rose-900/50' 
        : 'bg-gray-500/10 text-gray-500 dark:text-gray-400',
      link: '/secretario/emergencias',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tarjeta de bienvenida premium */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/0 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-primary" />
              Secretaría Académica
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-primary tracking-tight">
              Bienvenido{user ? `, ${user.first_name} ${user.last_name}` : ''}.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Monitoreá el dictado de clases en tiempo real, resolvé incidencias técnicas de fichaje al instante y accedé a la configuración global del campus.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground self-start md:self-auto border border-border/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Monitoreo en vivo activo
          </div>
        </div>
      </section>

      {/* Rejilla de KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border bg-card shadow-sm">
              <CardHeader className="space-y-2 pb-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
            </Card>
          ))
        ) : statsError ? (
          <div className="col-span-4 rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
            Error al conectar con el servidor. Por favor, reintentá más tarde.
          </div>
        ) : (
          kpis.map((kpi) => {
            const Icon = kpi.icon;
            const CardWrapper = kpi.link ? Link : 'div';

            return (
              <Card 
                key={kpi.label} 
                className={`border-border bg-card shadow-sm transition-all duration-300 ${
                  kpi.link ? 'hover:scale-[1.02] hover:shadow-md hover:border-primary/20' : ''
                }`}
              >
                <CardWrapper to={kpi.link || ''} className="block h-full">
                  <CardHeader className="space-y-4 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {kpi.label}
                        </CardDescription>
                        <CardTitle className="text-4xl font-bold tracking-tight flex items-center gap-2">
                          {kpi.value}
                          {kpi.isLive && (
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                          )}
                        </CardTitle>
                      </div>
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${kpi.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/30">
                      {kpi.description}
                    </p>
                  </CardHeader>
                </CardWrapper>
              </Card>
            );
          })
        )}
      </section>

      {/* Grid Principal: Docentes en Aula vs Alertas */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Monitoreo en Aula (Izquierda) */}
        <Card className="border-border bg-card shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-500" />
                Docentes en Aula
              </CardTitle>
              <CardDescription>Seguimiento de clases que están dictándose hoy.</CardDescription>
            </div>
            {stats && stats.docentes_en_aula.length > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                {stats.docentes_en_aula.length} Activos
              </span>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {statsLoading ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !stats || stats.docentes_en_aula.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-12 text-muted-foreground h-full min-h-[250px]">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <p className="font-medium text-sm text-foreground">No hay clases activas</p>
                <p className="text-xs max-w-xs mt-1">Los docentes que realicen fichaje de entrada aparecerán aquí al instante.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[400px]">
                {stats.docentes_en_aula.map((docente) => (
                  <div key={docente.docente_id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{docente.docente_nombre}</p>
                        <p className="text-xs text-muted-foreground">{docente.materia_nombre}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-medium text-foreground">Entrada</p>
                        <p className="text-xs text-muted-foreground">{docente.hora_entrada} hs</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary capitalize border border-primary/20">
                          {docente.tipo_clase.replace('_', ' ')}
                        </span>
                        
                        {/* Validación GPS / WiFi */}
                        {docente.ubicacion_validada === true ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-200/50">
                            <MapPin className="h-3 w-3" /> OK
                          </span>
                        ) : docente.ubicacion_validada === false ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-medium bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-200/50">
                            <AlertTriangle className="h-3 w-3" /> Fuera de Rango
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                            Manual
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergencias / Alertas Activas (Derecha) */}
        <Card className="border-border bg-card shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alertas Activas
              </CardTitle>
              <CardDescription>Incidentes técnicos notificados por docentes que requieren resolver.</CardDescription>
            </div>
            {emergencias && emergencias.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 animate-pulse">
                {emergencias.length} Pendientes
              </span>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {emergenciasLoading ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !emergencias || emergencias.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-12 text-muted-foreground h-full min-h-[250px]">
                <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/20 p-4 mb-4 border border-emerald-100 dark:border-emerald-900/50">
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="font-medium text-sm text-foreground">¡Todo en orden!</p>
                <p className="text-xs max-w-xs mt-1">No hay alertas ni emergencias técnicas pendientes de revisión.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[400px]">
                {emergencias.map((solicitud) => (
                  <div key={solicitud.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-primary">{solicitud.docente_nombre}</p>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {solicitud.fecha}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground mt-0.5">{solicitud.materia_nombre}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-green-200 hover:bg-green-50 text-green-600 hover:text-green-700 flex items-center gap-1"
                          onClick={() => handleOpenResolver(solicitud, true)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 flex items-center gap-1"
                          onClick={() => handleOpenResolver(solicitud, false)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                    {solicitud.nota_docente && (
                      <p className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/30 text-muted-foreground whitespace-normal leading-relaxed italic">
                        "{solicitud.nota_docente}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Sección de Accesos Rápidos Premium */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Acciones Frecuentes de Gestión
          </h3>
          <p className="text-xs text-muted-foreground">Accesos directos a los distintos módulos configurados en el campus.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border bg-card hover:border-primary/30 transition-all hover:shadow-sm duration-300">
            <Link to="/secretario/reportes" className="block p-5 space-y-3 h-full">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Reportes de Asistencia</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generar estadísticas por carrera, materia y docente.
                </p>
              </div>
            </Link>
          </Card>

          <Card className="border-border bg-card hover:border-primary/30 transition-all hover:shadow-sm duration-300">
            <Link to="/secretario/importacion" className="block p-5 space-y-3 h-full">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ArrowRight className="h-5 w-5 rotate-[-45deg]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Importar Excel SIU</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sincronizar horarios, comisiones y asignaciones docentes.
                </p>
              </div>
            </Link>
          </Card>

          <Card className="border-border bg-card hover:border-primary/30 transition-all hover:shadow-sm duration-300">
            <Link to="/secretario/configuracion" className="block p-5 space-y-3 h-full">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Parámetros Ubicación</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configurar radio GPS de tolerancia y redes WiFi de firma.
                </p>
              </div>
            </Link>
          </Card>

          <Card className="border-border bg-card hover:border-primary/30 transition-all hover:shadow-sm duration-300">
            <Link to="/secretario/calendario" className="block p-5 space-y-3 h-full">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Calendario Académico</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Establecer feriados o eventos sin cómputo de ausencias.
                </p>
              </div>
            </Link>
          </Card>

          <Card className="border-border bg-card hover:border-primary/30 transition-all hover:shadow-sm duration-300">
            <Link to="/secretario/docentes" className="block p-5 space-y-3 h-full">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Gestionar Docentes</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Administrar legajos, activar/desactivar y reestablecer claves.
                </p>
              </div>
            </Link>
          </Card>
        </div>
      </section>

      {/* Diálogo de resolución rápida */}
      <Dialog open={Boolean(selectedSolicitud)} onOpenChange={(open) => (open ? null : handleCloseResolver())}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{approvalIntent ? 'Aprobar emergencia' : 'Rechazar emergencia'}</DialogTitle>
            <DialogDescription>
              {selectedSolicitud
                ? `${selectedSolicitud.docente_nombre} - ${selectedSolicitud.materia_nombre} (${selectedSolicitud.fecha})`
                : 'Resolvé la solicitud seleccionada.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nota_secretaria">Nota de Secretaría</Label>
              <Textarea
                id="nota_secretaria"
                {...form.register('nota_secretaria')}
                placeholder={approvalIntent ? 'Ej: Se aprueba la regularización.' : 'Ej: No corresponde por falta de documentación.'}
              />
              {form.formState.errors.nota_secretaria ? (
                <p className="text-xs text-destructive">{form.formState.errors.nota_secretaria.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseResolver}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={resolverMutation.isPending}
                className={approvalIntent ? 'bg-green-600 text-white hover:bg-green-700' : ''}
                variant={approvalIntent ? 'default' : 'destructive'}
              >
                {approvalIntent ? 'Aprobar' : 'Rechazar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

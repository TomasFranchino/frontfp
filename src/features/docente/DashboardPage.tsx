import * as React from 'react';
import { ArrowRight, CalendarRange, Clock3, GraduationCap, QrCode, AlertCircle, Loader2, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import api from '@/lib/api';
import { getLocalDateString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type ClaseHoy = {
  slot_id: number;
  carreras_codigos: string;
  materia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
};

type EstadoHoy = {
  tiene_entrada_activa: boolean;
  materia_actual: string | null;
  hora_entrada: string | null;
};

type HistorialClase = {
  fecha: string;
  tipo: string;
  estado: string;
  detalle: string;
};

type MateriaStats = {
  materia_id: number;
  materia_nombre: string;
  materia_anio: number;
  carreras_codigos: string;
  dias_cursada: string[];
  asistencias: number;
  asincronicas: number;
  faltas: number;
  historial: HistorialClase[];
};

const asincronicaSchema = z.object({
  slot_horario_id: z.coerce.number().min(1, 'Debés seleccionar una clase.'),
  fecha_dictado: z.string().min(1, 'La fecha es obligatoria.'),
  nota: z.string().min(5, 'Por favor provee un detalle mínimo de la clase.'),
}).refine(data => {
  const getOffsetDateStr = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return getLocalDateString(d);
  };
  const min = getOffsetDateStr(-7);
  const max = getOffsetDateStr(7);
  return data.fecha_dictado >= min && data.fecha_dictado <= max;
}, {
  message: "La fecha debe estar entre 7 días en el pasado y 7 días en el futuro.",
  path: ["fecha_dictado"]
});

type AsincronicaValues = z.infer<typeof asincronicaSchema>;

const emergenciaSchema = z.object({
  slot_horario_id: z.coerce.number().optional().or(z.literal(0)),
  nota_docente: z.string().min(10, 'Por favor explicá detalladamente el problema o incidencia.'),
  fecha: z.string().min(1, 'La fecha es obligatoria.'),
});

type EmergenciaValues = z.infer<typeof emergenciaSchema>;

export function DocenteDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isAsincronicaOpen, setIsAsincronicaOpen] = React.useState(false);
  const [isEmergenciaOpen, setIsEmergenciaOpen] = React.useState(false);
  const [selectedMateriaStats, setSelectedMateriaStats] = React.useState<MateriaStats | null>(null);

  const minDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalDateString(d);
  }, []);

  const maxDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getLocalDateString(d);
  }, []);

  const todayStr = React.useMemo(() => {
    return getLocalDateString();
  }, []);

  // Queries
  const { data: estadoHoy, isLoading: isEstadoLoading } = useQuery({
    queryKey: ['asistencia', 'estado_hoy'],
    queryFn: async () => {
      const { data } = await api.get<EstadoHoy>('/asistencia/estado_hoy');
      return data;
    },
  });

  const { data: materiasStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['asistencia', 'mis_materias_stats'],
    queryFn: async () => {
      const { data } = await api.get<MateriaStats[]>('/asistencia/mis_materias_stats');
      return data;
    },
  });

  const { data: clasesHoy, isLoading: isClasesHoyLoading } = useQuery({
    queryKey: ['asistencia', 'mis_clases_hoy', todayStr],
    queryFn: async () => {
      const { data } = await api.get<ClaseHoy[]>('/asistencia/mis_clases_hoy', {
        params: { fecha: todayStr }
      });
      return data;
    },
  });

  // Forms
  const asincronicaForm = useForm<AsincronicaValues>({
    resolver: zodResolver(asincronicaSchema) as any,
    defaultValues: {
      slot_horario_id: 0,
      fecha_dictado: getLocalDateString(),
      nota: '',
    },
  });

  const emergenciaForm = useForm<EmergenciaValues>({
    resolver: zodResolver(emergenciaSchema) as any,
    defaultValues: {
      slot_horario_id: 0,
      nota_docente: '',
      fecha: getLocalDateString(),
    },
  });

  const watchAsyncFecha = asincronicaForm.watch('fecha_dictado') || getLocalDateString();
  const { data: clasesAsyncFecha, isLoading: isClasesAsyncLoading } = useQuery({
    queryKey: ['asistencia', 'mis_clases_hoy', watchAsyncFecha],
    queryFn: async () => {
      const { data } = await api.get<ClaseHoy[]>('/asistencia/mis_clases_hoy', {
        params: { fecha: watchAsyncFecha }
      });
      return data;
    },
    enabled: isAsincronicaOpen,
  });

  const watchEmergFecha = emergenciaForm.watch('fecha') || getLocalDateString();
  const { data: clasesEmergFecha, isLoading: isClasesEmergLoading } = useQuery({
    queryKey: ['asistencia', 'mis_clases_hoy', watchEmergFecha],
    queryFn: async () => {
      const { data } = await api.get<ClaseHoy[]>('/asistencia/mis_clases_hoy', {
        params: { fecha: watchEmergFecha }
      });
      return data;
    },
    enabled: isEmergenciaOpen,
  });

  // Mutations
  const asincronicaMutation = useMutation({
    mutationFn: async (payload: AsincronicaValues) => {
      const { data } = await api.post('/asistencia/asincronica/declarar', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Clase asincrónica declarada correctamente.');
      setIsAsincronicaOpen(false);
      asincronicaForm.reset();
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'mis_materias_stats'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'mis_clases_hoy'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.mensaje || err.response?.data?.detail || 'Ocurrió un error al declarar la clase.';
      toast.error(msg);
    }
  });

  const emergenciaMutation = useMutation({
    mutationFn: async (payload: EmergenciaValues) => {
      const dataToSend = {
        ...payload,
        slot_horario_id: payload.slot_horario_id === 0 ? undefined : payload.slot_horario_id,
      };
      const { data } = await api.post('/asistencia/emergencias', dataToSend);
      return data;
    },
    onSuccess: () => {
      toast.success('Incidencia reportada. La secretaría revisará tu solicitud.');
      setIsEmergenciaOpen(false);
      emergenciaForm.reset();
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'mis_materias_stats'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.mensaje || err.response?.data?.detail || 'Ocurrió un error al enviar el reporte.';
      toast.error(msg);
    }
  });

  const selectedValue = asincronicaForm.watch('slot_horario_id');
  const selectedEmergSlot = emergenciaForm.watch('slot_horario_id');

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header de bienvenida */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Hola{user ? `, ${user.first_name}` : ''} 👋
          </h1>
          <p className="text-muted-foreground">Este es tu panel de control de jornada docente.</p>
        </div>
        <div className="text-sm font-medium text-muted-foreground bg-muted/50 rounded-xl px-4 py-2 self-start md:self-auto">
          Hoy es {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* 2. Banner de Estado y Acciones */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

        {/* Card Estado de Hoy */}
        <Card className="relative overflow-hidden border-border bg-card shadow-md transition-all hover:shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="h-4 w-4 text-primary" />
              Estado de Fichaje Actual
            </div>

            {isEstadoLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : estadoHoy?.tiene_entrada_activa ? (
              <div>
                <CardTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Clase en curso
                </CardTitle>
                <p className="text-muted-foreground mt-1">
                  Dictando <span className="font-bold text-foreground">{estadoHoy.materia_actual}</span>.
                  Ingreso registrado a las <span className="font-bold text-foreground">{estadoHoy.hora_entrada}hs</span>.
                </p>
              </div>
            ) : (
              <div>
                <CardTitle className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Listo para ingresar (Presencial o Virtual Síncrona).
                </CardTitle>
                <p className="text-muted-foreground mt-1">
                  No tenés entradas activas actualmente. Podés registrar tu entrada al llegar al aula.
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            {isEstadoLoading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : (
              <Button
                className={`h-12 w-full justify-between px-5 text-base font-medium shadow-md transition-all ${estadoHoy?.tiene_entrada_activa
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/10'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10'
                  }`}
                onClick={() => navigate('/chequeo')}
              >
                <span className="flex items-center gap-3">
                  <QrCode className="h-5 w-5" />
                  {estadoHoy?.tiene_entrada_activa ? 'Fichar Salida (Escanear QR)' : 'Fichar Entrada (Escanear QR)'}
                </span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Acceso Rápido */}
        <Card className="border-border bg-brand-neutral/40 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">Acciones de Autogestión</CardTitle>
            <CardDescription>Firmá clases asincrónicas o reportá incidencias sin moverte de aquí.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              variant="outline"
              className="justify-between bg-card hover:bg-muted"
              onClick={() => setIsAsincronicaOpen(true)}
            >
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-blue-500" />
                Declarar Clase Asincrónica
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="justify-between bg-card hover:bg-muted"
              onClick={() => setIsEmergenciaOpen(true)}
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Reportar Emergencia / Alerta
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 3. Sección de Clases de Hoy */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Mi agenda para hoy</h2>
          <p className="text-sm text-muted-foreground">Clases programadas para el día de la fecha.</p>
        </div>

        {isClasesHoyLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={`skeleton-clase-${index}`} className="border-border bg-card shadow-sm">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-4/5" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : clasesHoy && clasesHoy.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clasesHoy.map((clase) => (
              <Card key={clase.slot_id} className="border-border bg-card shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex min-w-0 max-w-[80%] items-start gap-2">
                    <CardTitle className="min-w-0 truncate text-base font-bold text-foreground">
                      {clase.materia_nombre}
                    </CardTitle>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
                      {clase.carreras_codigos || 'Sin carrera'}
                    </span>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-2.5">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    <span>{clase.hora_inicio} - {clase.hora_fin} hs</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-border bg-card/50 shadow-none">
            <CardHeader className="text-center py-6">
              <CardTitle className="text-lg font-medium text-muted-foreground">No tenés clases asignadas hoy</CardTitle>
              <CardDescription>Si necesitás registrar un movimiento fuera de cronograma, acercate a Preceptoría.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      {/* 4. Sección "Mis Materias Asignadas" */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Mis Materias Asignadas</h2>
          <p className="text-sm text-muted-foreground">Consultá las materias que tenés a cargo, sus días de cursada y el historial acumulado.</p>
        </div>

        {isStatsLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={`skeleton-stats-${index}`} className="border-border bg-card shadow-sm">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : materiasStats && materiasStats.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {materiasStats.map((stats) => (
              <Card key={stats.materia_id} className="border-border bg-card shadow-md flex flex-col justify-between transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold text-foreground">{stats.materia_nombre}</CardTitle>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {stats.carreras_codigos || 'Sin carrera'}
                        </span>
                      </div>
                      <CardDescription className="text-xs mt-0.5">Año: {stats.materia_anio}° Año</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-primary/20 text-primary">Asignado</Badge>
                  </div>

                  {/* Días de cursada */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {stats.dias_cursada.map((dia, idx) => (
                      <span key={idx} className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                        {dia}
                      </span>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Fila de contadores */}
                  <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-emerald-600">{stats.asistencias}</span>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Asistencias</span>
                    </div>
                    <div className="flex flex-col border-x border-border/60">
                      <span className="text-2xl font-bold text-blue-600">{stats.asincronicas}</span>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Asíncronas</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-rose-600">{stats.faltas}</span>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Faltas</span>
                    </div>
                  </div>

                  {/* Botón Ver Historial */}
                  <Button
                    variant="outline"
                    className="w-full h-10 gap-2 border-border/80 hover:bg-muted"
                    onClick={() => setSelectedMateriaStats(stats)}
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                    Ver historial detallado
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-border bg-card/50 shadow-none">
            <CardHeader className="text-center py-6">
              <CardTitle className="text-lg font-medium text-muted-foreground">No tenés materias asignadas activas</CardTitle>
              <CardDescription>Si esto es un error, comunicate con la secretaría académica.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      {/* 1. Modal Historial Detallado */}
      <Dialog open={!!selectedMateriaStats} onOpenChange={(open) => !open && setSelectedMateriaStats(null)}>
        {selectedMateriaStats && (
          <DialogContent className="max-w-md md:max-w-lg max-h-[85vh] flex flex-col p-6 rounded-2xl bg-card border-border">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Asistencia
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Materia: <span className="font-semibold text-foreground">{selectedMateriaStats.materia_nombre}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {selectedMateriaStats.historial.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay clases históricas registradas desde la fecha de inicio.
                </div>
              ) : (
                selectedMateriaStats.historial.map((hist, idx) => {
                  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                  if (hist.estado === "Presente") badgeVariant = "default";
                  else if (hist.estado.includes("Asíncrona")) badgeVariant = "secondary";
                  else if (hist.estado === "Ausente") badgeVariant = "destructive";

                  return (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-xl border border-border p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground text-sm">
                          {new Date(hist.fecha + "T00:00:00").toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <Badge variant={badgeVariant} className="font-medium">
                          {hist.estado}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground flex justify-between items-center mt-1">
                        <span>Modalidad: <strong className="text-foreground">{hist.tipo}</strong></span>
                        <span className="italic">{hist.detalle}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button onClick={() => setSelectedMateriaStats(null)} className="w-full rounded-xl">
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* 2. Modal Declarar Asincrónica */}
      <Dialog open={isAsincronicaOpen} onOpenChange={setIsAsincronicaOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-card border-border">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-blue-500" />
              Declarar Clase Asincrónica
            </DialogTitle>
            <DialogDescription className="text-xs">
              Declará el dictado de una clase a distancia sin escaneo de código QR.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={asincronicaForm.handleSubmit((vals) => asincronicaMutation.mutate(vals))}
            className="space-y-4 pt-4"
          >
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold" htmlFor="async_slot_horario_id">Clase del Día</Label>
              {isClasesAsyncLoading ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : !clasesAsyncFecha || clasesAsyncFecha.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground bg-muted/30">
                  No tenés clases programadas para la fecha seleccionada.
                </div>
              ) : (
                <Select
                  value={selectedValue ? selectedValue.toString() : ''}
                  onValueChange={(val) => asincronicaForm.setValue('slot_horario_id', Number(val), { shouldValidate: true })}
                >
                  <SelectTrigger id="async_slot_horario_id" className="h-10 w-full rounded-lg text-sm bg-background">
                    <SelectValue placeholder="Seleccioná la materia..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clasesAsyncFecha.map((clase) => (
                      <SelectItem key={clase.slot_id} value={clase.slot_id.toString()}>
                        {clase.materia_nombre} {clase.carreras_codigos ? `(${clase.carreras_codigos})` : '(Sin carrera)'} ({clase.hora_inicio} - {clase.hora_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {asincronicaForm.formState.errors.slot_horario_id && (
                <p className="text-xs text-destructive">{asincronicaForm.formState.errors.slot_horario_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold" htmlFor="async_fecha_dictado">Fecha de dictado</Label>
              <Input
                id="async_fecha_dictado"
                type="date"
                min={minDateStr}
                max={maxDateStr}
                className="h-10 rounded-lg text-sm bg-background"
                {...asincronicaForm.register('fecha_dictado')}
              />
              {asincronicaForm.formState.errors.fecha_dictado && (
                <p className="text-xs text-destructive">{asincronicaForm.formState.errors.fecha_dictado.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold" htmlFor="async_nota">Detalles / Nota</Label>
              <Textarea
                id="async_nota"
                placeholder="Ej: Subí el trabajo práctico al campus virtual y definí lecturas obligatorias."
                className="min-h-[90px] rounded-lg resize-none text-sm bg-background"
                {...asincronicaForm.register('nota')}
              />
              {asincronicaForm.formState.errors.nota && (
                <p className="text-xs text-destructive">{asincronicaForm.formState.errors.nota.message}</p>
              )}
            </div>

            <DialogFooter className="pt-2 border-t flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsAsincronicaOpen(false); asincronicaForm.reset(); }}
                className="w-full sm:w-1/2 rounded-lg"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-1/2 rounded-lg gap-1"
                disabled={asincronicaMutation.isPending || (!clasesAsyncFecha?.length && !isClasesAsyncLoading)}
              >
                {asincronicaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Clock3 className="h-4 w-4" />
                    Declarar Clase
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Modal Reportar Emergencia */}
      <Dialog open={isEmergenciaOpen} onOpenChange={setIsEmergenciaOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-card border-border">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Reportar Emergencia / Alerta
            </DialogTitle>
            <DialogDescription className="text-xs">
              Notificá inmediatamente a Secretaría problemas técnicos o ausencias imprevistas.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={emergenciaForm.handleSubmit((vals) => emergenciaMutation.mutate(vals))}
            className="space-y-4 pt-4"
          >
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold" htmlFor="emergencia_fecha">Fecha de la Ausencia / Incidencia</Label>
              <Input
                id="emergencia_fecha"
                type="date"
                className="h-10 rounded-lg text-sm bg-background"
                {...emergenciaForm.register('fecha')}
              />
              {emergenciaForm.formState.errors.fecha && (
                <p className="text-xs text-destructive">{emergenciaForm.formState.errors.fecha.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold" htmlFor="emergencia_slot_horario_id">Clase Afectada (Opcional)</Label>
              {isClasesEmergLoading ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : (
                <Select
                  value={selectedEmergSlot ? selectedEmergSlot.toString() : '0'}
                  onValueChange={(val) => emergenciaForm.setValue('slot_horario_id', Number(val), { shouldValidate: true })}
                >
                  <SelectTrigger id="emergencia_slot_horario_id" className="h-10 w-full rounded-lg text-sm bg-background">
                    <SelectValue placeholder="General / Sin materia asignada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Toda la jornada / General</SelectItem>
                    {clasesEmergFecha?.map((clase) => (
                      <SelectItem key={clase.slot_id} value={clase.slot_id.toString()}>
                        {clase.materia_nombre} {clase.carreras_codigos ? `(${clase.carreras_codigos})` : '(Sin carrera)'} ({clase.hora_inicio} - {clase.hora_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">Si el inconveniente es global o abarca todo el día, déjalo en General.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-destructive" htmlFor="emergencia_nota_docente">Motivo / Explicación</Label>
              <Textarea
                id="emergencia_nota_docente"
                placeholder="Ej: No pude asistir debido a una urgencia médica / No aparezco como docente debido a un problema técnico."
                className="min-h-[110px] rounded-lg resize-none text-sm border-destructive/20 focus-visible:ring-destructive focus-visible:border-transparent bg-background"
                {...emergenciaForm.register('nota_docente')}
              />
              {emergenciaForm.formState.errors.nota_docente && (
                <p className="text-xs text-destructive">{emergenciaForm.formState.errors.nota_docente.message}</p>
              )}
            </div>

            <DialogFooter className="pt-2 border-t flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsEmergenciaOpen(false); emergenciaForm.reset(); }}
                className="w-full sm:w-1/2 rounded-lg"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="w-full sm:w-1/2 rounded-lg gap-1"
                disabled={emergenciaMutation.isPending}
              >
                {emergenciaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Enviar Reporte
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

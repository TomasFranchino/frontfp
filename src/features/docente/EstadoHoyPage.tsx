import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  AlertTriangle,
  Fingerprint,
  LogOut,
  CheckCircle2,
  XCircle,
  Wifi,
  Clock,
  BookOpen,
  User,
  Laptop,
  AlertCircle
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

import api from '@/lib/api';
import { getLocalDateString } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// --- SCHEMAS DE VALIDADORES (ZOD) ---
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

type AsincronicaValues = z.output<typeof asincronicaSchema>;
type AsincronicaInput = z.input<typeof asincronicaSchema>;

const emergenciaSchema = z.object({
  slot_horario_id: z.coerce.number().optional().or(z.literal(0)),
  nota_docente: z.string().min(10, 'Por favor explicá detalladamente el problema.'),
  fecha: z.string().min(1, 'La fecha es obligatoria.'),
});

type EmergenciaValues = z.output<typeof emergenciaSchema>;
type EmergenciaInput = z.input<typeof emergenciaSchema>;

// --- TIPOS ---
type ProximaClase = {
  materia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  fichable_desde: string;
};

type EstadoHoy = {
  tiene_entrada_activa: boolean;
  materia_actual: string | null;
  hora_entrada: string | null;
  clase_vigente: string | null;
  proxima_clase: ProximaClase | null;
  metodo_validacion: 'gps_o_wifi' | 'solo_gps' | 'solo_wifi' | null;
};

type FichajePayload = {
  latitud: number | null;
  longitud: number | null;
  tipo_clase?: 'presencial' | 'virtual_sincronica' | 'asincronica';
};

type FichajeResponse = {
  success: boolean;
  estado_flujo: 'exito' | 'error_gps' | 'error_wifi' | 'error_ubicacion' | 'error_horario' | 'duplicado' | 'sin_clases';
  gps_ok: boolean | null;
  wifi_ok: boolean | null;
  materia: string | null;
  docente_nombre: string | null;
  hora_fichada: string | null;
  tipo_clase: 'presencial' | 'virtual_sincronica' | 'asincronica' | null;
  mensaje: string;
};

type ClaseHoy = {
  slot_id: number;
  carreras_codigos: string;
  materia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
};

export function EstadoHoyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estados locales para el flujo de fichaje
  const [resultadoFichaje, setResultadoFichaje] = React.useState<FichajeResponse | null>(null);

  // Modales
  const [isAsincronicaOpen, setIsAsincronicaOpen] = React.useState(false);
  const [isEmergenciaOpen, setIsEmergenciaOpen] = React.useState(false);

  // Hook de geolocalización (se ejecuta al montar)
  const { location, error: geoError, isLoading: isGeoLoading, refetch: reloadGeolocation } = useGeolocation();

  // Traer estado actual
  const {
    data: estado,
    isLoading: isEstadoLoading,
    isError: isEstadoError,
  } = useQuery({
    queryKey: ['asistencia', 'estado_hoy'],
    queryFn: async () => {
      const { data } = await api.get<EstadoHoy>('/asistencia/estado_hoy');
      return data;
    },
  });

  // Forms de los modales inline
  const asincronicaForm = useForm<AsincronicaInput, unknown, AsincronicaValues>({
    resolver: zodResolver(asincronicaSchema),
    defaultValues: {
      slot_horario_id: 0,
      fecha_dictado: getLocalDateString(),
      nota: '',
    },
  });

  const emergenciaForm = useForm<EmergenciaInput, unknown, EmergenciaValues>({
    resolver: zodResolver(emergenciaSchema),
    defaultValues: {
      slot_horario_id: 0,
      nota_docente: '',
      fecha: getLocalDateString(),
    },
  });

  // Carga de clases para los modales
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

  const selectedAsyncSlotId = Number(asincronicaForm.watch('slot_horario_id') || 0);

  // Mutación: Fichar Entrada
  const entradaMutation = useMutation({
    mutationFn: async (payload: FichajePayload) => {
      const { data } = await api.post<FichajeResponse>('/asistencia/chequeoprofesor/entrada', payload, {
        headers: { 'X-Skip-Toast': '1' }
      });
      return data;
    },
    onSuccess: (data) => {
      setResultadoFichaje(data);
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
    },
    onError: (err: AxiosError<{ success?: boolean; mensaje?: string }>) => {
      const errorData = err.response?.data;
      if (errorData && 'success' in errorData) {
        setResultadoFichaje(errorData as FichajeResponse);
        queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
      } else {
        toast.error(err.response?.data?.mensaje || 'Error al registrar la entrada.');
      }
    }
  });

  // Mutación: Fichar Salida
  const salidaMutation = useMutation({
    mutationFn: async (payload: FichajePayload) => {
      const { data } = await api.post<FichajeResponse>('/asistencia/chequeoprofesor/salida', payload, {
        headers: { 'X-Skip-Toast': '1' }
      });
      return data;
    },
    onSuccess: (data) => {
      setResultadoFichaje(data);
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
    },
    onError: (err: AxiosError<{ success?: boolean; mensaje?: string }>) => {
      const errorData = err.response?.data;
      if (errorData && 'success' in errorData) {
        setResultadoFichaje(errorData as FichajeResponse);
        queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
      } else {
        toast.error(err.response?.data?.mensaje || 'Error al registrar la salida.');
      }
    }
  });

  // Mutación: Declarar Clase Asincrónica
  const asincronicaMutation = useMutation({
    mutationFn: async (payload: AsincronicaValues) => {
      const { data } = await api.post('/asistencia/asincronica/declarar', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Clase asincrónica declarada correctamente.');
      setIsAsincronicaOpen(false);
      asincronicaForm.reset();
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
      navigate('/docente/dashboard');
    },
    onError: (err: AxiosError<{ mensaje?: string; detail?: string }>) => {
      const msg = err.response?.data?.mensaje || err.response?.data?.detail || 'Error al declarar la clase.';
      toast.error(msg);
    }
  });

  // Mutación: Reportar Emergencia
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
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
      navigate('/docente/dashboard');
    },
    onError: (err: AxiosError<{ mensaje?: string; detail?: string }>) => {
      const msg = err.response?.data?.mensaje || err.response?.data?.detail || 'Error al enviar el reporte.';
      toast.error(msg);
    }
  });

  // Handler para fichar presencial
  const handleFicharPresencial = () => {
    const payload: FichajePayload = {
      latitud: location ? location.lat : null,
      longitud: location ? location.lng : null,
      tipo_clase: 'presencial',
    };

    if (estado?.tiene_entrada_activa) {
      salidaMutation.mutate(payload);
    } else {
      entradaMutation.mutate(payload);
    }
  };

  // Handler para fichar Virtual Sincrónica
  const handleFicharVirtualSincronica = () => {
    const payload: FichajePayload = {
      latitud: null,
      longitud: null,
      tipo_clase: 'virtual_sincronica',
    };
    entradaMutation.mutate(payload);
  };

  // --- RENDERS ---

  // 1. CARGANDO GLOBAL
  if (isEstadoLoading || (isGeoLoading && !resultadoFichaje)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#162839] px-4 text-center select-none relative overflow-y-auto py-6">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none z-0" />
        <div className="absolute w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none z-0" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-lg backdrop-blur">
            <Loader2 className="absolute h-16 w-16 animate-spin text-blue-500" />
            <MapPin className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h2 className="mt-8 text-2xl font-bold tracking-tight text-white">
            {isGeoLoading ? 'Obteniendo tu ubicación...' : 'Cargando estado de asistencia...'}
          </h2>
          <p className="mt-2 text-slate-400 font-medium">Por favor, espera un momento.</p>
        </div>
      </div>
    );
  }

  // Verificar si hay errores críticos de conexión
  if (isEstadoError || !estado) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#162839] text-white select-none relative overflow-y-auto py-6">
        <header className="relative z-10 flex h-16 items-center px-4 border-b border-white/10 bg-[#0e1b26] shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => navigate('/docente/dashboard')} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="ml-4 text-lg font-semibold">Fichaje Docente</h1>
        </header>
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md bg-slate-900/60 border border-red-500/20 rounded-2xl p-8 backdrop-blur shadow-2xl flex flex-col items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Error de Conexión</h2>
              <p className="text-sm text-slate-400 mt-2">
                No pudimos establecer comunicación con el servidor para obtener tu estado actual.
              </p>
            </div>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/15" onClick={() => window.location.reload()}>
              Reintentar Conexión
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // 2. DETECTAR ESTADOS DEL FLUJO

  const isSalida = estado.tiene_entrada_activa;
  const materiaPantalla = isSalida ? estado.materia_actual : estado.clase_vigente;

  const renderContent = () => {
    // A. PANTALLA DE ÉXITO (resultadoFichaje.success === true)
    if (resultadoFichaje && resultadoFichaje.success) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[#162839] text-white select-none relative overflow-y-auto py-6">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-emerald-950/20 to-transparent pointer-events-none z-0" />
          <div className="absolute w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none z-0" />

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-[420px] bg-slate-900/85 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 border border-slate-800 flex flex-col gap-6 items-center backdrop-blur">

              {/* Tick animado */}
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-inner animate-fade-in">
                <CheckCircle2 className="h-14 w-14 text-emerald-500 animate-pulse" />
                <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping pointer-events-none" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white">
                  ¡Fichaje Completado!
                </h2>
                <p className="text-emerald-400 font-semibold text-sm mt-1">
                  {resultadoFichaje.mensaje}
                </p>
              </div>

              {/* Detalles en Glassmorphism */}
              <div className="w-full bg-slate-950/50 rounded-xl border border-slate-800/80 p-5 text-left space-y-3.5 text-sm">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4.5 w-4.5 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-500 block font-medium">Materia</span>
                    <span className="font-semibold text-slate-200">{resultadoFichaje.materia}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4.5 w-4.5 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-500 block font-medium">Docente</span>
                    <span className="font-semibold text-slate-200">{resultadoFichaje.docente_nombre}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4.5 w-4.5 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-500 block font-medium">Hora de registro</span>
                    <span className="font-semibold text-slate-200">{resultadoFichaje.hora_fichada} hs</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Laptop className="h-4.5 w-4.5 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-500 block font-medium">Modalidad</span>
                    <span className="capitalize font-semibold text-slate-200">
                      {resultadoFichaje.tipo_clase === 'virtual_sincronica' ? 'Virtual Sincrónica' : resultadoFichaje.tipo_clase}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sensores de ubicación */}
              {resultadoFichaje.tipo_clase === 'presencial' && (
                <div className="flex justify-center gap-4 w-full border-t border-slate-800/80 pt-4">
                  {resultadoFichaje.gps_ok !== null && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs">
                      <span className={cn("h-1.5 w-1.5 rounded-full", resultadoFichaje.gps_ok ? "bg-emerald-500" : "bg-red-500")} />
                      <span className="text-slate-400">GPS {resultadoFichaje.gps_ok ? 'Válido' : 'Inválido'}</span>
                    </div>
                  )}
                  {resultadoFichaje.wifi_ok !== null && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs">
                      <span className={cn("h-1.5 w-1.5 rounded-full", resultadoFichaje.wifi_ok ? "bg-emerald-500" : "bg-red-500")} />
                      <span className="text-slate-400">Red WiFi {resultadoFichaje.wifi_ok ? 'Válida' : 'Inválida'}</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/15 font-semibold py-6 text-base"
                onClick={() => {
                  setResultadoFichaje(null);
                  navigate('/docente/dashboard');
                }}
              >
                Cerrar
              </Button>
            </div>
          </main>
        </div>
      );
    }

    // B. PANTALLA DE ERROR POR UBICACIÓN (resultadoFichaje.success === false && error GPS/WiFi/Ubicacion)
    if (resultadoFichaje && !resultadoFichaje.success && ['error_gps', 'error_wifi', 'error_ubicacion'].includes(resultadoFichaje.estado_flujo)) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[#162839] text-white select-none relative overflow-y-auto">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-red-950/20 to-transparent pointer-events-none z-0" />
          <div className="absolute w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none z-0" />

          <header className="relative z-10 flex h-16 items-center px-4 border-b border-white/10 bg-[#0e1b26] shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setResultadoFichaje(null)} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="ml-4 text-lg font-semibold">Error de Ubicación</h1>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center my-4">
            <div className="w-full max-w-[420px] bg-slate-900/85 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 border border-slate-800 flex flex-col gap-5 items-center backdrop-blur">

              {/* Indicadores de error */}
              <div className="flex gap-6 justify-center w-full">
                {resultadoFichaje.gps_ok !== null && (
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border shadow-inner transition-all",
                      resultadoFichaje.gps_ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-red-500/10 border-red-500/30 text-red-500 animate-shake"
                    )}>
                      {resultadoFichaje.gps_ok ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">GPS {resultadoFichaje.gps_ok ? 'Válido' : 'Error'}</span>
                  </div>
                )}
                {resultadoFichaje.wifi_ok !== null && (
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border shadow-inner transition-all",
                      resultadoFichaje.wifi_ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-red-500/10 border-red-500/30 text-red-500 animate-shake"
                    )}>
                      {resultadoFichaje.wifi_ok ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">WiFi {resultadoFichaje.wifi_ok ? 'Válido' : 'Error'}</span>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Validación de Ubicación Fallida
                </h2>
                <p className="text-sm text-slate-400 mt-2 max-w-[320px] mx-auto">
                  No pudimos verificar que te encuentres dentro de las instalaciones del campus de ICES.
                </p>
              </div>

              {/* Mensaje de error del backend */}
              <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-center text-xs text-red-200 font-medium">
                {resultadoFichaje.mensaje}
              </div>

              {/* Alternativas sugeridas */}
              <div className="w-full flex flex-col gap-2.5 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider text-left">Alternativas Disponibles</span>

                <Button
                  variant="outline"
                  className="w-full h-11 justify-start rounded-xl border-slate-800 bg-slate-950/30 text-slate-200 hover:bg-slate-900 text-xs font-semibold gap-3"
                  onClick={() => setIsAsincronicaOpen(true)}
                >
                  <Wifi className="h-4.5 w-4.5 text-blue-400" />
                  Declarar Clase Asincrónica
                </Button>

                {/* Botón Virtual Sincrónica - solo disponible para entradas con clase vigente */}
                {!estado.tiene_entrada_activa && estado.clase_vigente && (
                  <Button
                    variant="outline"
                    className="w-full h-11 justify-start rounded-xl border-slate-800 bg-slate-950/30 text-slate-200 hover:bg-slate-900 text-xs font-semibold gap-3"
                    onClick={handleFicharVirtualSincronica}
                    disabled={entradaMutation.isPending}
                  >
                    {entradaMutation.isPending ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <Laptop className="h-4.5 w-4.5 text-blue-400" />
                    )}
                    Registrar Virtual Sincrónica
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full h-11 justify-start rounded-xl border-slate-800 bg-slate-950/30 text-slate-200 hover:bg-slate-900 text-xs font-semibold gap-3"
                  onClick={() => setIsEmergenciaOpen(true)}
                >
                  <AlertCircle className="h-4.5 w-4.5 text-red-400" />
                  Reportar Inconveniente / Emergencia
                </Button>

                <Button
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs mt-2.5"
                  onClick={() => {
                    setResultadoFichaje(null);
                    reloadGeolocation();
                  }}
                >
                  Reintentar Ubicación Presencial
                </Button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // C. PANTALLA DE ERROR OTRO (resultadoFichaje.success === false && error Horario/Duplicado)
    if (resultadoFichaje && !resultadoFichaje.success) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[#162839] text-white select-none relative overflow-y-auto py-6">
          <header className="relative z-10 flex h-16 items-center px-4 border-b border-white/10 bg-[#0e1b26] shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setResultadoFichaje(null)} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="ml-4 text-lg font-semibold">Error de Fichaje</h1>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-[400px] bg-slate-900/85 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 border border-slate-800 flex flex-col gap-6 items-center backdrop-blur">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Inconveniente al Registrar</h2>
                <p className="text-sm text-slate-400 mt-2">{resultadoFichaje.mensaje}</p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/15"
                onClick={() => {
                  setResultadoFichaje(null);
                  navigate('/docente/dashboard');
                }}
              >
                Volver al Panel de Control
              </Button>
            </div>
          </main>
        </div>
      );
    }

    // D. SIN CLASES ACTIVAS NI PRÓXIMAS HOY (sin_clases)
    if (!estado.tiene_entrada_activa && !estado.clase_vigente && !estado.proxima_clase) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[#162839] text-white select-none relative overflow-y-auto">
          <header className="relative z-10 flex h-16 items-center px-4 border-b border-white/10 bg-[#0e1b26] shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => navigate('/docente/dashboard')} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="ml-4 text-lg font-semibold">Registro de Asistencia</h1>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-[400px] bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur shadow-2xl flex flex-col items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                <CalendarCircleFallback />
              </div>
              <div>
                <h2 className="text-xl font-bold">Sin Clases Programadas</h2>
                <p className="text-sm text-slate-400 mt-2">
                  No tenés fichajes pendientes o clases programadas para el día de hoy.
                </p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/15"
                onClick={() => navigate('/docente/dashboard')}
              >
                Volver al Panel de Control
              </Button>
              <div>
                <p className="text-sm text-slate-400 pb-2">¿Debería haber clase programada?</p>
                <Button
                  variant="outline"
                  className="w-full h-11 justify-start rounded-xl border-slate-800 bg-slate-950/30 text-slate-200 hover:bg-slate-900 text-xs font-semibold gap-3"
                  onClick={() => setIsEmergenciaOpen(true)}
                >
                  <AlertCircle className="h-4.5 w-4.5 text-red-400" />
                  Reportar Inconveniente / Emergencia
                </Button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // E. PRÓXIMA CLASE PROGRAMADA (PRÓXIMAMENTE)
    if (!estado.tiene_entrada_activa && !estado.clase_vigente && estado.proxima_clase) {
      const pc = estado.proxima_clase;
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[#162839] text-white select-none relative overflow-y-auto">
          <header className="relative z-10 flex h-16 items-center px-4 border-b border-white/10 bg-[#0e1b26] shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => navigate('/docente/dashboard')} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="ml-4 text-lg font-semibold">Registro de Asistencia</h1>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-[400px] bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur shadow-2xl flex flex-col gap-6 items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Clock className="h-8 w-8 animate-pulse" />
              </div>

              <div>
                <h2 className="text-xl font-bold">Fichaje no Disponible Aún</h2>
                <p className="text-sm text-slate-400 mt-2">
                  La próxima clase programada es hoy más tarde.
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Recordá: Podés declarar la clase como asincrónica desde el panel de control.
                </p>
              </div>

              {/* Tarjeta de Próxima Clase */}
              <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-left space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Próxima Clase</span>
                  <span className="text-blue-400 text-xs font-bold">Pendiente</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-medium">Materia</span>
                  <span className="font-bold text-slate-200 text-base">{pc.materia_nombre}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block font-medium">Horario</span>
                    <span className="font-semibold text-slate-300">{pc.hora_inicio} - {pc.hora_fin} hs</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block font-medium">Habilitado desde</span>
                    <span className="font-semibold text-slate-300">{pc.fichable_desde} hs</span>
                  </div>
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/15"
                onClick={() => navigate('/docente/dashboard')}
              >
                Volver al Panel de Control
              </Button>
            </div>
          </main>
        </div>
      );
    }

    // F. ESTADO LISTO PARA FICHAR ENTRADA/SALIDA (READY)
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#162839] font-sans text-white select-none relative overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none z-0" />
        <div className="absolute w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none z-0" />

        {/* HEADER */}
        <header className="relative z-10 flex h-16 items-center px-4 border-b border-white/10 bg-[#0e1b26] shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/docente/dashboard')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="ml-4 text-lg font-semibold">Registro de Asistencia</h1>
        </header>

        {/* CONTENIDO */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center my-4">

          {/* Error de geolocalización no bloqueante */}
          {geoError && (
            <Alert variant="destructive" className="mb-6 max-w-md text-left border-red-500/20 bg-red-500/10 text-red-200">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertTitle className="font-semibold">Problema de Geolocalización</AlertTitle>
              <AlertDescription className="text-red-300 text-xs">{geoError}</AlertDescription>
            </Alert>
          )}

          <div className="w-full max-w-[400px] bg-slate-900/85 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 border border-slate-800 flex flex-col gap-6 items-center backdrop-blur">

            {/* Indicadores de Sensores (Pre-fichaje) */}
            <div className="flex gap-6 justify-center w-full">
              {/* GPS */}
              {(estado.metodo_validacion === 'gps_o_wifi' || estado.metodo_validacion === 'solo_gps') && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border shadow-inner transition-all duration-300",
                    location
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-emerald-500/5"
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  )}>
                    <MapPin className={cn("h-6 w-6", location && "animate-pulse")} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    GPS {location ? 'Disponible' : 'Cargando'}
                  </span>
                </div>
              )}

              {/* WiFi */}
              {(estado.metodo_validacion === 'gps_o_wifi' || estado.metodo_validacion === 'solo_wifi') && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-inner">
                    <Wifi className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    WiFi Listo
                  </span>
                </div>
              )}
            </div>

            {/* Información de la Clase */}
            <div className="w-full space-y-3.5 flex flex-col items-center border-t border-b border-slate-800 py-5">
              <div className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full shadow-inner border transition-all duration-500",
                isSalida
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-500"
              )}>
                {isSalida ? <LogOut className="h-8 w-8" /> : <Fingerprint className="h-8 w-8" />}
              </div>

              <div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                  Clase Detectada
                </span>
                <h2 className="text-xl font-bold tracking-tight text-white mt-1">
                  {materiaPantalla}
                </h2>
                {isSalida && estado.hora_entrada && (
                  <p className="text-xs text-slate-400 mt-1">
                    Ingreso registrado a las <strong className="text-slate-200">{estado.hora_entrada} hs</strong>
                  </p>
                )}
                {!isSalida && (
                  <p className="text-xs text-slate-400 mt-1">
                    Registra tu entrada presencial en el campus
                  </p>
                )}
              </div>
            </div>

            {/* BOTÓN GIGANTE DE FICHAJE */}
            <Button
              className={cn(
                "h-16 w-full shadow-lg transition-all rounded-xl text-base font-bold flex items-center justify-center gap-3 border tracking-wide uppercase duration-300",
                isSalida
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white border-red-700/50 shadow-red-500/10'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-700/50 shadow-blue-500/10'
              )}
              onClick={handleFicharPresencial}
              disabled={entradaMutation.isPending || salidaMutation.isPending}
            >
              {entradaMutation.isPending || salidaMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : isSalida ? (
                <>
                  <LogOut className="h-5 w-5" />
                  Registrar Salida
                </>
              ) : (
                <>
                  <Fingerprint className="h-5 w-5" />
                  Registrar Entrada
                </>
              )}
            </Button>

            {/* Botones de fallback si el GPS falló antes de fichar */}
            {geoError && (
              <div className="w-full space-y-2 border-t border-slate-800/80 pt-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block text-left">Alternativas</span>

                <Button
                  variant="outline"
                  className="w-full h-10 justify-start rounded-xl border-slate-800 bg-slate-950/20 text-slate-200 text-xs font-semibold gap-3 hover:bg-slate-950"
                  onClick={() => setIsAsincronicaOpen(true)}
                >
                  <Wifi className="h-4 w-4 text-blue-400" />
                  Declarar Clase Asincrónica
                </Button>

                {!isSalida && (
                  <Button
                    variant="outline"
                    className="w-full h-10 justify-start rounded-xl border-slate-800 bg-slate-950/20 text-slate-200 text-xs font-semibold gap-3 hover:bg-slate-950"
                    onClick={handleFicharVirtualSincronica}
                    disabled={entradaMutation.isPending}
                  >
                    <Laptop className="h-4 w-4 text-blue-400" />
                    Registrar Virtual Sincrónica
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full h-10 justify-start rounded-xl border-slate-800 bg-slate-950/20 text-slate-200 text-xs font-semibold gap-3 hover:bg-slate-950"
                  onClick={() => setIsEmergenciaOpen(true)}
                >
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  Reportar Inconveniente
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* ========================================== */}
      {/* 2. MODAL DECLARAR ASINCRÓNICA */}
      {/* ========================================== */}
      <Dialog open={isAsincronicaOpen} onOpenChange={setIsAsincronicaOpen}>
        <DialogContent className="grid-cols-1 max-w-md p-6 rounded-2xl bg-slate-900 border-slate-800 text-white">
          <DialogHeader className="pb-2 border-b border-slate-800">
            <DialogTitle className="text-lg font-bold text-blue-400 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Declarar Clase Asincrónica
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Declara el dictado de una clase a distancia sin escaneo de código QR.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={asincronicaForm.handleSubmit((vals) => asincronicaMutation.mutate(vals))}
            className="space-y-4 pt-4"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300" htmlFor="async_slot_horario_id">Clase del Día</Label>
              {isClasesAsyncLoading ? (
                <Skeleton className="h-10 w-full rounded-lg bg-slate-850" />
              ) : !clasesAsyncFecha || clasesAsyncFecha.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500 bg-slate-950/50">
                  No tenés clases programadas para la fecha seleccionada.
                </div>
              ) : (
                <Select
                  value={selectedAsyncSlotId ? selectedAsyncSlotId.toString() : ''}
                  onValueChange={(val) => asincronicaForm.setValue('slot_horario_id', Number(val), { shouldValidate: true })}
                >
                  <SelectTrigger
                    id="async_slot_horario_id"
                    className="h-10 w-full rounded-lg text-xs bg-slate-950 border-slate-800 text-slate-200 data-[placeholder]:text-slate-400"
                  >
                    <SelectValue placeholder="Seleccioná la materia..." className="text-slate-400" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-white">
                    {clasesAsyncFecha.map((clase) => (
                      <SelectItem key={clase.slot_id} value={clase.slot_id.toString()} className="hover:bg-slate-900 focus:bg-slate-900">
                        {clase.materia_nombre} {clase.carreras_codigos ? `(${clase.carreras_codigos})` : '(Sin carrera)'} ({clase.hora_inicio} - {clase.hora_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {asincronicaForm.formState.errors.slot_horario_id && (
                <p className="text-xs text-red-400">{asincronicaForm.formState.errors.slot_horario_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300" htmlFor="async_fecha_dictado">Fecha de dictado</Label>
              <Input
                id="async_fecha_dictado"
                type="date"
                min={minDateStr}
                max={maxDateStr}
                className="h-10 rounded-lg text-xs bg-slate-950 border-slate-800 text-slate-200 [color-scheme:dark]"
                {...asincronicaForm.register('fecha_dictado')}
              />
              {asincronicaForm.formState.errors.fecha_dictado && (
                <p className="text-xs text-red-400">{asincronicaForm.formState.errors.fecha_dictado.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300" htmlFor="async_nota">Detalles / Nota</Label>
              <Textarea
                id="async_nota"
                placeholder="Ej: Dejé el trabajo práctico en el campus virtual."
                className="min-h-[90px] rounded-lg resize-none text-xs bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-blue-500 focus-visible:border-transparent"
                {...asincronicaForm.register('nota')}
              />
              {asincronicaForm.formState.errors.nota && (
                <p className="text-xs text-red-400">{asincronicaForm.formState.errors.nota.message}</p>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800 bg-slate-900 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsAsincronicaOpen(false); asincronicaForm.reset(); }}
                className="w-full sm:w-1/2 rounded-lg border-slate-800 text-slate-300 bg-slate-900 hover:bg-slate-950 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-1/2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/10"
                disabled={asincronicaMutation.isPending || (!clasesAsyncFecha?.length && !isClasesAsyncLoading)}
              >
                {asincronicaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Declarar Clase'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================== */}
      {/* 3. MODAL REPORTAR EMERGENCIA */}
      {/* ========================================== */}
      <Dialog open={isEmergenciaOpen} onOpenChange={setIsEmergenciaOpen}>
        <DialogContent className="grid-cols-1 max-w-md p-6 rounded-2xl bg-slate-900 border-slate-800 text-white">
          <DialogHeader className="pb-2 border-b border-slate-800">
            <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Reportar Incidencia
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Notifica a Secretaría sobre problemas técnicos o demoras imprevistas.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={emergenciaForm.handleSubmit((vals) => emergenciaMutation.mutate(vals))}
            className="space-y-4 pt-4"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300" htmlFor="emergencia_fecha">Fecha de Incidencia</Label>
              <Input
                id="emergencia_fecha"
                type="date"
                className="h-10 rounded-lg text-xs bg-slate-950 border-slate-800 text-slate-200 [color-scheme:dark]"
                {...emergenciaForm.register('fecha')}
              />
              {emergenciaForm.formState.errors.fecha && (
                <p className="text-xs text-red-400">{emergenciaForm.formState.errors.fecha.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300" htmlFor="emergencia_slot_horario_id">Clase Afectada (Opcional)</Label>
              {isClasesEmergLoading ? (
                <Skeleton className="h-10 w-full rounded-lg bg-slate-850" />
              ) : (
                <Select
                  value={emergenciaForm.watch('slot_horario_id') ? String(emergenciaForm.watch('slot_horario_id')) : '0'}
                  onValueChange={(val) => emergenciaForm.setValue('slot_horario_id', Number(val), { shouldValidate: true })}
                >
                  <SelectTrigger id="emergencia_slot_horario_id" className="h-10 w-full rounded-lg text-xs bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="General / Sin materia asignada" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-white">
                    <SelectItem value="0">Toda la jornada / General</SelectItem>
                    {clasesEmergFecha?.map((clase) => (
                      <SelectItem key={clase.slot_id} value={clase.slot_id.toString()} className="hover:bg-slate-900 focus:bg-slate-900">
                        {clase.materia_nombre} {clase.carreras_codigos ? `(${clase.carreras_codigos})` : '(Sin carrera)'} ({clase.hora_inicio} - {clase.hora_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-slate-500">Si el inconveniente abarca todo el día, seleccioná General.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-red-400" htmlFor="emergencia_nota_docente">Motivo / Explicación</Label>
              <Textarea
                id="emergencia_nota_docente"
                placeholder="Explicá detalladamente la incidencia..."
                className="min-h-[110px] rounded-lg resize-none text-xs bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-red-500 focus-visible:border-transparent"
                {...emergenciaForm.register('nota_docente')}
              />
              {emergenciaForm.formState.errors.nota_docente && (
                <p className="text-xs text-red-400">{emergenciaForm.formState.errors.nota_docente.message}</p>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800 bg-slate-900 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsEmergenciaOpen(false); emergenciaForm.reset(); }}
                className="w-full sm:w-1/2 rounded-lg border-slate-800 text-slate-300 bg-slate-900 hover:bg-slate-950 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="w-full sm:w-1/2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/10"
                disabled={emergenciaMutation.isPending}
              >
                {emergenciaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Enviar Reporte'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Fallback Icons
function CalendarCircleFallback() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MapPin, AlertTriangle, Fingerprint, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- TIPOS ---
type EstadoHoy = {
  tiene_entrada_activa: boolean;
  materia_actual: string | null;
  hora_entrada: string | null;
};

type FichajePayload = {
  latitud: number;
  longitud: number;
  tipo_clase?: 'presencial' | 'virtual_sincronica' | 'asincronica';
};

export function EstadoHoyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Hook de geolocalización (se ejecuta al montar)
  const { location, error: geoError, isLoading: isGeoLoading } = useGeolocation();

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

  // Mutación: Fichar Entrada
  const entradaMutation = useMutation({
    mutationFn: async (payload: FichajePayload) => {
      const { data } = await api.post('/asistencia/chequeoprofesor/entrada', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('¡Entrada fichada con éxito!');
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
    },
  });

  // Mutación: Fichar Salida
  const salidaMutation = useMutation({
    mutationFn: async (payload: FichajePayload) => {
      const { data } = await api.post('/asistencia/chequeoprofesor/salida', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('¡Salida fichada con éxito!');
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'estado_hoy'] });
      // Opcional: Redirigir al inicio después de salir
      // navigate('/docente/dashboard');
    },
  });

  // Acción del botón
  const handleFichar = () => {
    if (!location) {
      toast.error('Ubicación no disponible.');
      return;
    }

    const payload: FichajePayload = {
      latitud: location.lat,
      longitud: location.lng,
      tipo_clase: 'presencial', // Por defecto en este escaneo físico
    };

    if (estado?.tiene_entrada_activa) {
      salidaMutation.mutate(payload);
    } else {
      entradaMutation.mutate(payload);
    }
  };

  // --- RENDERS ---

  // 1. Cargando Global (Geolocalización o Estado de API)
  if (isGeoLoading || isEstadoLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 text-center">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-primary/5">
          <Loader2 className="absolute h-16 w-16 animate-spin text-primary" />
          <MapPin className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <h2 className="mt-8 text-2xl font-semibold text-foreground">Verificando tu ubicación...</h2>
        <p className="mt-2 text-muted-foreground">Esto puede tardar unos segundos.</p>
        
        <div className="mt-8 flex gap-4">
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
            GPS <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* HEADER SIMPLE */}
      <header className="flex h-16 items-center px-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/docente/dashboard')} className="shrink-0">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="ml-4 text-lg font-semibold">Registro de Asistencia</h1>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        {/* Manejo de error de geolocalización o de conexión */}
        {(geoError || isEstadoError) && (
          <Alert variant="destructive" className="mb-8 max-w-sm text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atención</AlertTitle>
            <AlertDescription>{geoError || 'No se pudo obtener tu estado actual de fichaje.'}</AlertDescription>
          </Alert>
        )}

        <div className="w-full max-w-sm space-y-8">
          {/* Card de Estado */}
          {estado && (
            <div className="space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                {estado.tiene_entrada_activa ? (
                  <Fingerprint className="h-10 w-10 text-primary" />
                ) : (
                  <MapPin className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {estado.tiene_entrada_activa ? 'En curso' : 'Listo para fichar'}
                </h2>
                {estado.tiene_entrada_activa && estado.hora_entrada && (
                  <p className="text-muted-foreground mt-2">
                    Ingresaste a las <span className="font-semibold text-foreground">{estado.hora_entrada}</span>
                    {estado.materia_actual && <span> para <br/> {estado.materia_actual}</span>}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* BOTÓN GIGANTE DE FICHAJE */}
          {estado && (
            <Button
              className={`h-24 w-full shadow-xl transition-all rounded-3xl text-xl font-bold ${
                estado.tiene_entrada_activa
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
              }`}
              onClick={handleFichar}
              disabled={!!geoError || entradaMutation.isPending || salidaMutation.isPending}
            >
              {entradaMutation.isPending || salidaMutation.isPending ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : estado.tiene_entrada_activa ? (
                <span className="flex items-center gap-3">
                  <LogOut className="h-8 w-8" />
                  Fichar Salida
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <Fingerprint className="h-8 w-8" />
                  Fichar Entrada
                </span>
              )}
            </Button>
          )}

          {/* Fallback de botonera rota por si se desabilita por no tener GPS */}
          {geoError && (
             <Button
                variant="outline"
                className="w-full h-14 rounded-2xl"
                onClick={() => window.location.reload()}
              >
                Reintentar permisos de ubicación
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

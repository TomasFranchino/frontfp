import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type Configuracion = {
  id?: number | null;
  dia_corte_mensual?: number | null;
  red_wifi_campus?: string | null;
  metodo_validacion_ubicacion?: string | null;
  latitud_campus?: number | string | null;
  longitud_campus?: number | string | null;
  radio_gps_metros?: number | null;
};

const METODOS_VALIDACION = [
  { value: 'gps_o_wifi', label: 'GPS o WiFi' },
  { value: 'solo_wifi', label: 'Solo WiFi' },
  { value: 'solo_gps', label: 'Solo GPS' },
] as const;

const configuracionSchema = z.object({
  dia_corte_mensual: z.coerce.number().min(1, 'Debe ser entre 1 y 31.').max(31, 'Debe ser entre 1 y 31.'),
  red_wifi_campus: z.string().max(100, 'No puede superar 100 caracteres.').optional(),
  metodo_validacion_ubicacion: z.enum(['gps_o_wifi', 'solo_wifi', 'solo_gps'], {
    error: 'Seleccioná un método de validación.',
  }),
  latitud_campus: z.coerce.number()
    .min(-90, 'La latitud debe estar entre -90 y 90.')
    .max(90, 'La latitud debe estar entre -90 y 90.'),
  longitud_campus: z.coerce.number()
    .min(-180, 'La longitud debe estar entre -180 y 180.')
    .max(180, 'La longitud debe estar entre -180 y 180.'),
  radio_gps_metros: z.coerce.number()
    .int('El radio debe ser un número entero.')
    .min(50, 'El radio mínimo es 50 metros.')
    .max(5000, 'El radio máximo es 5000 metros.'),
});

type ConfiguracionFormValues = z.output<typeof configuracionSchema>;
type ConfiguracionFormInput = z.input<typeof configuracionSchema>;

function toNumber(value: number | string | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return typeof value === 'number' ? value : Number(value);
}

async function fetchConfiguracion(): Promise<Configuracion> {
  const { data } = await api.get<Configuracion>('/configuracion/');
  return data;
}

async function updateConfiguracion(payload: ConfiguracionFormValues): Promise<Configuracion> {
  const { data } = await api.patch<Configuracion>('/configuracion/', {
    dia_corte_mensual: payload.dia_corte_mensual,
    red_wifi_campus: payload.red_wifi_campus?.trim() || null,
    metodo_validacion_ubicacion: payload.metodo_validacion_ubicacion,
    latitud_campus: payload.latitud_campus,
    longitud_campus: payload.longitud_campus,
    radio_gps_metros: payload.radio_gps_metros,
  });

  return data;
}

export function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: configuracion,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['configuracion'],
    queryFn: fetchConfiguracion,
  });

  const form = useForm<ConfiguracionFormInput, unknown, ConfiguracionFormValues>({
    resolver: zodResolver(configuracionSchema),
    defaultValues: {
      dia_corte_mensual: 20,
      red_wifi_campus: '',
      metodo_validacion_ubicacion: 'gps_o_wifi',
      latitud_campus: -30.944598,
      longitud_campus: -61.558501,
      radio_gps_metros: 150,
    },
  });

  useEffect(() => {
    if (configuracion) {
      form.reset({
        dia_corte_mensual: configuracion.dia_corte_mensual ?? 20,
        red_wifi_campus: configuracion.red_wifi_campus ?? '',
        metodo_validacion_ubicacion:
          (METODOS_VALIDACION.some((m) => m.value === configuracion.metodo_validacion_ubicacion)
            ? configuracion.metodo_validacion_ubicacion
            : 'gps_o_wifi') as ConfiguracionFormValues['metodo_validacion_ubicacion'],
        latitud_campus: toNumber(configuracion.latitud_campus, -30.944598),
        longitud_campus: toNumber(configuracion.longitud_campus, -61.558501),
        radio_gps_metros: configuracion.radio_gps_metros ?? 150,
      });
    }
  }, [configuracion, form]);

  const latitud = Number(form.watch('latitud_campus'));
  const longitud = Number(form.watch('longitud_campus'));
  const radioGps = Number(form.watch('radio_gps_metros') || 150);

  const mapUrl = useMemo(() => {
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
      return null;
    }

    return `https://www.google.com/maps?q=${latitud},${longitud}`;
  }, [latitud, longitud]);

  const updateMutation = useMutation({
    mutationFn: updateConfiguracion,
    onSuccess: (data) => {
      toast.success('Configuración actualizada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      setSuccessMessage('Configuración actualizada correctamente.');
      form.reset({
        dia_corte_mensual: data.dia_corte_mensual ?? 20,
        red_wifi_campus: data.red_wifi_campus ?? '',
        metodo_validacion_ubicacion:
          (METODOS_VALIDACION.some((m) => m.value === data.metodo_validacion_ubicacion)
            ? data.metodo_validacion_ubicacion
            : 'gps_o_wifi') as ConfiguracionFormValues['metodo_validacion_ubicacion'],
        latitud_campus: toNumber(data.latitud_campus, -30.944598),
        longitud_campus: toNumber(data.longitud_campus, -61.558501),
        radio_gps_metros: data.radio_gps_metros ?? 150,
      });
    },
    onError: () => {
      setSuccessMessage(null);
    },
  });

  const onSubmit = (values: ConfiguracionFormValues) => {
    setSuccessMessage(null);
    updateMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-primary">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajustá los parámetros globales usados por el sistema de asistencia.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-36" />
          </div>
        ) : isError ? (
          <div className="text-sm text-destructive">Ocurrió un error al cargar la configuración.</div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-primary">Parámetros generales</h2>
                <p className="text-sm text-muted-foreground">Corte mensual, red WiFi y método de validación.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dia_corte_mensual">Día de corte mensual</Label>
                <Input id="dia_corte_mensual" type="number" min={1} max={31} {...form.register('dia_corte_mensual')} />
                {form.formState.errors.dia_corte_mensual ? (
                  <p className="text-xs text-destructive">{form.formState.errors.dia_corte_mensual.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="red_wifi_campus">Red WiFi campus</Label>
                <Input id="red_wifi_campus" {...form.register('red_wifi_campus')} placeholder="Ej: IP o identificador de red" />
                {form.formState.errors.red_wifi_campus ? (
                  <p className="text-xs text-destructive">{form.formState.errors.red_wifi_campus.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Método de validación de ubicación</Label>
                <Select
                  value={form.watch('metodo_validacion_ubicacion')}
                  onValueChange={(value) =>
                    form.setValue('metodo_validacion_ubicacion', value as ConfiguracionFormValues['metodo_validacion_ubicacion'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccioná un método" />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS_VALIDACION.map((metodo) => (
                      <SelectItem key={metodo.value} value={metodo.value}>
                        {metodo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.metodo_validacion_ubicacion ? (
                  <p className="text-xs text-destructive">{form.formState.errors.metodo_validacion_ubicacion.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-5 border-t border-border pt-6">
              <div>
                <h2 className="text-lg font-semibold text-primary">Ubicación del campus (GPS)</h2>
                <p className="text-sm text-muted-foreground">
                  Punto de referencia de la sede única. Los docentes deben estar a menos de{' '}
                  <span className="font-medium text-foreground">{radioGps || 150} metros</span> para validar por GPS.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitud_campus">Latitud</Label>
                  <Input
                    id="latitud_campus"
                    type="number"
                    step="any"
                    {...form.register('latitud_campus')}
                    placeholder="Ej: -30.944598"
                  />
                  {form.formState.errors.latitud_campus ? (
                    <p className="text-xs text-destructive">{form.formState.errors.latitud_campus.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitud_campus">Longitud</Label>
                  <Input
                    id="longitud_campus"
                    type="number"
                    step="any"
                    {...form.register('longitud_campus')}
                    placeholder="Ej: -61.558501"
                  />
                  {form.formState.errors.longitud_campus ? (
                    <p className="text-xs text-destructive">{form.formState.errors.longitud_campus.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="radio_gps_metros">Radio permitido (metros)</Label>
                <Input id="radio_gps_metros" type="number" min={50} max={5000} step={1} {...form.register('radio_gps_metros')} />
                {form.formState.errors.radio_gps_metros ? (
                  <p className="text-xs text-destructive">{form.formState.errors.radio_gps_metros.message}</p>
                ) : null}
              </div>

              {mapUrl ? (
                <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Ver ubicación en mapa
                  </a>
                </Button>
              ) : null}
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" className="gap-2" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {successMessage ? (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <AlertTitle>Cambios guardados</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {updateMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>Revisá los valores ingresados e intentá nuevamente.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

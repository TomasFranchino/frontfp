import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Clock3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { getLocalDateString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type ClaseHoy = {
  slot_id: number;
  carreras_codigos: string;
  materia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
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

type AsincronicaValues = z.output<typeof asincronicaSchema>;
type AsincronicaInput = z.input<typeof asincronicaSchema>;

export function DeclararAsincronicaPage() {
  const navigate = useNavigate();

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

  const form = useForm<AsincronicaInput, unknown, AsincronicaValues>({
    resolver: zodResolver(asincronicaSchema),
    defaultValues: {
      slot_horario_id: 0,
      fecha_dictado: getLocalDateString(), // Hoy en AAAA-MM-DD
      nota: '',
    },
  });

  const watchFecha = form.watch('fecha_dictado') || getLocalDateString();

  const { data: clasesHoy, isLoading } = useQuery({
    queryKey: ['asistencia', 'mis_clases_hoy', watchFecha],
    queryFn: async () => {
      const { data } = await api.get<ClaseHoy[]>('/asistencia/mis_clases_hoy', {
        params: { fecha: watchFecha }
      });
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: AsincronicaValues) => {
      const { data } = await api.post('/asistencia/asincronica/declarar', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Clase asincrónica declarada correctamente.');
      navigate('/docente/dashboard');
    },
  });

  const onSubmit = (values: AsincronicaValues) => {
    submitMutation.mutate(values);
  };

  const selectedSlotId = Number(form.watch('slot_horario_id') || 0);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/docente/dashboard')} className="shrink-0">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-primary">Clase Asincrónica</h1>
          <p className="text-sm text-muted-foreground">Declará el dictado de una clase a distancia.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base" htmlFor="slot_horario_id">Clase del Día</Label>
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : !clasesHoy || clasesHoy.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                No tenés clases programadas para la fecha seleccionada.
              </div>
            ) : (
              <Select
                value={selectedSlotId ? selectedSlotId.toString() : ''}
                onValueChange={(val) => form.setValue('slot_horario_id', Number(val))}
              >
                <SelectTrigger className="h-10 w-full rounded-lg text-sm bg-background">
                  <SelectValue placeholder="Seleccioná la materia..." />
                </SelectTrigger>
                <SelectContent>
                  {clasesHoy.map((clase) => (
                    <SelectItem key={clase.slot_id} value={clase.slot_id.toString()}>
                      {clase.materia_nombre} {clase.carreras_codigos ? `(${clase.carreras_codigos})` : '(Sin carrera)'} ({clase.hora_inicio} - {clase.hora_fin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {form.formState.errors.slot_horario_id && (
              <p className="text-sm text-destructive">{form.formState.errors.slot_horario_id.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base" htmlFor="fecha_dictado">Fecha de dictado</Label>
            <Input
              id="fecha_dictado"
              type="date"
              min={minDateStr}
              max={maxDateStr}
              className="h-12 rounded-xl text-base"
              {...form.register('fecha_dictado')}
            />
            {form.formState.errors.fecha_dictado && (
              <p className="text-sm text-destructive">{form.formState.errors.fecha_dictado.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base" htmlFor="nota">Detalles / Nota</Label>
            <Textarea
              id="nota"
              placeholder="Ej: Se subió el trabajo práctico al campus virtual y se asignaron lecturas."
              className="min-h-[120px] rounded-xl resize-none text-base"
              {...form.register('nota')}
            />
            {form.formState.errors.nota && (
              <p className="text-sm text-destructive">{form.formState.errors.nota.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="h-14 w-full rounded-2xl text-lg mt-4 gap-2"
            disabled={submitMutation.isPending || (!clasesHoy?.length && !isLoading)}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Clock3 className="h-5 w-5" />
                Declarar Clase
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

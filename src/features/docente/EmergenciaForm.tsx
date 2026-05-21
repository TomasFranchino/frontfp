import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type ClaseHoy = {
  slot_id: number;
  materia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
};

const emergenciaSchema = z.object({
  slot_horario_id: z.coerce.number().optional().or(z.literal(0)), // 0 means unselected/general
  nota_docente: z.string().min(10, 'Por favor explica detalladamente el problema o incidencia.'),
});

type EmergenciaValues = z.infer<typeof emergenciaSchema>;

export function EmergenciaFormPage() {
  const navigate = useNavigate();

  const form = useForm<EmergenciaValues>({
    resolver: zodResolver(emergenciaSchema) as any,
    defaultValues: {
      slot_horario_id: 0,
      nota_docente: '',
    },
  });

  const { data: clasesHoy, isLoading } = useQuery({
    queryKey: ['asistencia', 'mis_clases_hoy'],
    queryFn: async () => {
      const { data } = await api.get<ClaseHoy[]>('/asistencia/mis_clases_hoy');
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: EmergenciaValues) => {
      // transform 0 back to null/undefined before sending to backend if 0 implies "general"
      const dataToSend = {
        ...payload,
        slot_horario_id: payload.slot_horario_id === 0 ? undefined : payload.slot_horario_id,
      };
      const { data } = await api.post('/asistencia/emergencias', dataToSend);
      return data;
    },
    onSuccess: () => {
      toast.success('Incidencia reportada. La secretaría revisará tu solicitud.');
      navigate('/docente/dashboard');
    },
  });

  const onSubmit = (values: EmergenciaValues) => {
    submitMutation.mutate(values);
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/docente/dashboard')} className="shrink-0">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-primary">Reportar Emergencia</h1>
          <p className="text-sm text-muted-foreground">Notificá un problema técnico o inasistencia de fuerza mayor.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base" htmlFor="slot_horario_id">Clase Afectada (Opcional)</Label>
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : (
              <Select
                value={form.watch('slot_horario_id')?.toString() || '0'}
                onValueChange={(val) => form.setValue('slot_horario_id', Number(val))}
              >
                <SelectTrigger className="h-12 rounded-xl text-base bg-background">
                  <SelectValue placeholder="General / Sin materia asignada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Toda la jornada / General</SelectItem>
                  {clasesHoy?.map((clase) => (
                    <SelectItem key={clase.slot_id} value={clase.slot_id.toString()}>
                      {clase.materia_nombre} ({clase.hora_inicio} - {clase.hora_fin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">Si el problema es general, no selecciones ninguna.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium text-destructive" htmlFor="nota_docente">Motivo de la Emergencia</Label>
            <Textarea
              id="nota_docente"
              placeholder="Ej: El proyector del aula 4 no enciende. / Me encuentro demorado en ruta."
              className="min-h-[140px] rounded-xl resize-none text-base border-destructive/30 focus-visible:ring-destructive focus-visible:border-transparent bg-background"
              {...form.register('nota_docente')}
            />
            {form.formState.errors.nota_docente && (
              <p className="text-sm text-destructive">{form.formState.errors.nota_docente.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="destructive"
            className="h-14 w-full rounded-2xl text-lg mt-4 gap-2"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <AlertCircle className="h-5 w-5" />
                Enviar Reporte
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

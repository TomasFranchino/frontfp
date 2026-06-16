import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SlotHorario = {
  id: number;
  materia_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

const DIAS_SEMANA = [
  { value: 0, label: 'Lunes' },
  { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTime(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function timeToMinutes(value: string) {
  const normalized = formatTime(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

const slotSchema = z
  .object({
    dia_semana: z.coerce.number().int().min(0, 'Seleccioná un día.').max(6, 'Seleccioná un día.'),
    hora_inicio: z.string().regex(TIME_PATTERN, 'Ingresá una hora de inicio válida (HH:MM).'),
    hora_fin: z.string().regex(TIME_PATTERN, 'Ingresá una hora de fin válida (HH:MM).'),
  })
  .refine((values) => timeToMinutes(values.hora_fin) > timeToMinutes(values.hora_inicio), {
    message: 'La hora de fin debe ser posterior a la hora de inicio.',
    path: ['hora_fin'],
  });

type SlotFormValues = z.output<typeof slotSchema>;
type SlotFormInput = z.input<typeof slotSchema>;

async function fetchSlots(): Promise<SlotHorario[]> {
  const { data } = await api.get<SlotHorario[]>('/academico/slots');
  return data;
}

async function createSlot(materiaId: number, payload: SlotFormValues): Promise<SlotHorario> {
  const { data } = await api.post<SlotHorario>('/academico/slots', {
    materia_id: materiaId,
    dia_semana: payload.dia_semana,
    hora_inicio: payload.hora_inicio,
    hora_fin: payload.hora_fin,
  });
  return data;
}

async function updateSlot({ id, materiaId, payload }: { id: number; materiaId: number; payload: SlotFormValues }): Promise<SlotHorario> {
  const { data } = await api.put<SlotHorario>(`/academico/slots/${id}`, {
    materia_id: materiaId,
    dia_semana: payload.dia_semana,
    hora_inicio: payload.hora_inicio,
    hora_fin: payload.hora_fin,
  });
  return data;
}

async function deleteSlot(id: number): Promise<void> {
  await api.delete(`/academico/slots/${id}`);
}

function getDiaSemanaLabel(diaSemana: number) {
  return DIAS_SEMANA.find((dia) => dia.value === diaSemana)?.label ?? `Día ${diaSemana}`;
}

interface MateriaHorariosTabProps {
  materiaId: number;
}

export function MateriaHorariosTab({ materiaId }: MateriaHorariosTabProps) {
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotHorario | null>(null);

  const { data: slotsAll, isLoading } = useQuery({
    queryKey: ['academico', 'slots'],
    queryFn: fetchSlots,
  });

  const slotsMateria = (slotsAll ?? [])
    .filter((slot) => slot.materia_id === Number(materiaId))
    .sort((a, b) => {
      if (a.dia_semana !== b.dia_semana) {
        return a.dia_semana - b.dia_semana;
      }
      return a.hora_inicio.localeCompare(b.hora_inicio);
    });

  const form = useForm<SlotFormInput, unknown, SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      dia_semana: 0,
      hora_inicio: '08:00',
      hora_fin: '10:00',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: SlotFormValues) => createSlot(materiaId, payload),
    onSuccess: () => {
      toast.success('Horario creado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'slots'] });
      handleCloseSheet();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; payload: SlotFormValues }) =>
      updateSlot({ id: data.id, materiaId, payload: data.payload }),
    onSuccess: () => {
      toast.success('Horario actualizado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'slots'] });
      handleCloseSheet();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSlot,
    onSuccess: () => {
      toast.success('Horario eliminado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'slots'] });
    },
  });

  const handleOpenNew = () => {
    setEditingSlot(null);
    form.reset({
      dia_semana: 0,
      hora_inicio: '08:00',
      hora_fin: '10:00',
    });
    setIsSheetOpen(true);
  };

  const handleEdit = (slot: SlotHorario) => {
    setEditingSlot(slot);
    form.reset({
      dia_semana: slot.dia_semana,
      hora_inicio: formatTime(slot.hora_inicio),
      hora_fin: formatTime(slot.hora_fin),
    });
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingSlot(null);
    form.reset();
  };

  const onSubmit = (values: SlotFormValues) => {
    if (editingSlot) {
      updateMutation.mutate({ id: editingSlot.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Grilla Horaria</h2>
          <p className="text-sm text-muted-foreground">Configurá los días y bloques horarios de cursado.</p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Añadir Horario
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {slotsMateria.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sin horarios configurados"
            description="No hay bloques horarios registrados para esta materia. Añade el primer horario de cursado."
            actionLabel="Añadir Primer Horario"
            actionIcon={Plus}
            onAction={handleOpenNew}
            className="py-12"
          />
        ) : (
          <div className="divide-y divide-border">
            {slotsMateria.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                      {getDiaSemanaLabel(slot.dia_semana).slice(0, 3)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      {getDiaSemanaLabel(slot.dia_semana)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm font-mono text-muted-foreground">
                      <span className="bg-muted px-2 py-0.5 rounded text-foreground/80 font-medium">
                        {formatTime(slot.hora_inicio)}
                      </span>
                      <span>—</span>
                      <span className="bg-muted px-2 py-0.5 rounded text-foreground/80 font-medium">
                        {formatTime(slot.hora_fin)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(slot)} aria-label="Editar horario">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (confirm('¿Eliminar este horario de la grilla?')) {
                        deleteMutation.mutate(slot.id);
                      }
                    }}
                    aria-label="Eliminar horario"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[480px] overflow-y-auto w-full">
          <SheetHeader>
            <SheetTitle>{editingSlot ? 'Editar Horario' : 'Nuevo Horario'}</SheetTitle>
            <SheetDescription>
              {editingSlot ? 'Modificá el bloque semanal teórico.' : 'Definí el día y la hora para este bloque de cursado.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 sm:px-6 py-6">
            <div className="space-y-2">
              <Label>Día de la semana</Label>
              <Select
                value={String(form.watch('dia_semana'))}
                onValueChange={(value) =>
                  form.setValue('dia_semana', Number(value), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná un día" />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((dia) => (
                    <SelectItem key={dia.value} value={String(dia.value)}>
                      {dia.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.dia_semana ? (
                <p className="text-xs text-destructive">{form.formState.errors.dia_semana.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hora_inicio">Hora inicio</Label>
                <Input
                  id="hora_inicio"
                  type="time"
                  step={60}
                  {...form.register('hora_inicio')}
                />
                {form.formState.errors.hora_inicio ? (
                  <p className="text-xs text-destructive">{form.formState.errors.hora_inicio.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora_fin">Hora fin</Label>
                <Input id="hora_fin" type="time" step={60} {...form.register('hora_fin')} />
                {form.formState.errors.hora_fin ? (
                  <p className="text-xs text-destructive">{form.formState.errors.hora_fin.message}</p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseSheet}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingSlot ? 'Guardar Cambios' : 'Añadir Horario'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

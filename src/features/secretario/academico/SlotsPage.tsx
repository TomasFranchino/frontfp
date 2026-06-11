import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Materia = {
  id: number;
  codigo_siu: string;
  nombre: string;
  anio: number;
  activa: boolean;
  carreras?: {
    id: number;
    codigo: string;
    nombre: string;
  }[];
};

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
    materia_id: z.coerce.number().min(1, 'Seleccioná una materia.'),
    dia_semana: z.coerce.number().int().min(0, 'Seleccioná un día.').max(6, 'Seleccioná un día.'),
    hora_inicio: z.string().regex(TIME_PATTERN, 'Ingresá una hora de inicio válida (HH:MM).'),
    hora_fin: z.string().regex(TIME_PATTERN, 'Ingresá una hora de fin válida (HH:MM).'),
  })
  .refine((values) => timeToMinutes(values.hora_fin) > timeToMinutes(values.hora_inicio), {
    message: 'La hora de fin debe ser posterior a la hora de inicio.',
    path: ['hora_fin'],
  });

type SlotFormValues = z.infer<typeof slotSchema>;

async function fetchSlots(): Promise<SlotHorario[]> {
  const { data } = await api.get<SlotHorario[]>('/academico/slots');
  return data;
}

async function fetchMaterias(): Promise<Materia[]> {
  const { data } = await api.get<Materia[]>('/academico/materias?incluir_inactivas=true');
  return data;
}

async function createSlot(payload: SlotFormValues): Promise<SlotHorario> {
  const { data } = await api.post<SlotHorario>('/academico/slots', {
    materia_id: payload.materia_id,
    dia_semana: payload.dia_semana,
    hora_inicio: payload.hora_inicio,
    hora_fin: payload.hora_fin,
  });
  return data;
}

async function updateSlot({ id, payload }: { id: number; payload: SlotFormValues }): Promise<SlotHorario> {
  const { data } = await api.put<SlotHorario>(`/academico/slots/${id}`, {
    materia_id: payload.materia_id,
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

function getMateriaLabel(materia?: Materia | null) {
  if (!materia) {
    return 'Materia no encontrada';
  }

  const carrerasCodigo = materia.carreras?.map((carrera) => carrera.codigo).join(', ');
  return carrerasCodigo ? `${materia.nombre} (${carrerasCodigo})` : materia.nombre;
}

export default function SlotsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotHorario | null>(null);

  const {
    data: slots,
    isLoading: isLoadingSlots,
    isError: isSlotsError,
  } = useQuery({
    queryKey: ['academico', 'slots'],
    queryFn: fetchSlots,
  });

  const { data: materias, isLoading: isLoadingMaterias } = useQuery({
    queryKey: ['academico', 'materias'],
    queryFn: fetchMaterias,
  });

  const materiasById = useMemo(
    () => new Map((materias ?? []).map((materia) => [materia.id, materia])),
    [materias],
  );

  const groupedSlots = useMemo(() => {
    if (!slots || !materias) return [];

    const groupsMap = new Map<number, SlotHorario[]>();
    for (const slot of slots) {
      if (!groupsMap.has(slot.materia_id)) {
        groupsMap.set(slot.materia_id, []);
      }
      groupsMap.get(slot.materia_id)!.push(slot);
    }

    const list = Array.from(groupsMap.entries()).map(([materiaId, slotsList]) => {
      const materia = materiasById.get(materiaId);

      const sortedSlots = [...slotsList].sort((a, b) => {
        if (a.dia_semana !== b.dia_semana) {
          return a.dia_semana - b.dia_semana;
        }
        return a.hora_inicio.localeCompare(b.hora_inicio);
      });

      return {
        materiaId,
        materia,
        slots: sortedSlots,
      };
    });

    return list.sort((a, b) => {
      const nameA = a.materia?.nombre ?? '';
      const nameB = b.materia?.nombre ?? '';
      return nameA.localeCompare(nameB);
    });
  }, [slots, materias, materiasById]);

  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema) as any,
    defaultValues: {
      materia_id: 0,
      dia_semana: 0,
      hora_inicio: '08:00',
      hora_fin: '10:00',
    },
  });

  const createMutation = useMutation({
    mutationFn: createSlot,
    onSuccess: () => {
      toast.success('Horario creado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'slots'] });
      setIsDialogOpen(false);
      form.reset({
        materia_id: 0,
        dia_semana: 0,
        hora_inicio: '08:00',
        hora_fin: '10:00',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSlot,
    onSuccess: () => {
      toast.success('Horario actualizado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'slots'] });
      setIsDialogOpen(false);
      setEditingSlot(null);
      form.reset({
        materia_id: 0,
        dia_semana: 0,
        hora_inicio: '08:00',
        hora_fin: '10:00',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSlot,
    onSuccess: () => {
      toast.success('Horario eliminado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'slots'] });
    },
  });

  const isLoading = isLoadingSlots || isLoadingMaterias;

  const handleOpenDialog = () => {
    setEditingSlot(null);
    form.reset({
      materia_id: 0,
      dia_semana: 0,
      hora_inicio: '08:00',
      hora_fin: '10:00',
    });
    setIsDialogOpen(true);
  };

  const handleAddSlotForMateria = (materiaId: number) => {
    setEditingSlot(null);
    form.reset({
      materia_id: materiaId,
      dia_semana: 0,
      hora_inicio: '08:00',
      hora_fin: '10:00',
    });
    setIsDialogOpen(true);
  };

  const handleEditSlot = (slot: SlotHorario) => {
    setEditingSlot(slot);
    form.reset({
      materia_id: slot.materia_id,
      dia_semana: slot.dia_semana,
      hora_inicio: formatTime(slot.hora_inicio),
      hora_fin: formatTime(slot.hora_fin),
    });
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingSlot(null);
    }
  };

  const onSubmit = (values: SlotFormValues) => {
    if (editingSlot) {
      updateMutation.mutate({ id: editingSlot.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Grilla Horaria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrá los bloques teóricos semanales por materia.
          </p>
        </div>
        <Button onClick={handleOpenDialog} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Horario (Slot)
        </Button>
      </div>

      <div>
        {isLoading ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isSlotsError ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm p-6 text-center text-destructive">
            Ocurrió un error al cargar los horarios.
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm p-10 text-center text-muted-foreground">
            No hay horarios registrados. Creá el primero con el botón superior.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {groupedSlots.map(({ materiaId, materia, slots: materiaSlots }) => (
              <div
                key={materiaId}
                className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base text-primary uppercase tracking-wide">
                        {materia?.nombre ?? 'Materia no encontrada'}
                      </h3>
                      {materia && !materia.activa && (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                          Inactiva
                        </span>
                      )}
                    </div>
                    {materia?.codigo_siu ? (
                      <p className="text-xs text-muted-foreground font-mono">
                        Código SIU: {materia.codigo_siu}
                      </p>
                    ) : null}
                  </div>
                  {materia && materia.activa && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0"
                      onClick={() => handleAddSlotForMateria(materia.id)}
                      title="Añadir horario"
                      aria-label="Añadir horario a esta materia"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 font-mono text-sm pl-2">
                  {materiaSlots.map((slot, index) => {
                    const isLast = index === materiaSlots.length - 1;
                    const connector = isLast ? '└──' : '├──';

                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between py-1.5 hover:bg-accent/40 rounded px-2 transition-colors group"
                      >
                        <div className="flex items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
                          <span className="text-muted-foreground/60 select-none">{connector}</span>
                          <span className="font-semibold w-24 inline-block text-foreground">
                            {getDiaSemanaLabel(slot.dia_semana)}
                          </span>
                          <span>
                            {formatTime(slot.hora_inicio)} – {formatTime(slot.hora_fin)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleEditSlot(slot)}
                            aria-label="Editar horario"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm('¿Eliminar este horario de la grilla?')) {
                                deleteMutation.mutate(slot.id);
                              }
                            }}
                            aria-label="Eliminar horario"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Editar Horario (Slot)' : 'Nuevo Horario (Slot)'}</DialogTitle>
            <DialogDescription>
              {editingSlot ? 'Modificá los datos del bloque semanal teórico.' : 'Definí el bloque semanal teórico para una materia.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 py-4 px-4">{/* P-4 */}
            <div className="space-y-2">
              <Label>Materia</Label>
              <Select
                value={form.watch('materia_id') ? String(form.watch('materia_id')) : ''}
                onValueChange={(value) => form.setValue('materia_id', Number(value), { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná una materia" />
                </SelectTrigger>
                <SelectContent>
                  {(materias ?? [])
                    .filter((materia) => materia.activa || materia.id === form.watch('materia_id'))
                    .map((materia) => (
                      <SelectItem key={materia.id} value={String(materia.id)}>
                        {getMateriaLabel(materia)} ({materia.anio}º){!materia.activa && ' (Inactiva)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.materia_id ? (
                <p className="text-xs text-destructive">{form.formState.errors.materia_id.message}</p>
              ) : null}
            </div>

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
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingSlot ? 'Guardar Cambios' : 'Crear Horario'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserMinus, Pencil, UserCircle2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { getLocalDateString, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';

type PerfilUsuario = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
};

type Docente = {
  id: number;
  user: PerfilUsuario;
  activo: boolean;
};

type Asignacion = {
  id: number | null;
  docente_id: number;
  materia_id: number;
  rol: string;
  activa?: boolean;
  fecha_inicio: string;
  fecha_fin?: string | null;
};

const asignacionSchema = z.object({
  docente_id: z.coerce.number().min(1, 'Seleccioná un docente.'),
  rol: z.string().min(1, 'El rol es obligatorio.').max(20, 'El rol no puede superar 20 caracteres.'),
  fecha_inicio: z.string().min(1, 'La fecha de inicio es obligatoria.'),
  fecha_fin: z.string().optional(),
});

type AsignacionFormValues = z.output<typeof asignacionSchema>;
type AsignacionFormInput = z.input<typeof asignacionSchema>;

async function fetchAsignaciones(): Promise<Asignacion[]> {
  const { data } = await api.get<Asignacion[]>('/asignaciones/');
  return data;
}

async function fetchDocentes(): Promise<Docente[]> {
  const { data } = await api.get<Docente[]>('/auth/docentes?incluir_inactivos=true');
  return data;
}

async function createAsignacion(materiaId: number, payload: AsignacionFormValues): Promise<Asignacion> {
  const { data } = await api.post<Asignacion>('/asignaciones/', {
    ...payload,
    materia_id: materiaId,
    fecha_fin: payload.fecha_fin || null,
  });
  return data;
}

async function updateAsignacion({ id, materiaId, payload }: { id: number; materiaId: number; payload: AsignacionFormValues }): Promise<Asignacion> {
  const { data } = await api.put<Asignacion>(`/asignaciones/${id}`, {
    ...payload,
    materia_id: materiaId,
    fecha_fin: payload.fecha_fin || null,
  });
  return data;
}

async function deactivateAsignacion(id: number): Promise<void> {
  await api.delete(`/asignaciones/${id}`);
}

function getDocenteName(docente?: Docente) {
  if (!docente) return 'Docente no encontrado';
  const fullName = `${docente.user.first_name} ${docente.user.last_name}`.trim();
  return fullName || docente.user.username;
}

interface MateriaDocentesTabProps {
  materiaId: number;
}

export function MateriaDocentesTab({ materiaId }: MateriaDocentesTabProps) {
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingAsignacion, setEditingAsignacion] = useState<Asignacion | null>(null);
  const [openDocenteCombobox, setOpenDocenteCombobox] = useState(false);

  const { data: asignacionesAll, isLoading: isLoadingAsignaciones } = useQuery({
    queryKey: ['asignaciones'],
    queryFn: fetchAsignaciones,
  });

  const { data: docentes, isLoading: isLoadingDocentes } = useQuery({
    queryKey: ['auth', 'docentes'],
    queryFn: fetchDocentes,
  });

  const isLoading = isLoadingAsignaciones || isLoadingDocentes;

  const sortedDocentes = useMemo(() => {
    if (!docentes) return [];
    return [...docentes].sort((a, b) => {
      const nameA = getDocenteName(a).toLowerCase();
      const nameB = getDocenteName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [docentes]);

  // Filtrar solo las asignaciones para esta materia
  const asignacionesMateria = (asignacionesAll ?? []).filter(
    (a) => a.materia_id === Number(materiaId) && a.activa !== false
  );

  const form = useForm<AsignacionFormInput, unknown, AsignacionFormValues>({
    resolver: zodResolver(asignacionSchema),
    defaultValues: {
      docente_id: 0,
      rol: 'titular',
      fecha_inicio: getLocalDateString(),
      fecha_fin: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: AsignacionFormValues) => createAsignacion(materiaId, payload),
    onSuccess: () => {
      toast.success('Docente asignado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      handleCloseSheet();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; payload: AsignacionFormValues }) =>
      updateAsignacion({ id: data.id, materiaId, payload: data.payload }),
    onSuccess: () => {
      toast.success('Asignación actualizada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      handleCloseSheet();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAsignacion,
    onSuccess: () => {
      toast.success('Asignación desactivada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
    },
  });

  const handleOpenNew = () => {
    setEditingAsignacion(null);
    form.reset({
      docente_id: 0,
      rol: 'titular',
      fecha_inicio: getLocalDateString(),
      fecha_fin: '',
    });
    setIsSheetOpen(true);
  };

  const handleEdit = (asignacion: Asignacion) => {
    setEditingAsignacion(asignacion);
    form.reset({
      docente_id: asignacion.docente_id,
      rol: asignacion.rol,
      fecha_inicio: asignacion.fecha_inicio,
      fecha_fin: asignacion.fecha_fin || '',
    });
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingAsignacion(null);
    form.reset();
  };

  const onSubmit = (values: AsignacionFormValues) => {
    if (editingAsignacion && editingAsignacion.id) {
      updateMutation.mutate({ id: editingAsignacion.id, payload: values });
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
          <h2 className="text-lg font-semibold text-primary">Cuerpo Docente</h2>
          <p className="text-sm text-muted-foreground">Gestioná los docentes que dictan esta materia.</p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Asignar Docente
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {asignacionesMateria.length === 0 ? (
          <EmptyState
            icon={UserCircle2}
            title="Sin docentes asignados"
            description="Todavía no has asignado ningún docente a esta materia. Comienza agregando uno para completar el equipo académico."
            actionLabel="Asignar Primer Docente"
            actionIcon={Plus}
            onAction={handleOpenNew}
            className="py-12"
          />
        ) : (
          <div className="divide-y divide-border">
            {asignacionesMateria.map((asignacion) => {
              const docente = docentes?.find((d) => d.id === asignacion.docente_id);

              return (
                <div key={asignacion.id} className="flex items-center justify-between p-4 sm:p-6 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {docente ? `${docente.user.first_name[0]}${docente.user.last_name[0]}` : '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{getDocenteName(docente)}</p>
                        {docente && !docente.activo && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="capitalize font-medium text-foreground/80">Rol: {asignacion.rol}</span>
                        <span>•</span>
                        <span>Desde: {asignacion.fecha_inicio}</span>
                        {asignacion.fecha_fin && (
                          <>
                            <span>•</span>
                            <span>Hasta: {asignacion.fecha_fin}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(asignacion)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={!asignacion.id || deactivateMutation.isPending}
                      onClick={() => {
                        if (asignacion.id && confirm('¿Desactivar esta asignación?')) {
                          deactivateMutation.mutate(asignacion.id);
                        }
                      }}
                      aria-label="Desactivar asignación"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[520px] overflow-y-auto w-full">
          <SheetHeader>
            <SheetTitle>{editingAsignacion ? 'Editar Asignación' : 'Nueva Asignación'}</SheetTitle>
            <SheetDescription>
              {editingAsignacion
                ? 'Modificá los datos del docente asignado a esta materia.'
                : 'Seleccioná un docente y definí su rol en esta materia.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 sm:px-6 py-6">
            <div className="space-y-2">
              <Label>Docente</Label>
              <Popover open={openDocenteCombobox} onOpenChange={setOpenDocenteCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openDocenteCombobox}
                    className="w-full justify-between font-normal"
                  >
                    {form.watch('docente_id')
                      ? (() => {
                          const doc = docentes?.find((d) => d.id === form.watch('docente_id'));
                          return doc ? `${getDocenteName(doc)}${!doc.activo ? ' (Inactivo)' : ''}` : 'Seleccioná un docente';
                        })()
                      : 'Seleccioná un docente'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar docente..." />
                    <CommandList>
                      <CommandEmpty>No se encontró ningún docente.</CommandEmpty>
                      <CommandGroup>
                        {sortedDocentes
                          .filter((docente) => docente.activo || docente.id === form.watch('docente_id'))
                          .map((docente) => (
                            <CommandItem
                              key={docente.id}
                              value={`${getDocenteName(docente)} ${docente.id}`}
                              onSelect={() => {
                                form.setValue('docente_id', docente.id, { shouldValidate: true });
                                setOpenDocenteCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  form.watch('docente_id') === docente.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {getDocenteName(docente)}{!docente.activo && ' (Inactivo)'}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {form.formState.errors.docente_id ? (
                <p className="text-xs text-destructive">{form.formState.errors.docente_id.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <Input id="rol" {...form.register('rol')} placeholder="titular" />
              {form.formState.errors.rol ? (
                <p className="text-xs text-destructive">{form.formState.errors.rol.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de inicio</Label>
                <Input id="fecha_inicio" type="date" {...form.register('fecha_inicio')} />
                {form.formState.errors.fecha_inicio ? (
                  <p className="text-xs text-destructive">{form.formState.errors.fecha_inicio.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_fin">Fecha de fin</Label>
                <Input id="fecha_fin" type="date" {...form.register('fecha_fin')} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseSheet}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingAsignacion ? 'Guardar Cambios' : 'Asignar Docente'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

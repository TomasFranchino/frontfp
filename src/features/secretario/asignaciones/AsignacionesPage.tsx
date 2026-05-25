import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserMinus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type CarreraResumen = {
  id: number;
  codigo: string;
  nombre: string;
};

type Materia = {
  id: number;
  codigo_siu: string;
  nombre: string;
  anio: number;
  activa: boolean;
  carreras?: CarreraResumen[];
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
  materia_id: z.coerce.number().min(1, 'Seleccioná una materia.'),
  rol: z.string().min(1, 'El rol es obligatorio.').max(20, 'El rol no puede superar 20 caracteres.'),
  fecha_inicio: z.string().min(1, 'La fecha de inicio es obligatoria.'),
  fecha_fin: z.string().optional(),
});

type AsignacionFormValues = z.infer<typeof asignacionSchema>;

async function fetchAsignaciones(): Promise<Asignacion[]> {
  const { data } = await api.get<Asignacion[]>('/asignaciones/');
  return data;
}

async function fetchDocentes(): Promise<Docente[]> {
  const { data } = await api.get<Docente[]>('/auth/docentes?incluir_inactivos=true');
  return data;
}

async function fetchMaterias(): Promise<Materia[]> {
  const { data } = await api.get<Materia[]>('/academico/materias?incluir_inactivas=true');
  return data;
}

async function createAsignacion(payload: AsignacionFormValues): Promise<Asignacion> {
  const { data } = await api.post<Asignacion>('/asignaciones/', {
    ...payload,
    fecha_fin: payload.fecha_fin || null,
  });

  return data;
}

async function updateAsignacion({ id, payload }: { id: number; payload: AsignacionFormValues }): Promise<Asignacion> {
  const { data } = await api.put<Asignacion>(`/asignaciones/${id}`, {
    ...payload,
    fecha_fin: payload.fecha_fin || null,
  });
  return data;
}

async function deactivateAsignacion(id: number): Promise<void> {
  await api.delete(`/asignaciones/${id}`);
}

function getDocenteName(docente?: Docente) {
  if (!docente) {
    return 'Docente no encontrado';
  }

  const fullName = `${docente.user.first_name} ${docente.user.last_name}`.trim();
  return fullName || docente.user.username;
}

function getMateriaLabel(materia?: Materia | null) {
  if (!materia) {
    return 'Materia no encontrada';
  }

  const carrerasCodigo = materia.carreras?.map((carrera) => carrera.codigo).join(', ');
  return carrerasCodigo ? `${materia.nombre} (${carrerasCodigo})` : materia.nombre;
}

export function AsignacionesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsignacion, setEditingAsignacion] = useState<Asignacion | null>(null);

  const {
    data: asignaciones,
    isLoading: isLoadingAsignaciones,
    isError: isAsignacionesError,
  } = useQuery({
    queryKey: ['asignaciones'],
    queryFn: fetchAsignaciones,
  });

  const { data: docentes, isLoading: isLoadingDocentes } = useQuery({
    queryKey: ['auth', 'docentes'],
    queryFn: fetchDocentes,
  });

  const { data: materias, isLoading: isLoadingMaterias } = useQuery({
    queryKey: ['academico', 'materias'],
    queryFn: fetchMaterias,
  });

  const docentesById = useMemo(() => new Map((docentes ?? []).map((docente) => [docente.id, docente])), [docentes]);
  const materiasById = useMemo(() => new Map((materias ?? []).map((materia) => [materia.id, materia])), [materias]);

  const groupedAsignaciones = useMemo(() => {
    if (!asignaciones || !docentes) return [];

    const activeList = asignaciones.filter((a) => a.activa !== false);
    const groupsMap = new Map<number, Asignacion[]>();

    for (const asignacion of activeList) {
      if (!groupsMap.has(asignacion.docente_id)) {
        groupsMap.set(asignacion.docente_id, []);
      }
      groupsMap.get(asignacion.docente_id)!.push(asignacion);
    }

    const list = Array.from(groupsMap.entries()).map(([docenteId, listAsignaciones]) => {
      const docente = docentesById.get(docenteId);

      const sortedAsignaciones = [...listAsignaciones].sort((a, b) => {
        const matA = materiasById.get(a.materia_id)?.nombre ?? '';
        const matB = materiasById.get(b.materia_id)?.nombre ?? '';
        return matA.localeCompare(matB);
      });

      return {
        docenteId,
        docente,
        asignaciones: sortedAsignaciones,
      };
    });

    return list.sort((a, b) => {
      const nameA = getDocenteName(a.docente);
      const nameB = getDocenteName(b.docente);
      return nameA.localeCompare(nameB);
    });
  }, [asignaciones, docentes, docentesById, materiasById]);

  const form = useForm<AsignacionFormValues>({
    resolver: zodResolver(asignacionSchema) as any,
    defaultValues: {
      docente_id: 0,
      materia_id: 0,
      rol: 'titular',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: createAsignacion,
    onSuccess: () => {
      toast.success('Asignación creada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      setIsDialogOpen(false);
      form.reset({
        docente_id: 0,
        materia_id: 0,
        rol: 'titular',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAsignacion,
    onSuccess: () => {
      toast.success('Asignación actualizada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      setIsDialogOpen(false);
      setEditingAsignacion(null);
      form.reset({
        docente_id: 0,
        materia_id: 0,
        rol: 'titular',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAsignacion,
    onSuccess: () => {
      toast.success('Asignación desactivada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
    },
  });

  const isLoading = isLoadingAsignaciones || isLoadingDocentes || isLoadingMaterias;

  const handleOpenDialog = () => {
    setEditingAsignacion(null);
    form.reset({
      docente_id: 0,
      materia_id: 0,
      rol: 'titular',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: '',
    });
    setIsDialogOpen(true);
  };

  const handleAssignToDocente = (docenteId: number) => {
    setEditingAsignacion(null);
    form.reset({
      docente_id: docenteId,
      materia_id: 0,
      rol: 'titular',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: '',
    });
    setIsDialogOpen(true);
  };

  const handleEditAsignacion = (asignacion: Asignacion) => {
    setEditingAsignacion(asignacion);
    form.reset({
      docente_id: asignacion.docente_id,
      materia_id: asignacion.materia_id,
      rol: asignacion.rol,
      fecha_inicio: asignacion.fecha_inicio,
      fecha_fin: asignacion.fecha_fin || '',
    });
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingAsignacion(null);
    }
  };

  const onSubmit = (values: AsignacionFormValues) => {
    if (editingAsignacion && editingAsignacion.id) {
      updateMutation.mutate({ id: editingAsignacion.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Asignaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administrá la relación activa entre docentes y materias.</p>
        </div>
        <Button onClick={handleOpenDialog} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nueva Asignación
        </Button>
      </div>

      <div>
        {isLoading ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isAsignacionesError ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm p-6 text-center text-destructive">
            Ocurrió un error al cargar las asignaciones.
          </div>
        ) : groupedAsignaciones.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm p-10 text-center text-muted-foreground">
            No hay asignaciones activas registradas.
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
            {groupedAsignaciones.map(({ docenteId, docente, asignaciones: docenteAsignaciones }) => (
              <div
                key={docenteId}
                className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 min-w-0 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base text-primary uppercase tracking-wide">
                        {getDocenteName(docente)}
                      </h3>
                      {docente && !docente.activo && (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {docente?.user?.username ? (
                      <p className="text-xs text-muted-foreground font-mono">
                        DNI/Legajo: {docente.user.username}
                      </p>
                    ) : null}
                  </div>
                  {docente && docente.activo && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0"
                      onClick={() => handleAssignToDocente(docente.id)}
                      title="Nueva asignación"
                      aria-label={`Asignar materia a ${getDocenteName(docente)}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 font-mono text-sm pl-2">
                  {docenteAsignaciones.map((asignacion, index) => {
                    const isLast = index === docenteAsignaciones.length - 1;
                    const connector = isLast ? '└──' : '├──';
                    const materia = materiasById.get(asignacion.materia_id);

                    return (
                      <div
                        key={asignacion.id ?? `${asignacion.docente_id}-${asignacion.materia_id}-${asignacion.fecha_inicio}`}
                        className="flex items-center justify-between py-1.5 hover:bg-accent/40 rounded px-2 transition-colors group"
                      >
                        <div className="flex flex-col gap-0.5 text-muted-foreground group-hover:text-primary transition-colors flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-muted-foreground/60 select-none shrink-0">{connector}</span>
                            <span className="font-semibold text-foreground truncate min-w-0">
                              {materia?.nombre ?? 'Materia no encontrada'}
                            </span>
                            {materia?.carreras && materia.carreras.length > 0 && (
                              <span className="text-xs text-muted-foreground font-normal">
                                ({materia.carreras.map((c) => c.codigo).join(', ')})
                              </span>
                            )}
                            {materia && !materia.activa && (
                              <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/10 shrink-0">
                                Inactiva
                              </span>
                            )}
                          </div>
                          <div className="pl-8 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="capitalize font-medium text-foreground/80">Rol: {asignacion.rol}</span>
                            <span>Desde: {asignacion.fecha_inicio}</span>
                            {asignacion.fecha_fin ? <span>Hasta: {asignacion.fecha_fin}</span> : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            onClick={() => handleEditAsignacion(asignacion)}
                            title="Editar asignación"
                            aria-label="Editar asignación"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={!asignacion.id || deactivateMutation.isPending}
                            onClick={() => {
                              if (asignacion.id && confirm('¿Desactivar esta asignación?')) {
                                deactivateMutation.mutate(asignacion.id);
                              }
                            }}
                            title="Desactivar asignación"
                            aria-label="Desactivar asignación"
                          >
                            <UserMinus className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingAsignacion ? 'Editar Asignación' : 'Nueva Asignación'}</DialogTitle>
            <DialogDescription>
              {editingAsignacion
                ? 'Modificá los datos de la asignación del docente.'
                : 'Completá los datos para asignar un docente a una materia.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Docente</Label>
              <Select
                value={form.watch('docente_id') ? String(form.watch('docente_id')) : ''}
                onValueChange={(value) => form.setValue('docente_id', Number(value), { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná un docente" />
                </SelectTrigger>
                <SelectContent>
                  {(docentes ?? [])
                    .filter((docente) => docente.activo || docente.id === form.watch('docente_id'))
                    .map((docente) => (
                      <SelectItem key={docente.id} value={String(docente.id)}>
                        {getDocenteName(docente)}{!docente.activo && ' (Inactivo)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.docente_id ? (
                <p className="text-xs text-destructive">{form.formState.errors.docente_id.message}</p>
              ) : null}
            </div>

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
                        {getMateriaLabel(materia)}{!materia.activa && ' (Inactiva)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.materia_id ? (
                <p className="text-xs text-destructive">{form.formState.errors.materia_id.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rol">Rol</Label>
                <Input id="rol" {...form.register('rol')} placeholder="titular" />
                {form.formState.errors.rol ? <p className="text-xs text-destructive">{form.formState.errors.rol.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de inicio</Label>
                <Input id="fecha_inicio" type="date" {...form.register('fecha_inicio')} />
                {form.formState.errors.fecha_inicio ? (
                  <p className="text-xs text-destructive">{form.formState.errors.fecha_inicio.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_fin">Fecha de fin</Label>
              <Input id="fecha_fin" type="date" {...form.register('fecha_fin')} />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingAsignacion ? 'Guardar Cambios' : 'Crear Asignación'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

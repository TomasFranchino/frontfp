import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

type Materia = {
  id: number;
  codigo_siu: string;
  nombre: string;
  anio: number;
  activa: boolean;
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
  const { data } = await api.get<Docente[]>('/auth/docentes');
  return data;
}

async function fetchMaterias(): Promise<Materia[]> {
  const { data } = await api.get<Materia[]>('/academico/materias');
  return data;
}

async function createAsignacion(payload: AsignacionFormValues): Promise<Asignacion> {
  const { data } = await api.post<Asignacion>('/asignaciones/', {
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

export function AsignacionesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const activeAsignaciones = useMemo(
    () => (asignaciones ?? []).filter((asignacion) => asignacion.activa !== false),
    [asignaciones],
  );

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

  const deactivateMutation = useMutation({
    mutationFn: deactivateAsignacion,
    onSuccess: () => {
      toast.success('Asignación desactivada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
    },
  });

  const isLoading = isLoadingAsignaciones || isLoadingDocentes || isLoadingMaterias;

  const handleOpenDialog = () => {
    form.reset({
      docente_id: 0,
      materia_id: 0,
      rol: 'titular',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: '',
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: AsignacionFormValues) => {
    createMutation.mutate(values);
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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isAsignacionesError ? (
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar las asignaciones.</div>
        ) : activeAsignaciones.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No hay asignaciones activas registradas.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Docente</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="w-[120px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeAsignaciones.map((asignacion) => {
                const docente = docentesById.get(asignacion.docente_id);
                const materia = materiasById.get(asignacion.materia_id);

                return (
                  <TableRow key={asignacion.id ?? `${asignacion.docente_id}-${asignacion.materia_id}-${asignacion.fecha_inicio}`}>
                    <TableCell className="font-medium text-primary">{getDocenteName(docente)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p>{materia?.nombre ?? 'Materia no encontrada'}</p>
                        {materia?.codigo_siu ? <p className="text-xs text-muted-foreground">{materia.codigo_siu}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{asignacion.rol}</TableCell>
                    <TableCell>{asignacion.fecha_inicio}</TableCell>
                    <TableCell>{asignacion.fecha_fin || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        disabled={!asignacion.id || deactivateMutation.isPending}
                        onClick={() => {
                          if (asignacion.id && confirm('¿Desactivar esta asignación?')) {
                            deactivateMutation.mutate(asignacion.id);
                          }
                        }}
                      >
                        <UserMinus className="h-4 w-4" />
                        Desactivar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Nueva Asignación</DialogTitle>
            <DialogDescription>Completá los datos para asignar un docente a una materia.</DialogDescription>
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
                    .filter((docente) => docente.activo)
                    .map((docente) => (
                      <SelectItem key={docente.id} value={String(docente.id)}>
                        {getDocenteName(docente)}
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
                    .filter((materia) => materia.activa)
                    .map((materia) => (
                      <SelectItem key={materia.id} value={String(materia.id)}>
                        {materia.nombre}
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
              <Button type="submit" disabled={createMutation.isPending}>
                Crear Asignación
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

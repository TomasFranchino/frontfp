import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CarreraResumen = {
  id: number;
  codigo: string;
  nombre: string;
};

export type Materia = {
  id: number;
  codigo_siu: string;
  nombre: string;
  anio: number;
  activa: boolean;
  carreras: CarreraResumen[];
};

type Carrera = {
  id: number;
  institucion: string;
  codigo: string;
  nombre: string;
  duracion_anios: number;
};

const materiaSchema = z.object({
  codigo_siu: z.string().min(1, 'El código SIU es obligatorio.'),
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  anio: z.coerce.number().min(1, 'El año debe ser mayor a 0.'),
  activa: z.boolean(),
  carreras_ids: z.array(z.number()).min(1, 'Seleccioná al menos una carrera.'),
});

type MateriaFormValues = z.infer<typeof materiaSchema>;

async function fetchMaterias(incluirInactivas: boolean): Promise<Materia[]> {
  const { data } = await api.get<Materia[]>('/academico/materias', {
    params: { incluir_inactivas: incluirInactivas },
  });
  return data;
}

async function fetchCarreras(): Promise<Carrera[]> {
  const { data } = await api.get<Carrera[]>('/academico/carreras');
  return data;
}

async function createMateria(payload: MateriaFormValues): Promise<Materia> {
  const { data } = await api.post<Materia>('/academico/materias', payload);
  return data;
}

async function updateMateria({ id, payload }: { id: number; payload: MateriaFormValues }): Promise<Materia> {
  const { data } = await api.put<Materia>(`/academico/materias/${id}`, payload);
  return data;
}

async function deleteMateria(id: number): Promise<void> {
  await api.delete(`/academico/materias/${id}`);
}

export function MateriasPage() {
  const queryClient = useQueryClient();
  const [incluirInactivas, setIncluirInactivas] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState<Materia | null>(null);

  const { data: materias, isLoading, isError } = useQuery({
    queryKey: ['academico', 'materias', { incluirInactivas }],
    queryFn: () => fetchMaterias(incluirInactivas),
  });

  const { data: carreras, isLoading: isLoadingCarreras } = useQuery({
    queryKey: ['academico', 'carreras'],
    queryFn: fetchCarreras,
  });

  const createMutation = useMutation({
    mutationFn: createMateria,
    onSuccess: () => {
      toast.success('Materia creada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'materias'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateMateria,
    onSuccess: () => {
      toast.success('Materia actualizada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'materias'] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMateria,
    onSuccess: () => {
      toast.success('Materia desactivada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'materias'] });
    },
  });

  const form = useForm<MateriaFormValues>({
    resolver: zodResolver(materiaSchema) as any,
    defaultValues: {
      codigo_siu: '',
      nombre: '',
      anio: 1,
      activa: true,
      carreras_ids: [],
    },
  });

  const selectedCarrerasIds = form.watch('carreras_ids');

  const handleOpenNew = () => {
    setEditingMateria(null);
    form.reset({
      codigo_siu: '',
      nombre: '',
      anio: 1,
      activa: true,
      carreras_ids: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (materia: Materia) => {
    setEditingMateria(materia);
    form.reset({
      codigo_siu: materia.codigo_siu,
      nombre: materia.nombre,
      anio: materia.anio,
      activa: materia.activa,
      carreras_ids: materia.carreras.map((carrera) => carrera.id),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMateria(null);
    form.reset();
  };

  const toggleCarrera = (carreraId: number, checked: boolean) => {
    const current = form.getValues('carreras_ids');
    const next = checked ? [...current, carreraId] : current.filter((id) => id !== carreraId);
    form.setValue('carreras_ids', next, { shouldValidate: true });
  };

  const onSubmit = (values: MateriaFormValues) => {
    if (editingMateria) {
      updateMutation.mutate({ id: editingMateria.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isPageLoading = isLoading || isLoadingCarreras;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Gestión de Materias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrá las materias, sus carreras asociadas y el estado activo/inactivo.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Switch
              id="incluir-inactivas-materias"
              checked={incluirInactivas}
              onCheckedChange={setIncluirInactivas}
            />
            <Label htmlFor="incluir-inactivas-materias" className="cursor-pointer font-normal">
              Incluir inactivas
            </Label>
          </div>

          <Button onClick={handleOpenNew} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nueva Materia
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isPageLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar las materias.</div>
        ) : !materias || materias.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No hay materias para mostrar con el filtro actual.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Cod. SIU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Carreras</TableHead>
                <TableHead className="text-right">Año</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materias.map((materia) => (
                <TableRow key={materia.id} className={!materia.activa ? 'opacity-75' : undefined}>
                  <TableCell className="font-medium text-primary">{materia.codigo_siu}</TableCell>
                  <TableCell>{materia.nombre}</TableCell>
                  <TableCell>
                    {materia.carreras.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin carreras</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {materia.carreras.map((carrera) => (
                          <Badge key={carrera.id} variant="secondary" className="font-normal">
                            {carrera.codigo}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{materia.anio}º</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className={
                        materia.activa
                          ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-100'
                          : 'border-border bg-muted text-muted-foreground hover:bg-muted'
                      }
                    >
                      {materia.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(materia)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {materia.activa ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm('¿Desactivar esta materia? Podrás reactivarla desde Editar.')) {
                              deleteMutation.mutate(materia.id);
                            }
                          }}
                          aria-label="Desactivar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingMateria ? 'Editar Materia' : 'Nueva Materia'}</DialogTitle>
            <DialogDescription>
              {editingMateria
                ? 'Modificá los datos, las carreras asociadas o reactivá la materia marcando "Materia activa".'
                : 'Completá los datos y seleccioná al menos una carrera.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_siu">Código SIU</Label>
              <Input id="codigo_siu" {...form.register('codigo_siu')} placeholder="Ej: MAT-01" />
              {form.formState.errors.codigo_siu ? (
                <p className="text-xs text-destructive">{form.formState.errors.codigo_siu.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la Materia</Label>
              <Input id="nombre" {...form.register('nombre')} placeholder="Ej: Análisis Matemático I" />
              {form.formState.errors.nombre ? (
                <p className="text-xs text-destructive">{form.formState.errors.nombre.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="anio">Año de Cursado</Label>
              <Input id="anio" type="number" {...form.register('anio')} />
              {form.formState.errors.anio ? (
                <p className="text-xs text-destructive">{form.formState.errors.anio.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Carreras asociadas</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedCarrerasIds.length} seleccionada{selectedCarrerasIds.length === 1 ? '' : 's'}
                </span>
              </div>

              {!carreras || carreras.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay carreras registradas. Creá una carrera primero.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {carreras.map((carrera) => {
                    const checked = selectedCarrerasIds.includes(carrera.id);

                    return (
                      <div key={carrera.id} className="flex items-start gap-3">
                        <Checkbox
                          id={`carrera-${carrera.id}`}
                          checked={checked}
                          onCheckedChange={(value) => toggleCarrera(carrera.id, value === true)}
                        />
                        <Label htmlFor={`carrera-${carrera.id}`} className="cursor-pointer font-normal leading-snug">
                          <span className="font-medium text-foreground">{carrera.codigo}</span>
                          <span className="text-muted-foreground"> — {carrera.nombre}</span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}

              {form.formState.errors.carreras_ids ? (
                <p className="text-xs text-destructive">{form.formState.errors.carreras_ids.message}</p>
              ) : null}
            </div>

            {editingMateria ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <Checkbox
                  id="activa"
                  checked={form.watch('activa')}
                  onCheckedChange={(value) => form.setValue('activa', value === true)}
                />
                <Label htmlFor="activa" className="cursor-pointer font-normal">
                  Materia activa (desmarcá para dejar inactiva sin borrar el registro)
                </Label>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !carreras?.length}>
                {editingMateria ? 'Guardar Cambios' : 'Crear Materia'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

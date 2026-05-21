import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// --- DATA TYPES & SCHEMAS ---

export type Carrera = {
  id: number;
  institucion: 'ices' | 'ucse' | 'otro_convenio';
  codigo: string;
  nombre: string;
  duracion_anios: number;
};

const carreraSchema = z.object({
  institucion: z.enum(['ices', 'ucse', 'otro_convenio']),
  codigo: z.string().min(1, 'El código es obligatorio.'),
  nombre: z.string().min(1, 'El nombre es obligatorio.'),
  duracion_anios: z.coerce.number().min(1, 'Debe ser al menos 1.'),
});

type CarreraFormValues = z.infer<typeof carreraSchema>;

// --- API ACTIONS ---

async function fetchCarreras(): Promise<Carrera[]> {
  const { data } = await api.get<Carrera[]>('/academico/carreras');
  return data;
}

async function createCarrera(payload: CarreraFormValues): Promise<Carrera> {
  const { data } = await api.post<Carrera>('/academico/carreras', payload);
  return data;
}

async function updateCarrera({ id, payload }: { id: number; payload: CarreraFormValues }): Promise<Carrera> {
  const { data } = await api.put<Carrera>(`/academico/carreras/${id}`, payload);
  return data;
}

async function deleteCarrera(id: number): Promise<void> {
  await api.delete(`/academico/carreras/${id}`);
}

// --- MAIN PAGE COMPONENT ---

export function CarrerasPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCarrera, setEditingCarrera] = useState<Carrera | null>(null);

  const { data: carreras, isLoading, isError } = useQuery({
    queryKey: ['academico', 'carreras'],
    queryFn: fetchCarreras,
  });

  const createMutation = useMutation({
    mutationFn: createCarrera,
    onSuccess: () => {
      toast.success('Carrera creada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'carreras'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateCarrera,
    onSuccess: () => {
      toast.success('Carrera actualizada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'carreras'] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCarrera,
    onSuccess: () => {
      toast.success('Carrera eliminada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['academico', 'carreras'] });
    },
  });

  const form = useForm<CarreraFormValues>({
    resolver: zodResolver(carreraSchema) as any,
    defaultValues: {
      institucion: 'ices',
      codigo: '',
      nombre: '',
      duracion_anios: 1,
    },
  });

  const handleOpenNew = () => {
    setEditingCarrera(null);
    form.reset({ institucion: 'ices', codigo: '', nombre: '', duracion_anios: 1 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (carrera: Carrera) => {
    setEditingCarrera(carrera);
    form.reset({
      institucion: carrera.institucion,
      codigo: carrera.codigo,
      nombre: carrera.nombre,
      duracion_anios: carrera.duracion_anios,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCarrera(null);
    form.reset();
  };

  const onSubmit = (values: CarreraFormValues) => {
    if (editingCarrera) {
      updateMutation.mutate({ id: editingCarrera.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Gestión de Carreras</h1>
          <p className="text-muted-foreground mt-1 text-sm">Administrá las carreras impartidas en la institución.</p>
        </div>
        <Button onClick={handleOpenNew} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nueva Carrera
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-destructive">
            Ocurrió un error al cargar las carreras.
          </div>
        ) : !carreras || carreras.length === 0 ? (
          <div className="p-10 pl-6 text-center text-muted-foreground">
            No hay carreras registradas. Creá una para empezar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Institución</TableHead>
                <TableHead className="text-right">Duración</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carreras.map((carrera) => (
                <TableRow key={carrera.id}>
                  <TableCell className="font-medium text-primary">{carrera.codigo}</TableCell>
                  <TableCell>{carrera.nombre}</TableCell>
                  <TableCell className="uppercase">{carrera.institucion.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right">{carrera.duracion_anios} años</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(carrera)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (confirm('¿Estás seguro de eliminar esta carrera? Esta acción es irreversible.')) {
                            deleteMutation.mutate(carrera.id);
                          }
                        }}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCarrera ? 'Editar Carrera' : 'Nueva Carrera'}</DialogTitle>
            <DialogDescription>
              {editingCarrera ? 'Modificá los datos de la carrera.' : 'Completá los datos para registrar la nueva carrera.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="institucion">Institución</Label>
              <Select
                value={form.watch('institucion')}
                onValueChange={(val: 'ices' | 'ucse' | 'otro_convenio') => form.setValue('institucion', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una institución" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ices">ICES</SelectItem>
                  <SelectItem value="ucse">UCSE</SelectItem>
                  <SelectItem value="otro_convenio">Otro Convenio</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.institucion && (
                <p className="text-xs text-destructive">{form.formState.errors.institucion.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" {...form.register('codigo')} placeholder="Ej: ISI, LADM" />
              {form.formState.errors.codigo && (
                <p className="text-xs text-destructive">{form.formState.errors.codigo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la Carrera</Label>
              <Input id="nombre" {...form.register('nombre')} placeholder="Ej: Ingeniería en Sistemas de Información" />
              {form.formState.errors.nombre && (
                <p className="text-xs text-destructive">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duracion_anios">Duración (años)</Label>
              <Input id="duracion_anios" type="number" {...form.register('duracion_anios')} />
              {form.formState.errors.duracion_anios && (
                <p className="text-xs text-destructive">{form.formState.errors.duracion_anios.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCarrera ? 'Guardar Cambios' : 'Crear Carrera'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

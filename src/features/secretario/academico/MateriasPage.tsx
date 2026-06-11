import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Library, Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState<Materia | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [carreraFilter, setCarreraFilter] = useState('Todas');
  const [estadoFilter, setEstadoFilter] = useState('Todas');
  
  const navigate = useNavigate();

  const { data: materias, isLoading, isError } = useQuery({
    queryKey: ['academico', 'materias'],
    queryFn: () => fetchMaterias(true),
  });

  const { data: carreras, isLoading: isLoadingCarreras } = useQuery({
    queryKey: ['academico', 'carreras'],
    queryFn: fetchCarreras,
  });

  const filteredMaterias = useMemo(() => {
    if (!materias) return [];
    
    return materias.filter((materia) => {
      const matchesSearch = searchTerm === '' || 
        materia.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        materia.codigo_siu.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesCarrera = carreraFilter === 'Todas' || 
        materia.carreras.some(c => c.id.toString() === carreraFilter);
        
      const matchesEstado = estadoFilter === 'Todas' || 
        (estadoFilter === 'Activas' && materia.activa) ||
        (estadoFilter === 'Inactivas' && !materia.activa);
        
      return matchesSearch && matchesCarrera && matchesEstado;
    });
  }, [materias, searchTerm, carreraFilter, estadoFilter]);

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
          <Button onClick={handleOpenNew} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nueva Materia
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o código SIU..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={carreraFilter} onValueChange={setCarreraFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Carrera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas las carreras</SelectItem>
            {carreras?.map(c => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.codigo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todos los estados</SelectItem>
            <SelectItem value="Activas">Activas</SelectItem>
            <SelectItem value="Inactivas">Inactivas</SelectItem>
          </SelectContent>
        </Select>

        {(searchTerm !== '' || carreraFilter !== 'Todas' || estadoFilter !== 'Todas') && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setSearchTerm('');
              setCarreraFilter('Todas');
              setEstadoFilter('Todas');
            }}
            className="px-2"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isPageLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-destructive">Ocurrió un error al cargar las materias.</div>
        ) : !materias || materias.length === 0 ? (
          <EmptyState
            icon={Library}
            title="Sin materias registradas"
            description="No hay materias cargadas en el sistema. Empezá por crear una nueva materia."
            actionLabel="Nueva Materia"
            actionIcon={Plus}
            onAction={handleOpenNew}
          />
        ) : filteredMaterias.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No se encontraron materias"
            description="No hay resultados que coincidan con los filtros de búsqueda."
            actionLabel="Limpiar filtros"
            actionIcon={X}
            onAction={() => {
              setSearchTerm('');
              setCarreraFilter('Todas');
              setEstadoFilter('Todas');
            }}
          />
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
              {filteredMaterias.map((materia) => (
                <TableRow 
                  key={materia.id} 
                  className={cn("cursor-pointer hover:bg-muted/50 transition-colors", !materia.activa ? 'opacity-75' : undefined)}
                  onClick={() => navigate(`/secretario/materias/${materia.id}`)}
                >
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
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenEdit(materia); }} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {materia.activa ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
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

      <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
        <SheetContent className="sm:max-w-[520px] overflow-y-auto w-full">
          <SheetHeader>
            <SheetTitle>{editingMateria ? 'Editar Materia' : 'Nueva Materia'}</SheetTitle>
            <SheetDescription>
              {editingMateria
                ? 'Modificá los datos, las carreras asociadas o reactivá la materia marcando "Materia activa".'
                : 'Completá los datos y seleccioná al menos una carrera.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 px-4 sm:px-6 py-4 pb-8">
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
        </SheetContent>
      </Sheet>
    </div>
  );
}

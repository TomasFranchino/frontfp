import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, X, Users, ArrowRight, BookX } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  type DocenteOut,
  type MensajeOut,
  formatNombreCompleto,
  getBackendMessage,
} from '@/features/secretario/usuarios/types';

const usuarioFormSchema = z
  .object({
    username: z.string().min(1, 'El DNI es obligatorio.'),
    first_name: z.string().min(1, 'El nombre es obligatorio.'),
    last_name: z.string().min(1, 'El apellido es obligatorio.'),
    email: z.string().email('Ingresá un email válido.'),
    password: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.password?.trim()) {
      return;
    }

    if (values.password.trim().length < 6) {
      ctx.addIssue({
        code: 'custom',
        message: 'La contraseña debe tener al menos 6 caracteres.',
        path: ['password'],
      });
    }
  });

type UsuarioFormValues = z.infer<typeof usuarioFormSchema>;

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
  id: number;
  docente_id: number;
  materia_id: number;
  rol: string;
  activa?: boolean;
  fecha_inicio: string;
  fecha_fin?: string | null;
};

async function fetchAsignacionesDocente(docenteId: number): Promise<Asignacion[]> {
  const { data } = await api.get<Asignacion[]>('/asignaciones/', { params: { docente_id: docenteId } });
  return data;
}

async function fetchMaterias(): Promise<Materia[]> {
  const { data } = await api.get<Materia[]>('/academico/materias', { params: { incluir_inactivas: true } });
  return data;
}

async function fetchDocentes(incluirInactivos: boolean): Promise<DocenteOut[]> {
  const { data } = await api.get<DocenteOut[]>('/auth/docentes', {
    params: { incluir_inactivos: incluirInactivos },
  });
  return data;
}

async function createDocente(payload: UsuarioFormValues): Promise<DocenteOut> {
  const { data } = await api.post<DocenteOut>('/auth/docentes', {
    username: payload.username,
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    password: payload.password,
  });
  return data;
}

async function updateDocente({
  id,
  payload,
}: {
  id: number;
  payload: Omit<UsuarioFormValues, 'password'> & { password?: string };
}): Promise<MensajeOut> {
  const { data } = await api.put<MensajeOut>(`/auth/docentes/${id}`, payload);
  return data;
}

async function toggleDocenteEstado({
  id,
  activo,
}: {
  id: number;
  activo: boolean;
}): Promise<MensajeOut> {
  const { data } = await api.patch<MensajeOut>(`/auth/docentes/${id}/estado`, { activo });
  return data;
}
interface DocenteEstadoButtonProps {
  activo: boolean;
  pending: boolean;
  onClick: () => void;
}

function DocenteEstadoButton({ activo, pending, onClick }: DocenteEstadoButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  let label: string;
  let className: string;

  if (pending) {
    label = 'Cargando...';
    className = 'border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed';
  } else if (activo) {
    if (isHovered) {
      label = 'Desactivar';
      className = 'border-border bg-muted text-muted-foreground shadow-sm cursor-pointer';
    } else {
      label = 'Activo';
      className = 'border-green-200 bg-green-100 text-green-700 shadow-sm';
    }
  } else {
    if (isHovered) {
      label = 'Activar';
      className = 'border-green-200 bg-green-100 text-green-700 shadow-sm cursor-pointer';
    } else {
      label = 'Inactivo';
      className = 'border-border bg-muted text-muted-foreground shadow-sm';
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-200 min-w-[90px] h-7 ${className}`}
    >
      {label}
    </button>
  );
}

function DocenteAsignacionesModal({
  docente,
  isOpen,
  onClose
}: {
  docente: DocenteOut | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const { data: asignaciones, isLoading: isLoadingAsignaciones } = useQuery({
    queryKey: ['asignaciones', 'docente', docente?.id],
    queryFn: () => fetchAsignacionesDocente(docente!.id),
    enabled: !!docente && isOpen,
  });

  const { data: materias, isLoading: isLoadingMaterias } = useQuery({
    queryKey: ['academico', 'materias', 'all'],
    queryFn: fetchMaterias,
    enabled: !!docente && isOpen,
  });

  const isLoading = isLoadingAsignaciones || isLoadingMaterias;

  const materiasById = useMemo(() => new Map((materias ?? []).map(m => [m.id, m])), [materias]);

  const activeAsignaciones = useMemo(() => {
    if (!asignaciones) return [];
    return asignaciones.filter(a => a.activa !== false);
  }, [asignaciones]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Materias Asignadas</DialogTitle>
          <DialogDescription>
            {docente ? `Asignaciones activas de ${formatNombreCompleto(docente.user)}` : 'Cargando...'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : activeAsignaciones.length === 0 ? (
            <EmptyState
              icon={BookX}
              title="Sin materias asignadas"
              description="Este docente no tiene materias activas asignadas en este momento."
              actionLabel="Asignar Materia"
              actionIcon={Plus}
              onAction={() => {
                onClose();
                navigate('/secretario/materias');
              }}
            />
          ) : (
            <div className="grid gap-3">
              {activeAsignaciones.map((asignacion) => {
                const materia = materiasById.get(asignacion.materia_id);
                if (!materia) return null;

                return (
                  <div
                    key={asignacion.id}
                    className="rounded-xl border bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent/50 hover:border-primary/30 transition-all group overflow-hidden"
                    onClick={() => {
                      onClose();
                      navigate(`/secretario/materias/${materia.id}`);
                    }}
                  >
                    <div className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-primary truncate">
                            {materia.nombre}
                          </h4>
                          {materia.carreras && materia.carreras.length > 0 && (
                            <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {materia.carreras.map(c => c.codigo).join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="capitalize text-foreground font-medium">Rol: {asignacion.rol}</span>
                          <span>Desde: {asignacion.fecha_inicio}</span>
                          <span className="text-[10px] font-mono bg-muted/50 px-1 py-0.5 rounded border border-border/50">SIU: {materia.codigo_siu}</span>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground text-primary transition-colors">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DocentesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocente, setEditingDocente] = useState<DocenteOut | null>(null);
  const [viewingDocenteAsignaciones, setViewingDocenteAsignaciones] = useState<DocenteOut | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('Todos');

  const { data: docentes, isLoading, isError } = useQuery({
    queryKey: ['docentes'],
    queryFn: () => fetchDocentes(true),
  });

  const filteredDocentes = useMemo(() => {
    if (!docentes) return [];

    return docentes.filter((docente) => {
      const matchesSearch = searchTerm === '' ||
        docente.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        docente.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        docente.user.username.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEstado = estadoFilter === 'Todos' ||
        (estadoFilter === 'Activos' && docente.activo) ||
        (estadoFilter === 'Inactivos' && !docente.activo);

      return matchesSearch && matchesEstado;
    });
  }, [docentes, searchTerm, estadoFilter]);

  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioFormSchema),
    defaultValues: {
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: createDocente,
    onSuccess: () => {
      toast.success('Docente creado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateDocente,
    onSuccess: (data) => {
      toast.success(getBackendMessage(data, 'Docente actualizado correctamente.'));
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      handleCloseDialog();
    },
  });

  const estadoMutation = useMutation({
    mutationFn: toggleDocenteEstado,
    onSuccess: (data) => {
      toast.success(getBackendMessage(data, 'Estado actualizado correctamente.'));
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
    },
  });

  const handleOpenCreate = () => {
    setEditingDocente(null);
    form.reset({
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (docente: DocenteOut) => {
    setEditingDocente(docente);
    form.reset({
      username: docente.user.username,
      first_name: docente.user.first_name,
      last_name: docente.user.last_name,
      email: docente.user.email,
      password: '',
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDocente(null);
    form.reset();
  };

  const onSubmit = (values: UsuarioFormValues) => {
    if (editingDocente) {
      const payload: Omit<UsuarioFormValues, 'password'> & { password?: string } = {
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
      };

      if (values.password?.trim()) {
        payload.password = values.password.trim();
      }

      updateMutation.mutate({ id: editingDocente.id, payload });
      return;
    }

    if (!values.password?.trim()) {
      form.setError('password', { message: 'La contraseña es obligatoria al crear.' });
      return;
    }

    createMutation.mutate({
      ...values,
      password: values.password.trim(),
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Gestión de Docentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrá las cuentas de acceso de los profesores al sistema.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={handleOpenCreate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Docente
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, apellido o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los estados</SelectItem>
            <SelectItem value="Activos">Activos</SelectItem>
            <SelectItem value="Inactivos">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        {(searchTerm !== '' || estadoFilter !== 'Todos') && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchTerm('');
              setEstadoFilter('Todos');
            }}
            className="px-2"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar los docentes.</div>
        ) : !docentes || docentes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin docentes registrados"
            description="No hay docentes cargados en el sistema. Empezá por registrar uno nuevo."
            actionLabel="Nuevo Docente"
            actionIcon={Plus}
            onAction={handleOpenCreate}
          />
        ) : filteredDocentes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron docentes"
            description="No hay resultados que coincidan con los filtros de búsqueda."
            actionLabel="Limpiar filtros"
            actionIcon={X}
            onAction={() => {
              setSearchTerm('');
              setEstadoFilter('Todos');
            }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DNI / Usuario</TableHead>
                <TableHead>Nombre Completo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[160px] text-center">Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocentes.map((docente) => (
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  key={docente.id}
                  onClick={() => setViewingDocenteAsignaciones(docente)}>
                  <TableCell className="font-medium text-primary">{docente.user.username}</TableCell>
                  <TableCell>{formatNombreCompleto(docente.user)}</TableCell>
                  <TableCell>{docente.user.email}</TableCell>
                  <TableCell className="text-center">
                    <DocenteEstadoButton
                      activo={docente.activo}
                      pending={estadoMutation.isPending}
                      onClick={() => estadoMutation.mutate({ id: docente.id, activo: !docente.activo })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(docente)}
                        aria-label="Editar docente"
                        title="Editar datos"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingDocente ? 'Editar Docente' : 'Nuevo Docente'}</DialogTitle>
            <DialogDescription>
              {editingDocente
                ? 'Modificá los datos del profesor. La contraseña solo se actualiza si completás el campo.'
                : 'Completá los datos para registrar un nuevo docente en el sistema.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">DNI / Usuario</Label>
              <Input id="username" {...form.register('username')} placeholder="Ej: 30123456" />
              {form.formState.errors.username ? (
                <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre</Label>
                <Input id="first_name" {...form.register('first_name')} />
                {form.formState.errors.first_name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido</Label>
                <Input id="last_name" {...form.register('last_name')} />
                {form.formState.errors.last_name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={
                  editingDocente ? '(Dejar en blanco para mantener la actual)' : 'Contraseña inicial'
                }
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {editingDocente ? 'Guardar Cambios' : 'Crear Docente'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DocenteAsignacionesModal
        docente={viewingDocenteAsignaciones}
        isOpen={!!viewingDocenteAsignaciones}
        onClose={() => setViewingDocenteAsignaciones(null)}
      />
    </div>
  );
}

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  type MensajeOut,
  type SecretarioOut,
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

async function fetchSecretarios(incluirInactivos: boolean): Promise<SecretarioOut[]> {
  const { data } = await api.get<SecretarioOut[]>('/auth/secretarios', {
    params: { incluir_inactivos: incluirInactivos },
  });
  return data;
}

async function createSecretario(payload: UsuarioFormValues): Promise<SecretarioOut> {
  const { data } = await api.post<SecretarioOut>('/auth/secretarios', {
    username: payload.username,
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    password: payload.password,
  });
  return data;
}

async function updateSecretario({
  id,
  payload,
}: {
  id: number;
  payload: Omit<UsuarioFormValues, 'password'> & { password?: string };
}): Promise<MensajeOut> {
  const { data } = await api.put<MensajeOut>(`/auth/secretarios/${id}`, payload);
  return data;
}

async function toggleSecretarioEstado({
  id,
  activo,
}: {
  id: number;
  activo: boolean;
}): Promise<MensajeOut> {
  const { data } = await api.patch<MensajeOut>(`/auth/secretarios/${id}/estado`, { activo });
  return data;
}
interface SecretarioEstadoButtonProps {
  activo: boolean;
  pending: boolean;
  bloqueadoPorCuentaPropia: boolean;
  onClick: () => void;
}

function SecretarioEstadoButton({
  activo,
  pending,
  bloqueadoPorCuentaPropia,
  onClick,
}: SecretarioEstadoButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  let label = '';
  let className = '';

  if (bloqueadoPorCuentaPropia) {
    label = 'Tu cuenta';
    className = 'border-border bg-muted/50 text-muted-foreground cursor-not-allowed';
  } else if (pending) {
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
      disabled={pending || bloqueadoPorCuentaPropia}
      onMouseEnter={() => !bloqueadoPorCuentaPropia && setIsHovered(true)}
      onMouseLeave={() => !bloqueadoPorCuentaPropia && setIsHovered(false)}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-200 min-w-[90px] h-7 ${className}`}
    >
      {label}
    </button>
  );
}

export default function SecretariosPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [incluirInactivos, setIncluirInactivos] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSecretario, setEditingSecretario] = useState<SecretarioOut | null>(null);

  const { data: secretarios, isLoading, isError } = useQuery({
    queryKey: ['secretarios', { incluirInactivos }],
    queryFn: () => fetchSecretarios(incluirInactivos),
  });

  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioFormSchema) as any,
    defaultValues: {
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: createSecretario,
    onSuccess: () => {
      toast.success('Secretario creado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['secretarios'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSecretario,
    onSuccess: (data) => {
      toast.success(getBackendMessage(data, 'Secretario actualizado correctamente.'));
      queryClient.invalidateQueries({ queryKey: ['secretarios'] });
      handleCloseDialog();
    },
  });

  const estadoMutation = useMutation({
    mutationFn: toggleSecretarioEstado,
    onSuccess: (data) => {
      toast.success(getBackendMessage(data, 'Estado actualizado correctamente.'));
      queryClient.invalidateQueries({ queryKey: ['secretarios'] });
    },
  });

  const handleOpenCreate = () => {
    setEditingSecretario(null);
    form.reset({
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (secretario: SecretarioOut) => {
    setEditingSecretario(secretario);
    form.reset({
      username: secretario.user.username,
      first_name: secretario.user.first_name,
      last_name: secretario.user.last_name,
      email: secretario.user.email,
      password: '',
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSecretario(null);
    form.reset();
  };

  const onSubmit = (values: UsuarioFormValues) => {
    if (editingSecretario) {
      const payload: Omit<UsuarioFormValues, 'password'> & { password?: string } = {
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
      };

      if (values.password?.trim()) {
        payload.password = values.password.trim();
      }

      updateMutation.mutate({ id: editingSecretario.id, payload });
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
          <h1 className="text-3xl font-semibold text-primary">Gestión de Secretarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrá las cuentas del personal de secretaría y administración.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Switch
              id="incluir-inactivos-secretarios"
              checked={incluirInactivos}
              onCheckedChange={setIncluirInactivos}
            />
            <Label htmlFor="incluir-inactivos-secretarios" className="cursor-pointer font-normal">
              Incluir inactivos
            </Label>
          </div>

          <Button onClick={handleOpenCreate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Secretario
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar los secretarios.</div>
        ) : !secretarios || secretarios.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No hay secretarios para mostrar con el filtro actual.
          </div>
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
              {secretarios.map((secretario) => {
                const isCurrentUser = currentUser?.id === secretario.user.id;

                return (
                  <TableRow key={secretario.id}>
                    <TableCell className="font-medium text-primary">{secretario.user.username}</TableCell>
                    <TableCell>{formatNombreCompleto(secretario.user)}</TableCell>
                    <TableCell>{secretario.user.email}</TableCell>
                    <TableCell className="text-center">
                      <SecretarioEstadoButton
                        activo={secretario.activo}
                        pending={estadoMutation.isPending}
                        bloqueadoPorCuentaPropia={isCurrentUser}
                        onClick={() => {
                          if (isCurrentUser) {
                            toast.error('No podés desactivar tu propia cuenta.');
                            return;
                          }
                          estadoMutation.mutate({ id: secretario.id, activo: !secretario.activo });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(secretario)}
                        aria-label="Editar secretario"
                      >
                        <Pencil className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingSecretario ? 'Editar Secretario' : 'Nuevo Secretario'}</DialogTitle>
            <DialogDescription>
              {editingSecretario
                ? 'Modificá los datos del administrador. La contraseña solo se actualiza si completás el campo.'
                : 'Completá los datos para registrar un nuevo usuario de secretaría.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 py-4">
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
                  editingSecretario ? '(Dejar en blanco para mantener la actual)' : 'Contraseña inicial'
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
                {editingSecretario ? 'Guardar Cambios' : 'Crear Secretario'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

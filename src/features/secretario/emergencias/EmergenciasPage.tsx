import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type SolicitudEmergencia = {
  id: number;
  docente_nombre: string;
  materia_nombre: string;
  fecha: string;
  estado: string;
  nota_docente: string;
};

type ResolverEmergenciaPayload = {
  id: number;
  aprobar: boolean;
  nota_secretaria: string;
};

const resolverEmergenciaSchema = z.object({
  nota_secretaria: z.string().min(1, 'La nota de Secretaría es obligatoria.'),
});

type ResolverEmergenciaFormValues = z.infer<typeof resolverEmergenciaSchema>;

async function fetchEmergenciasPendientes(): Promise<SolicitudEmergencia[]> {
  const { data } = await api.get<SolicitudEmergencia[]>('/asistencia/admin/emergencias/pendientes');
  return data;
}

async function resolverEmergencia({ id, aprobar, nota_secretaria }: ResolverEmergenciaPayload): Promise<void> {
  await api.patch(`/asistencia/admin/emergencias/${id}/resolver`, {
    aprobar,
    nota_secretaria,
  });
}

export function EmergenciasPage() {
  const queryClient = useQueryClient();
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudEmergencia | null>(null);
  const [approvalIntent, setApprovalIntent] = useState<boolean>(true);

  const {
    data: emergencias,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['asistencia', 'admin', 'emergencias', 'pendientes'],
    queryFn: fetchEmergenciasPendientes,
  });

  const form = useForm<ResolverEmergenciaFormValues>({
    resolver: zodResolver(resolverEmergenciaSchema) as any,
    defaultValues: {
      nota_secretaria: '',
    },
  });

  const resolverMutation = useMutation({
    mutationFn: resolverEmergencia,
    onSuccess: () => {
      toast.success(approvalIntent ? 'Emergencia aprobada correctamente.' : 'Emergencia rechazada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'admin', 'emergencias', 'pendientes'] });
      setSelectedSolicitud(null);
      form.reset({ nota_secretaria: '' });
    },
  });

  const handleOpenResolver = (solicitud: SolicitudEmergencia, aprobar: boolean) => {
    setSelectedSolicitud(solicitud);
    setApprovalIntent(aprobar);
    form.reset({ nota_secretaria: '' });
  };

  const handleCloseResolver = () => {
    setSelectedSolicitud(null);
    form.reset({ nota_secretaria: '' });
  };

  const onSubmit = (values: ResolverEmergenciaFormValues) => {
    if (!selectedSolicitud) {
      return;
    }

    resolverMutation.mutate({
      id: selectedSolicitud.id,
      aprobar: approvalIntent,
      nota_secretaria: values.nota_secretaria,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-primary">Emergencias</h1>
        <p className="mt-1 text-sm text-muted-foreground">Revisá y resolvé las solicitudes pendientes de los profesores.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar las emergencias pendientes.</div>
        ) : !emergencias || emergencias.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No hay emergencias pendientes.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Docente</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Nota docente</TableHead>
                <TableHead className="w-[190px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emergencias.map((solicitud) => (
                <TableRow key={solicitud.id}>
                  <TableCell className="font-medium text-primary">{solicitud.docente_nombre}</TableCell>
                  <TableCell>{solicitud.materia_nombre}</TableCell>
                  <TableCell>{solicitud.fecha}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {solicitud.estado}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal text-muted-foreground">{solicitud.nota_docente}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="gap-2 bg-green-600 text-white hover:bg-green-700"
                        onClick={() => handleOpenResolver(solicitud, true)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprobar
                      </Button>
                      <Button variant="destructive" size="sm" className="gap-2" onClick={() => handleOpenResolver(solicitud, false)}>
                        <XCircle className="h-4 w-4" />
                        Rechazar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={Boolean(selectedSolicitud)} onOpenChange={(open) => (open ? null : handleCloseResolver())}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{approvalIntent ? 'Aprobar emergencia' : 'Rechazar emergencia'}</DialogTitle>
            <DialogDescription>
              {selectedSolicitud
                ? `${selectedSolicitud.docente_nombre} - ${selectedSolicitud.materia_nombre} (${selectedSolicitud.fecha})`
                : 'Resolvé la solicitud seleccionada.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nota_secretaria">Nota de Secretaría</Label>
              <Textarea
                id="nota_secretaria"
                {...form.register('nota_secretaria')}
                placeholder={approvalIntent ? 'Ej: Se aprueba la regularización.' : 'Ej: No corresponde por falta de documentación.'}
              />
              {form.formState.errors.nota_secretaria ? (
                <p className="text-xs text-destructive">{form.formState.errors.nota_secretaria.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseResolver}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={resolverMutation.isPending}
                className={approvalIntent ? 'bg-green-600 text-white hover:bg-green-700' : ''}
                variant={approvalIntent ? 'default' : 'destructive'}
              >
                {approvalIntent ? 'Aprobar' : 'Rechazar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

type SolicitudEmergenciaHistorial = {
  id: number;
  docente_nombre: string;
  materia_nombre: string;
  fecha: string;
  estado: string;
  nota_docente: string;
  nota_secretaria: string;
  revisado_por_nombre: string | null;
  revisado_en: string | null;
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

async function fetchEmergenciasHistorial(): Promise<SolicitudEmergenciaHistorial[]> {
  const { data } = await api.get<SolicitudEmergenciaHistorial[]>('/asistencia/admin/emergencias/historial');
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
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');

  const {
    data: emergencias,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['asistencia', 'admin', 'emergencias', 'pendientes'],
    queryFn: fetchEmergenciasPendientes,
  });

  const {
    data: historial,
    isLoading: isHistorialLoading,
    isError: isHistorialError,
  } = useQuery({
    queryKey: ['asistencia', 'admin', 'emergencias', 'historial'],
    queryFn: fetchEmergenciasHistorial,
    enabled: activeTab === 'historial',
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
      queryClient.invalidateQueries({ queryKey: ['asistencia', 'admin', 'emergencias', 'historial'] });
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
        <p className="mt-1 text-sm text-muted-foreground">Revisá y resolvé las solicitudes pendientes de los profesores o consultá el historial.</p>
      </div>

      {/* Tabs de Navegación */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('pendientes')}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'pendientes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Pendientes
            {emergencias && emergencias.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {emergencias.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'historial'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Historial de Resueltas
          </button>
        </nav>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {activeTab === 'pendientes' ? (
          isLoading ? (
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
          )
        ) : (
          isHistorialLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : isHistorialError ? (
            <div className="p-6 text-center text-destructive">Ocurrió un error al cargar el historial de emergencias.</div>
          ) : !historial || historial.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No hay emergencias resueltas en el historial.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Docente</TableHead>
                  <TableHead>Materia</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Nota docente</TableHead>
                  <TableHead>Resolución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((solicitud) => (
                  <TableRow key={solicitud.id}>
                    <TableCell className="font-medium text-primary">{solicitud.docente_nombre}</TableCell>
                    <TableCell>{solicitud.materia_nombre}</TableCell>
                    <TableCell>{solicitud.fecha}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          solicitud.estado === 'aprobada'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {solicitud.estado}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-normal text-muted-foreground italic">
                      "{solicitud.nota_docente}"
                    </TableCell>
                    <TableCell className="max-w-[300px] whitespace-normal">
                      <div className="text-xs space-y-0.5">
                        <p className="font-medium text-foreground">{solicitud.nota_secretaria}</p>
                        {solicitud.revisado_por_nombre && (
                          <p className="text-[10px] text-muted-foreground">
                            Por: {solicitud.revisado_por_nombre}
                            {solicitud.revisado_en && ` (${new Date(solicitud.revisado_en).toLocaleDateString()} ${new Date(solicitud.revisado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} hs)`}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
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

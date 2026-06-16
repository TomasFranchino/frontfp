import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type EventoCalendario = {
  id: number;
  fecha: string;
  descripcion: string;
};

const eventoSchema = z.object({
  fecha: z.date({ error: 'Seleccioná una fecha.' }),
  descripcion: z.string().min(1, 'La descripción es obligatoria.').max(200, 'Máximo 200 caracteres.'),
});

type EventoFormValues = z.infer<typeof eventoSchema>;

async function fetchEventos(): Promise<EventoCalendario[]> {
  const { data } = await api.get<EventoCalendario[]>('/calendario/');
  return data;
}

async function createEvento(payload: { fecha: string; descripcion: string }): Promise<EventoCalendario> {
  const { data } = await api.post<EventoCalendario>('/calendario/', payload);
  return data;
}

async function deleteEvento(id: number): Promise<void> {
  await api.delete(`/calendario/${id}`);
}

function formatFechaDisplay(fecha: string) {
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return format(date, 'dd/MM/yyyy', { locale: es });
}

export default function CalendarioPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: eventos, isLoading, isError } = useQuery({
    queryKey: ['calendario', 'eventos'],
    queryFn: fetchEventos,
  });

  const form = useForm<EventoFormValues>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      fecha: undefined,
      descripcion: '',
    },
  });

  const selectedDate = form.watch('fecha');

  const createMutation = useMutation({
    mutationFn: createEvento,
    onSuccess: () => {
      toast.success('Evento de calendario creado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos'] });
      setIsDialogOpen(false);
      form.reset({ fecha: undefined, descripcion: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvento,
    onSuccess: () => {
      toast.success('Evento eliminado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos'] });
    },
  });

  const handleOpenDialog = () => {
    form.reset({ fecha: undefined, descripcion: '' });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: EventoFormValues) => {
    createMutation.mutate({
      fecha: format(values.fecha, 'yyyy-MM-dd'),
      descripcion: values.descripcion.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Calendario Académico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registrá feriados y días sin clases para excluirlos del cálculo de ausencias.
          </p>
        </div>
        <Button onClick={handleOpenDialog} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Evento
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar el calendario.</div>
        ) : !eventos || eventos.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No hay eventos registrados. Agregá feriados o días sin actividad.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((evento) => (
                <TableRow key={evento.id}>
                  <TableCell className="font-medium text-primary">{formatFechaDisplay(evento.fecha)}</TableCell>
                  <TableCell>{evento.descripcion}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm('¿Eliminar este evento del calendario?')) {
                          deleteMutation.mutate(evento.id);
                        }
                      }}
                      aria-label="Eliminar evento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Nuevo Evento</DialogTitle>
            <DialogDescription>
              Marcá un día como feriado o sin clases teóricas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, 'dd/MM/yyyy', { locale: es })
                      : 'Seleccioná una fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        form.setValue('fecha', date, { shouldValidate: true });
                      }
                    }}
                    locale={es}
                    captionLayout="dropdown"
                    startMonth={new Date(2020, 0)}
                    endMonth={new Date(2035, 11)}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.fecha ? (
                <p className="text-xs text-destructive">{form.formState.errors.fecha.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                {...form.register('descripcion')}
                placeholder="Ej: Feriado nacional, Receso docente..."
              />
              {form.formState.errors.descripcion ? (
                <p className="text-xs text-destructive">{form.formState.errors.descripcion.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Crear Evento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

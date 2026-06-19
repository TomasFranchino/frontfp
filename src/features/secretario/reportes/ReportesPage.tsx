import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarIcon, Download, Eye } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { toast } from 'sonner';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type InstitucionFilter = string;
type AgruparPorFilter = 'docente' | 'carrera' | 'materia';

type CarreraResumen = {
  id: number;
  institucion: string;
  codigo: string;
  nombre: string;
};

type DetalleFalta = {
  fecha: string;
  materia_nombre: string;
  docente_nombre?: string;
  dia_semana: string;
  hora_inicio: string;
  evento_calendario?: string | null;
};

type ReporteFila = {
  id: number;
  codigo?: string | null;
  nombre: string;
  total_clases_esperadas: number;
  total_asistencias: number;
  total_ausencias: number;
  detalle_ausencias: DetalleFalta[];
};

type ReportesResponse = {
  desde: string;
  hasta: string;
  institucion: string | null;
  agrupar_por: AgruparPorFilter;
  resultados: ReporteFila[];
};

function normalizeReportes(data: ReportesResponse): ReporteFila[] {
  return data?.resultados ?? [];
}

function buildReportParams(desde: Date, hasta: Date, institucion: InstitucionFilter, agrupar_por: AgruparPorFilter) {
  return {
    desde: format(desde, 'yyyy-MM-dd'),
    hasta: format(hasta, 'yyyy-MM-dd'),
    agrupar_por,
    ...(institucion !== 'todas' ? { institucion } : {}),
  };
}

async function fetchReporteAusencias(desde: Date, hasta: Date, institucion: InstitucionFilter, agrupar_por: AgruparPorFilter): Promise<ReporteFila[]> {
  const { data } = await api.get<ReportesResponse>('/reportes/ausencias', {
    params: buildReportParams(desde, hasta, institucion, agrupar_por),
  });

  return normalizeReportes(data);
}

async function downloadReporteExcel(desde: Date, hasta: Date, institucion: InstitucionFilter) {
  const response = await api.get<Blob>('/reportes/exportar', {
    params: {
      desde: format(desde, 'yyyy-MM-dd'),
      hasta: format(hasta, 'yyyy-MM-dd'),
      ...(institucion !== 'todas' ? { institucion } : {}),
    },
    responseType: 'blob',
  });

  const blobUrl = URL.createObjectURL(response.data);
  const fileNameParts = [
    'reporte-inasistencias',
    format(desde, 'yyyyMMdd'),
    format(hasta, 'yyyyMMdd'),
    institucion !== 'todas' ? institucion.toLowerCase() : 'todas',
  ];
  const link = document.createElement('a');

  link.href = blobUrl;
  link.download = `${fileNameParts.join('-')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export function ReportesPage() {
  const now = new Date();
  const [desde, setDesde] = useState<Date | undefined>(startOfMonth(now));
  const [hasta, setHasta] = useState<Date | undefined>(now);
  const [institucion, setInstitucion] = useState<string>('todas');
  const [agruparPor, setAgruparPor] = useState<AgruparPorFilter>('docente');
  const [selectedReporte, setSelectedReporte] = useState<ReporteFila | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Consultamos carreras para obtener la lista de instituciones únicas de forma dinámica
  const { data: carreras } = useQuery({
    queryKey: ['academico', 'carreras'],
    queryFn: async () => {
      const { data } = await api.get<CarreraResumen[]>('/academico/carreras');
      return data;
    },
  });

  const filterInstitutions = useMemo(() => {
    if (!carreras) return ['ices', 'ucse'];
    const unique = Array.from(new Set(carreras.map((c) => c.institucion)))
      .filter((inst): inst is string => Boolean(inst));
    return unique;
  }, [carreras]);

  const reportParams = useMemo(() => ({ desde, hasta, institucion, agruparPor }), [desde, hasta, institucion, agruparPor]);

  const {
    data: reportes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['reportes', 'ausencias', reportParams],
    queryFn: () => desde && hasta ? fetchReporteAusencias(desde, hasta, institucion, agruparPor) : Promise.resolve([]),
    enabled: Boolean(desde && hasta),
  });

  const handleDownload = async () => {
    if (!desde || !hasta) return;
    setIsDownloading(true);

    try {
      await downloadReporteExcel(desde, hasta, institucion);
      toast.success('Excel descargado correctamente.');
    } catch {
      toast.error('Ocurrió un error al descargar el reporte.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Reportes Mensuales</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consultá asistencia consolidada por docente, carrera o materia y exportá a Excel.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 xl:justify-end">
          <div className="space-y-2 w-full sm:w-[160px]">
            <Label>Desde</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !desde && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {desde ? format(desde, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={desde} onSelect={(date) => date && setDesde(date)} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 w-full sm:w-[160px]">
            <Label>Hasta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !hasta && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {hasta ? format(hasta, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={hasta} onSelect={(date) => date && setHasta(date)} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 w-full sm:w-[150px]">
            <Label>Institución</Label>
            <Select value={institucion} onValueChange={(value: string) => setInstitucion(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {filterInstitutions.map((inst) => (
                  <SelectItem key={inst} value={inst}>
                    {['ices', 'ucse', 'otro_convenio'].includes(inst)
                      ? inst.replace('_', ' ').toUpperCase()
                      : inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 w-full sm:w-[150px]">
            <Label>Agrupar por</Label>
            <Select value={agruparPor} onValueChange={(value: AgruparPorFilter) => setAgruparPor(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Docente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="docente">Docente</SelectItem>
                <SelectItem value="carrera">Carrera</SelectItem>
                <SelectItem value="materia">Materia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleDownload} disabled={isDownloading || !desde || !hasta} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-primary-foreground w-full sm:w-auto">
            <Download className="h-4 w-4" />
            {isDownloading ? 'Descargando...' : 'Descargar Excel'}
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
          <div className="p-6 text-center text-destructive">Ocurrió un error al cargar el reporte mensual.</div>
        ) : !reportes || reportes.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No hay datos de asistencia para los filtros seleccionados.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {agruparPor === 'docente' ? 'Nombre del Docente' : agruparPor === 'carrera' ? 'Carrera' : 'Materia'}
                </TableHead>
                <TableHead className="text-right">Clases Esperadas</TableHead>
                <TableHead className="text-right">Asistencias</TableHead>
                <TableHead className="text-right">Ausencias</TableHead>
                <TableHead className="w-[150px] text-right">Detalle Faltas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportes.map((reporte) => (
                <TableRow key={reporte.id ?? reporte.nombre}>
                  <TableCell className="font-medium text-primary">
                    {reporte.codigo ? `[${reporte.codigo}] ${reporte.nombre}` : reporte.nombre}
                  </TableCell>
                  <TableCell className="text-right">{reporte.total_clases_esperadas}</TableCell>
                  <TableCell className="text-right text-green-700">{reporte.total_asistencias}</TableCell>
                  <TableCell className="text-right text-destructive">{reporte.total_ausencias}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedReporte(reporte)}>
                      <Eye className="h-4 w-4" />
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={Boolean(selectedReporte)} onOpenChange={(open) => (open ? null : setSelectedReporte(null))}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Detalle Faltas / Inasistencias</DialogTitle>
            <DialogDescription>
              {selectedReporte ? (selectedReporte.codigo ? `[${selectedReporte.codigo}] ${selectedReporte.nombre}` : selectedReporte.nombre) : 'Entidad seleccionada'}
            </DialogDescription>
          </DialogHeader>

          {!selectedReporte?.detalle_ausencias?.length ? (
            <div className="rounded-lg border border-border bg-brand-neutral p-4 text-sm text-muted-foreground">
              No se registran inasistencias en el período seleccionado.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Fecha</TableHead>
                    {agruparPor !== 'materia' && <TableHead>Materia</TableHead>}
                    {agruparPor !== 'docente' && <TableHead>Docente</TableHead>}
                    <TableHead className="w-[130px]">Día y Hora</TableHead>
                    <TableHead className="w-[180px]">Calendario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReporte.detalle_ausencias.map((falta, index) => {
                    // Formatear fecha para el usuario
                    const [year, month, day] = falta.fecha.split('-');
                    const dateFormatted = `${day}/${month}/${year}`;

                    return (
                      <TableRow key={`${falta.fecha}-${falta.materia_nombre}-${index}`}>
                        <TableCell className="font-medium text-primary">{dateFormatted}</TableCell>
                        {agruparPor !== 'materia' && <TableCell className="max-w-[150px] truncate">{falta.materia_nombre}</TableCell>}
                        {agruparPor !== 'docente' && <TableCell className="max-w-[150px] truncate">{falta.docente_nombre}</TableCell>}
                        <TableCell className="text-muted-foreground text-sm">
                          {falta.dia_semana} ({falta.hora_inicio} hs)
                        </TableCell>
                        <TableCell>
                          {falta.evento_calendario ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                              ⚠️ Feriado: {falta.evento_calendario}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                              Laborable normal
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

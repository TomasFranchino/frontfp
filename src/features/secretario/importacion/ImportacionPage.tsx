import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

type ErrorValidacion = {
  hoja: string;
  fila: number;
  columna: string;
  valor_recibido: string;
  mensaje: string;
};

type ResumenImportacion = {
  success: boolean;
  docentes_creados: number;
  docentes_actualizados: number;
  carreras_creadas: number;
  carreras_actualizadas: number;
  materias_creadas: number;
  materias_actualizadas: number;
  horarios_creados: number;
  asignaciones_creadas: number;
  asignaciones_actualizadas: number;
  materia_carrera_creadas: number;
  materia_carrera_actualizadas: number;
};

type ProgresoSSE = {
  estado: string;
  fase: string;
  paso: string;
  progreso: number;
  resultado?: ResumenImportacion | null;
  errores?: ErrorValidacion[] | null;
};

type ImportState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'processing'; fase: string; paso: string; progreso: number }
  | { status: 'success'; resultado: ResumenImportacion }
  | { status: 'validation_error'; errores: ErrorValidacion[] }
  | { status: 'system_error'; mensaje: string };

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function downloadErrorsAsCSV(errores: ErrorValidacion[]) {
  const header = 'Hoja,Fila,Columna,Valor Recibido,Mensaje\n';
  const rows = errores
    .map(
      (e) =>
        `"${e.hoja}","${e.fila}","${e.columna}","${e.valor_recibido.replace(/"/g, '""')}","${e.mensaje.replace(/"/g, '""')}"`,
    )
    .join('\n');
  const blob = new Blob(['\ufeff' + header + rows], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'errores_importacion.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────
// Componentes internos
// ─────────────────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  current,
  label,
}: {
  step: number;
  current: number;
  label: string;
}) {
  const isDone = current > step;
  const isActive = current === step;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
          isDone
            ? 'bg-emerald-500 text-white'
            : isActive
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span
        className={`text-sm font-medium transition-colors ${isActive ? 'text-primary' : isDone ? 'text-emerald-600' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
    </div>
  );
}

function ProgressBar({ value, fase }: { value: number; fase: string }) {
  const faseLabel = fase === 'validacion' ? 'Validando datos' : fase === 'persistencia' ? 'Guardando en base de datos' : 'Procesando';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-primary">{faseLabel}</span>
        <span className="tabular-nums text-muted-foreground">{value}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-primary to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  created,
  updated,
}: {
  label: string;
  created: number;
  updated: number;
}) {
  const total = created + updated;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{total}</p>
      <div className="mt-1 flex gap-3 text-xs">
        {created > 0 && (
          <span className="text-emerald-600">+{created} nuevos</span>
        )}
        {updated > 0 && (
          <span className="text-blue-600">↻ {updated} actualizados</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

export function ImportacionPage() {
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorFilter, setErrorFilter] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const currentStep =
    state.status === 'idle' || state.status === 'uploading'
      ? 1
      : state.status === 'processing'
        ? 2
        : 3;

  // ── Drag & Drop ─────────────────────────────────────────────────────

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((file: File | undefined) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo excede los 5 MB permitidos.');
      return;
    }

    const isExcelType =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === ''; // Fallback si el OS no detecta el MIME type

    const isExcelExt = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isExcelType || !isExcelExt) {
      toast.error('Solo se aceptan archivos Excel (.xlsx o .xls) válidos.');
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  }, [handleFileSelect]);

  // ── Download plantilla ──────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/importacion/plantilla', {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_importacion_siu.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar la plantilla');
    }
  };

  // ── SSE Connection ──────────────────────────────────────────────────

  const connectSSE = (taskId: string) => {
    const baseUrl = import.meta.env.VITE_API_URL;
    const source = new EventSource(`${baseUrl}/importacion/progreso/${taskId}`, {
      withCredentials: true,
    });
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const data: ProgresoSSE = JSON.parse(event.data);

        if (data.estado === 'completado' && data.resultado) {
          setState({ status: 'success', resultado: data.resultado });
          toast.success('Importación finalizada exitosamente');
          source.close();
        } else if (data.estado === 'error_validacion' && data.errores) {
          setState({ status: 'validation_error', errores: data.errores });
          source.close();
        } else if (data.estado === 'error_sistema') {
          setState({
            status: 'system_error',
            mensaje: data.paso || 'Error inesperado del sistema',
          });
          source.close();
        } else if (data.estado === 'no_encontrado') {
          setState({
            status: 'system_error',
            mensaje: 'No se encontró la tarea de importación',
          });
          source.close();
        } else {
          setState({
            status: 'processing',
            fase: data.fase || '',
            paso: data.paso || '',
            progreso: data.progreso || 0,
          });
        }
      } catch {
        // Parse error — ignore
      }
    };

    source.onerror = () => {
      source.close();
      if (state.status === 'processing') {
        setState({
          status: 'system_error',
          mensaje: 'Se perdió la conexión con el servidor',
        });
      }
    };
  };

  // ── Upload ──────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Seleccioná un archivo Excel antes de importar');
      return;
    }

    setState({ status: 'uploading' });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data } = await api.post<{ task_id: string }>('/importacion/siu', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Skip-Toast': 'true' },
      });

      setState({ status: 'processing', fase: 'validacion', paso: 'Conectando…', progreso: 0 });
      connectSSE(data.task_id);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ||
        'No se pudo subir el archivo';
      setState({ status: 'system_error', mensaje: message });
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────

  const handleReset = () => {
    eventSourceRef.current?.close();
    setState({ status: 'idle' });
    setSelectedFile(null);
    setErrorFilter('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Filtered errors ─────────────────────────────────────────────────

  const errores =
    state.status === 'validation_error' ? state.errores : [];
  const hojas = [...new Set(errores.map((e) => e.hoja))];
  const filteredErrors = errorFilter
    ? errores.filter((e) => e.hoja === errorFilter)
    : errores;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-primary">
            Importación SIU
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá un archivo Excel para crear o actualizar datos académicos en
            lote.
          </p>
        </div>

        <Button
          onClick={handleDownloadTemplate}
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 self-start md:self-auto"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Descargar plantilla Excel
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
        <StepIndicator step={1} current={currentStep} label="Subir archivo" />
        <div className="h-px flex-1 bg-border" />
        <StepIndicator step={2} current={currentStep} label="Procesamiento" />
        <div className="h-px flex-1 bg-border" />
        <StepIndicator step={3} current={currentStep} label="Resultados" />
      </div>

      {/* Step 1: Upload */}
      {(state.status === 'idle' || state.status === 'uploading') && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-all duration-200 ${
              isDragging
                ? 'border-primary bg-primary/5 shadow-inner'
                : selectedFile
                  ? 'border-emerald-400 bg-emerald-50/50'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            {selectedFile ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
                <div className="text-center">
                  <p className="font-medium text-primary">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Listo para importar
                  </p>
                </div>
              </>
            ) : (
              <>
                <UploadCloud
                  className={`h-10 w-10 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground/50'}`}
                />
                <div className="text-center">
                  <p className="font-medium text-muted-foreground">
                    Arrastrá tu archivo Excel aquí
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    o hacé clic para seleccionar (.xlsx, .xls — máx. 5 MB)
                  </p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files?.[0]);
                if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input so same file can be selected again
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            {selectedFile && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Cancelar
              </Button>
            )}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || state.status === 'uploading'}
              className="gap-2"
            >
              {state.status === 'uploading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {state.status === 'uploading' ? 'Subiendo…' : 'Importar archivo'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Processing */}
      {state.status === 'processing' && (
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <h2 className="text-lg font-semibold text-primary">
              Procesando importación
            </h2>
          </div>

          <ProgressBar value={state.progreso} fase={state.fase} />

          <p className="text-sm text-muted-foreground animate-pulse">
            {state.paso}
          </p>
        </div>
      )}

      {/* Step 3a: Success */}
      {state.status === 'success' && (
        <div className="space-y-4">
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <AlertTitle className="text-emerald-800">
              Importación completada exitosamente
            </AlertTitle>
            <AlertDescription className="text-emerald-700">
              Todos los datos del archivo fueron procesados y guardados
              correctamente en la base de datos.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              label="Docentes"
              created={state.resultado.docentes_creados}
              updated={state.resultado.docentes_actualizados}
            />
            <SummaryCard
              label="Carreras"
              created={state.resultado.carreras_creadas}
              updated={state.resultado.carreras_actualizadas}
            />
            <SummaryCard
              label="Materias"
              created={state.resultado.materias_creadas}
              updated={state.resultado.materias_actualizadas}
            />
            <SummaryCard
              label="Horarios"
              created={state.resultado.horarios_creados}
              updated={0}
            />
            <SummaryCard
              label="Asignaciones"
              created={state.resultado.asignaciones_creadas}
              updated={state.resultado.asignaciones_actualizadas}
            />
            <SummaryCard
              label="Materia ↔ Carrera"
              created={state.resultado.materia_carrera_creadas}
              updated={state.resultado.materia_carrera_actualizadas}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Nueva importación
            </Button>
          </div>
        </div>
      )}

      {/* Step 3b: Validation Errors */}
      {state.status === 'validation_error' && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <XCircle className="h-5 w-5" />
            <AlertTitle>Errores de validación</AlertTitle>
            <AlertDescription>
              Se encontraron {errores.length} error(es) en el archivo.{' '}
              <strong>No se guardó ningún dato.</strong> Corregí los errores
              señalados y volvé a subir el archivo.
            </AlertDescription>
          </Alert>

          {/* Filter + Download */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Filtrar por hoja:
              </span>
              <button
                onClick={() => setErrorFilter('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !errorFilter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Todas ({errores.length})
              </button>
              {hojas.map((h) => (
                <button
                  key={h}
                  onClick={() => setErrorFilter(h)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    errorFilter === h
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {h} ({errores.filter((e) => e.hoja === h).length})
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadErrorsAsCSV(errores)}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar errores (CSV)
            </Button>
          </div>

          {/* Error table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px] sticky top-0 bg-card">Hoja</TableHead>
                    <TableHead className="w-[70px] sticky top-0 bg-card">Fila</TableHead>
                    <TableHead className="w-[180px] sticky top-0 bg-card">Columna</TableHead>
                    <TableHead className="w-[140px] sticky top-0 bg-card">Valor</TableHead>
                    <TableHead className="sticky top-0 bg-card">Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredErrors.map((err, idx) => (
                    <TableRow key={`${err.hoja}-${err.fila}-${err.columna}-${idx}`}>
                      <TableCell className="font-medium text-primary">
                        {err.hoja}
                      </TableCell>
                      <TableCell className="tabular-nums">{err.fila}</TableCell>
                      <TableCell className="text-sm">{err.columna}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground" title={err.valor_recibido}>
                        {err.valor_recibido || '—'}
                      </TableCell>
                      <TableCell className="whitespace-normal text-sm text-muted-foreground">
                        {err.mensaje}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Intentar de nuevo
            </Button>
          </div>
        </div>
      )}

      {/* Step 3c: System Error */}
      {state.status === 'system_error' && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Error del sistema</AlertTitle>
            <AlertDescription>{state.mensaje}</AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <UploadCloud className="h-4 w-4" />
              Intentar de nuevo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

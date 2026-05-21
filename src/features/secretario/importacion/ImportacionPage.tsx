import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DetalleErrorImportacion = {
  pestana: string;
  fila: number;
  error: string;
};

type ResumenImportacion = {
  success: boolean;
  carreras_creadas: number;
  materias_creadas: number;
  docentes_creados: number;
  horarios_creados: number;
  asignaciones_creadas: number;
  errores: DetalleErrorImportacion[];
};

async function uploadSiuFile(file: File): Promise<ResumenImportacion> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post<ResumenImportacion>('/importacion/siu', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

export function ImportacionPage() {
  const queryClient = useQueryClient();
  const [inputKey, setInputKey] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ResumenImportacion | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadSiuFile,
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Importación SIU finalizada correctamente.');
      }

      setSummary(data);
      setClientError(null);
      setSelectedFile(null);
      setInputKey((value) => value + 1);

      queryClient.invalidateQueries({ queryKey: ['auth', 'docentes'] });
      queryClient.invalidateQueries({ queryKey: ['academico', 'materias'] });
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
    },
    onError: () => {
      setSummary(null);
      setClientError('No se pudo procesar el archivo. Revisá el formato e intentá nuevamente.');
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setClientError('Seleccioná un archivo Excel antes de importar.');
      return;
    }

    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-primary">Importación SIU</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cargá un archivo Excel exportado desde SIU para crear datos académicos en lote.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="w-full space-y-2">
              <Label htmlFor="siu-file">Archivo Excel SIU</Label>
              <Input
                key={inputKey}
                id="siu-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setClientError(null);
                }}
              />
              {selectedFile ? <p className="text-xs text-muted-foreground">{selectedFile.name}</p> : null}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="gap-2" disabled={uploadMutation.isPending}>
              <UploadCloud className="h-4 w-4" />
              {uploadMutation.isPending ? 'Importando...' : 'Importar archivo'}
            </Button>
          </div>
        </form>
      </div>

      {clientError ? (
        <Alert variant="destructive">
          <AlertTitle>Error de importación</AlertTitle>
          <AlertDescription>{clientError}</AlertDescription>
        </Alert>
      ) : null}

      {summary ? (
        <Alert className={summary.success ? 'border-green-200 bg-green-50 text-green-900' : undefined} variant={summary.success ? 'default' : 'destructive'}>
          <AlertTitle>{summary.success ? 'Importación finalizada' : 'Importación con errores'}</AlertTitle>
          <AlertDescription>
            <div className="space-y-4">
              <p>
                {summary.success
                  ? 'La importación se completó de manera exitosa y todos los registros válidos fueron creados.'
                  : 'La importación finalizó con algunos errores. Ciertos registros de las filas indicadas al final no pudieron procesarse.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Carreras creadas</p>
                  <p className="text-2xl font-semibold text-primary">{summary.carreras_creadas}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Docentes creados</p>
                  <p className="text-2xl font-semibold text-primary">{summary.docentes_creados}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Materias creadas</p>
                  <p className="text-2xl font-semibold text-primary">{summary.materias_creadas}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Horarios creados</p>
                  <p className="text-2xl font-semibold text-primary">{summary.horarios_creados}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Asignaciones creadas</p>
                  <p className="text-2xl font-semibold text-primary">{summary.asignaciones_creadas}</p>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {summary?.errores?.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-primary">Errores detectados</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Pestaña</TableHead>
                <TableHead className="w-[100px]">Fila</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.errores.map((error, idx) => (
                <TableRow key={`${error.pestana}-${error.fila}-${idx}`}>
                  <TableCell className="font-medium text-primary">{error.pestana}</TableCell>
                  <TableCell className="text-primary">{error.fila}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{error.error}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

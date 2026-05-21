import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type UsuarioEstadoToggleProps = {
  activo: boolean;
  disabled?: boolean;
  pending?: boolean;
  onToggle: (activo: boolean) => void;
  bloqueadoPorCuentaPropia?: boolean;
};

export function UsuarioEstadoToggle({
  activo,
  disabled = false,
  pending = false,
  onToggle,
  bloqueadoPorCuentaPropia = false,
}: UsuarioEstadoToggleProps) {
  const accionLabel = activo ? 'Desactivar' : 'Activar';

  return (
    <div className="flex items-center justify-center gap-2">
      <Switch
        checked={activo}
        disabled={disabled || pending}
        onCheckedChange={onToggle}
        aria-label={bloqueadoPorCuentaPropia ? 'No podés cambiar tu propio estado' : accionLabel}
      />
      <span
        className={cn(
          'min-w-[4.5rem] text-left text-xs font-medium',
          bloqueadoPorCuentaPropia
            ? 'text-muted-foreground'
            : activo
              ? 'text-foreground'
              : 'text-muted-foreground',
        )}
      >
        {bloqueadoPorCuentaPropia ? 'Tu cuenta' : accionLabel}
      </span>
    </div>
  );
}

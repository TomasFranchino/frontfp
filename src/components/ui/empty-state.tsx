import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-500',
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 mb-6 ring-8 ring-primary/5">
        <Icon className="h-10 w-10 text-primary/40" strokeWidth={1.5} />
      </div>
      
      <h3 className="text-xl font-semibold text-foreground tracking-tight">{title}</h3>
      
      <p className="text-sm text-muted-foreground max-w-sm mt-2 leading-relaxed">
        {description}
      </p>
      
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-8 gap-2 shadow-sm" size="lg">
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

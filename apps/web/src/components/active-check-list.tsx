import type { ReactNode } from 'react';

type ActiveCheckListProps = {
  className?: string;
  children: ReactNode;
};

type ActiveCheckListItemProps = {
  active?: boolean;
  status?: 'idle' | 'in-progress' | 'complete';
  className?: string;
  children: ReactNode;
};

const buildClassName = (base: string, extra?: string, inactive?: boolean) => {
  const classes = [base];
  if (inactive) classes.push('opacity-60');
  if (extra) classes.push(extra);
  return classes.join(' ');
};

export function ActiveCheckList({ className, children }: ActiveCheckListProps) {
  return (
    <div className={buildClassName('rounded-md border border-border bg-muted/30 text-sm divide-y', className)}>
      {children}
    </div>
  );
}

export function ActiveCheckListItem({
  active = false,
  status = 'idle',
  className,
  children,
}: ActiveCheckListItemProps) {
  const statusContent =
    status === 'complete' ? (
      <span className="text-green-600">✓</span>
    ) : status === 'in-progress' ? (
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
        In progress
      </span>
    ) : null;

  return (
    <div className={buildClassName('flex items-center justify-between px-3 py-2', className, !active)}>
      {children}
      {statusContent}
    </div>
  );
}

'use client';

import * as React from 'react';
import { Card, CardHeader, CardDescription, CardTitle } from '@prediction-club/ui';
import type { LucideIcon } from 'lucide-react';

export type StatTileProps = {
  label: React.ReactNode;
  icon: LucideIcon;

  value: React.ReactNode;

  /** Small secondary text on the bottom-right (or whatever you want) */
  subValue?: React.ReactNode;

  /** Optional element rendered top-right (pill, badge, etc.) */
  right?: React.ReactNode;

  emphasize?: boolean;

  /** Optional override if you want a special hover / selected state */
  className?: string;
};

export function StatTile({
  label,
  icon: Icon,
  value,
  subValue,
  right,
  emphasize = false,
  className,
}: StatTileProps) {
  return (
    <Card
      className={['relative border-border/70 transition-all duration-150', className]
        .filter(Boolean)
        .join(' ')}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
            <CardDescription className="text-sm truncate">{label}</CardDescription>
          </div>

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <CardTitle
            className={[
              'tabular-nums tracking-tight',
              emphasize ? 'text-3xl font-semibold' : 'text-2xl font-semibold',
            ].join(' ')}
          >
            {value}
          </CardTitle>

          {subValue ? (
            <div className="text-xs text-muted-foreground shrink-0">{subValue}</div>
          ) : null}
        </div>
      </CardHeader>
    </Card>
  );
}

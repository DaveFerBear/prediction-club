'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';

type ClubActionPanelProps = {
  title: string;
  description: string;
  helperText?: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
};

export function ClubActionPanel(props: ClubActionPanelProps) {
  const { title, description, helperText, primaryAction, secondaryAction, children } = props;

  return (
    <Card className="border-[color:var(--club-border-strong)] bg-white/90 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {helperText ? (
          <p className="text-xs leading-5 text-[color:var(--club-text-secondary)]">{helperText}</p>
        ) : null}
        {children}
        <div className="space-y-2">
          {primaryAction}
          {secondaryAction}
        </div>
      </CardContent>
    </Card>
  );
}

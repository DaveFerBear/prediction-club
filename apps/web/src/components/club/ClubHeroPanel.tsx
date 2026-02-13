'use client';

import type { ReactNode } from 'react';
import { Badge } from '@prediction-club/ui';

type ClubHeroPanelProps = {
  clubName: string;
  description: string;
  isPublic: boolean;
  membershipLabel?: string | null;
  descriptionContent?: ReactNode;
  actionPanel: ReactNode;
};

export function ClubHeroPanel(props: ClubHeroPanelProps) {
  const { clubName, description, isPublic, membershipLabel, descriptionContent, actionPanel } = props;

  return (
    <section
      className="mb-8 rounded-2xl border p-6 md:p-8"
      style={{
        background: 'var(--club-bg-accent)',
        borderColor: 'var(--club-border-strong)',
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-[color:var(--club-text-primary)] md:text-5xl">
              {clubName}
            </h1>
            <Badge variant="secondary">{isPublic ? 'Public' : 'Private'}</Badge>
            {membershipLabel ? <Badge variant="outline">{membershipLabel}</Badge> : null}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--club-text-secondary)] md:text-base">
            {description}
          </p>
          {descriptionContent ? <div className="mt-5 max-w-4xl">{descriptionContent}</div> : null}
        </div>

        {actionPanel}
      </div>
    </section>
  );
}

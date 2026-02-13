'use client';

import type { ReactNode } from 'react';
import { Card } from '@prediction-club/ui';
import { Activity, Layers, Sigma, TrendingDown, TrendingUp, Users } from 'lucide-react';

type ReturnTone = 'up' | 'down' | 'neutral';

type ClubMetricsPanelProps = {
  activeVolumeText: string;
  returnPct: number | null;
  perfLoading: boolean;
  hasActivity: boolean;
  returnTone: ReturnTone;
  membersCount: number;
  activePredictionsCount: number;
  totalPredictionsCount: number;
};

function MetricCard(props: {
  label: string;
  helper: string;
  value: ReactNode;
  icon: ReactNode;
  emphasized?: boolean;
  tone?: ReturnTone;
  footer?: ReactNode;
}) {
  const { label, helper, value, icon, emphasized = false, tone = 'neutral', footer } = props;

  const toneClass =
    tone === 'up'
      ? 'border-l-[color:var(--club-success)]'
      : tone === 'down'
        ? 'border-l-[color:var(--club-danger)]'
        : 'border-l-[color:var(--club-border-soft)]';

  return (
    <Card
      className={[
        'h-full border border-[color:var(--club-border-soft)] bg-white p-4 shadow-sm',
        emphasized ? `border-l-4 ${toneClass}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[color:var(--club-text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className={['mt-2 font-semibold tabular-nums text-[color:var(--club-text-primary)]', emphasized ? 'text-4xl leading-none' : 'text-3xl leading-none'].join(' ')}>
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{helper}</div>
      {footer ? <div className="mt-3 text-xs">{footer}</div> : null}
    </Card>
  );
}

export function ClubMetricsPanel(props: ClubMetricsPanelProps) {
  const {
    activeVolumeText,
    returnPct,
    perfLoading,
    hasActivity,
    returnTone,
    membersCount,
    activePredictionsCount,
    totalPredictionsCount,
  } = props;

  const ReturnIcon =
    returnTone === 'up' ? TrendingUp : returnTone === 'down' ? TrendingDown : Activity;

  const returnFooterClass =
    returnTone === 'up'
      ? 'text-[color:var(--club-success)]'
      : returnTone === 'down'
        ? 'text-[color:var(--club-danger)]'
        : 'text-[color:var(--club-text-secondary)]';

  return (
    <section className="mb-8 rounded-2xl border border-[color:var(--club-border-soft)] bg-[#f8fafc] p-4 md:p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard
          label="USDC in active rounds"
          helper="Committed capital"
          value={<span>{activeVolumeText}</span>}
          icon={<Sigma className="h-4 w-4" />}
          emphasized
        />
        <MetricCard
          label="30d return"
          helper="Rolling performance"
          value={
            perfLoading ? (
              '—'
            ) : !hasActivity || returnPct == null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span>{returnPct.toFixed(1)}%</span>
            )
          }
          icon={<ReturnIcon className="h-4 w-4" />}
          emphasized
          tone={returnTone}
          footer={
            <span className={returnFooterClass}>
              {returnTone === 'up' ? 'Up 30d' : returnTone === 'down' ? 'Down 30d' : 'Flat (30d)'}
            </span>
          }
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Members"
          helper="Active participants"
          value={membersCount}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Active predictions"
          helper="Open rounds"
          value={activePredictionsCount}
          icon={<Layers className="h-4 w-4" />}
        />
        <MetricCard
          label="Total predictions"
          helper="All-time"
          value={totalPredictionsCount}
          icon={<Layers className="h-4 w-4" />}
        />
      </div>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@prediction-club/ui';
import { ChartExposure } from '@/components/chart-exposure';
import {
  buildExposureSeries,
  type ExposureWindow,
  type LedgerEntryLike,
} from '@/lib/exposure';

type ClubExposureRange = '7d' | '30d' | 'all';

const exposureWindowByRange: Record<ClubExposureRange, ExposureWindow> = {
  '7d': 7,
  '30d': 30,
  all: 'all',
};

export function ClubExposureChart(props: {
  history: LedgerEntryLike[];
  isLoading: boolean;
  createdAt?: string | null;
}) {
  const { history, isLoading, createdAt } = props;
  const [range, setRange] = useState<ClubExposureRange>('7d');

  const exposureSeries = useMemo(
    () => buildExposureSeries(history, exposureWindowByRange[range], createdAt),
    [createdAt, history, range]
  );

  if (isLoading) {
    return (
      <div className="py-8 text-sm text-[color:var(--club-text-secondary)]">Loading exposure...</div>
    );
  }

  if (exposureSeries.length === 0) {
    return (
      <div className="py-8 text-sm text-[color:var(--club-text-secondary)]">No activity yet to chart.</div>
    );
  }

  return (
    <ChartExposure
      data={exposureSeries}
      showHeader={false}
      showFooter={false}
      compact
      seamless
      windowControl={
        <Select value={range} onValueChange={(value) => setRange(value as ClubExposureRange)}>
          <SelectTrigger className="h-7 min-w-[104px] rounded-full border-slate-300/80 bg-white/70 px-2.5 text-xs font-medium text-slate-700 shadow-sm ring-0 supports-[backdrop-filter]:backdrop-blur-md">
            <SelectValue aria-label="Exposure range" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="all">All-time</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}

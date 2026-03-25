'use client';

import { useId, type ReactNode } from 'react';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  LineChart,
  Line,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@prediction-club/ui';
import { TrendingUp } from 'lucide-react';
import { formatUsdAmount } from '@prediction-club/shared';
import type { ExposurePoint } from '@/lib/exposure';

type Props = {
  data: ExposurePoint[];
  title?: string;
  description?: string;
  footerText?: string;
  footerSubtext?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  compact?: boolean;
  seamless?: boolean;
  windowBadgeLabel?: string;
  windowControl?: ReactNode;
  visualStyle?: 'price-history' | 'stacked-area';
};

function currency(value: number) {
  return `$${formatUsdAmount(Math.round(value * 1_000_000).toString(), 6, 2)}`;
}

function axisCurrency(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  }
  if (abs >= 100) {
    return `$${Math.round(value)}`;
  }
  if (abs >= 10) {
    return `$${value.toFixed(1)}`;
  }
  return currency(value);
}

const colors = {
  // Calmer, high-contrast pair
  market: '#2563eb', // blue-600
  wallet: '#22c55e', // green-500
};

export function ChartExposure({
  data,
  title = 'Fund Performance',
  description = 'Wallet vs In-Market stacked view',
  footerText = 'Stacked exposure over time',
  footerSubtext = 'Wallet + active market positions',
  showHeader = true,
  showFooter = true,
  compact = false,
  seamless = false,
  windowBadgeLabel,
  windowControl,
  visualStyle = 'stacked-area',
}: Props) {
  const chartId = useId();
  const isHero = compact && seamless && !showHeader && !showFooter;

  const rootClass = seamless
    ? 'border-0 bg-transparent shadow-none'
    : compact
      ? 'border-border/70 bg-white/90 shadow-sm'
      : undefined;

  const contentClass = seamless || compact ? 'p-0' : undefined;
  const renderPriceHistoryStyle = visualStyle === 'price-history';

  return (
    <Card className={rootClass}>
      {showHeader ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className={contentClass}>
        <div
          className={[
            seamless || compact ? 'mb-2' : 'mb-3',
            'flex flex-wrap items-center justify-between gap-2',
          ].join(' ')}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--club-text-secondary)]">
            <div className="inline-flex items-center gap-2">
              <span
                className="inline-block"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: colors.market,
                }}
              />
              <span>In markets</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span
                className="inline-block"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: colors.wallet,
                }}
              />
              <span>Wallet</span>
            </div>
          </div>
          {windowControl ? (
            <div>{windowControl}</div>
          ) : windowBadgeLabel ? (
            <div className="inline-flex items-center rounded-md border border-border/70 bg-background/90 px-2.5 py-1 text-xs text-[color:var(--club-text-secondary)]">
              {windowBadgeLabel}
            </div>
          ) : null}
        </div>
        <div
          className={[
            'relative',
            isHero ? 'h-44 md:h-48' : compact ? 'h-56 md:h-64' : 'h-72',
          ].join(' ')}
        >
          <ResponsiveContainer width="100%" height="100%">
            {renderPriceHistoryStyle ? (
              <LineChart
                data={data}
                margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={40}
                  tickCount={6}
                  tickFormatter={(value: number) => format(new Date(value), 'MMM d')}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={52}
                  domain={['auto', 'auto']}
                  tickFormatter={axisCurrency}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  labelFormatter={(label: number) => format(new Date(label), 'MMM d')}
                  formatter={(value: number, name: string) => [
                    currency(value),
                    name === 'wallet' ? 'Wallet' : 'In markets',
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 10,
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
                  }}
                />
                <Line
                  dataKey="market"
                  name="In markets"
                  type="monotone"
                  stroke={colors.market}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
                <Line
                  dataKey="wallet"
                  name="Wallet"
                  type="monotone"
                  stroke={colors.wallet}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            ) : (
              <AreaChart
                data={data}
                margin={isHero ? { left: 8, right: 8, top: 6, bottom: 4 } : { left: 8, right: 8, top: 10 }}
              >
                <defs>
                  <linearGradient id={`${chartId}-market`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.market} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={colors.market} stopOpacity={0.12} />
                  </linearGradient>
                  <linearGradient id={`${chartId}-wallet`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.wallet} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={colors.wallet} stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                {isHero ? null : (
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                )}
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={40}
                  tickCount={6}
                  tickFormatter={(value: number) => format(new Date(value), 'MMM d')}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={52}
                  domain={['auto', 'auto']}
                  tickFormatter={axisCurrency}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  labelFormatter={(label: number) => format(new Date(label), 'MMM d')}
                  formatter={(value: number, name: string) => [
                    currency(value),
                    name === 'wallet' ? 'Wallet' : 'In markets',
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 10,
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
                  }}
                />
                <Area
                  dataKey="market"
                  name="In markets"
                  type="monotone"
                  stroke={colors.market}
                  strokeOpacity={1}
                  fill={`url(#${chartId}-market)`}
                  fillOpacity={1}
                  stackId="a"
                  strokeWidth={3}
                  activeDot={{ r: 4 }}
                />
                <Area
                  dataKey="wallet"
                  name="Wallet"
                  type="monotone"
                  stroke={colors.wallet}
                  strokeOpacity={1}
                  fill={`url(#${chartId}-wallet)`}
                  fillOpacity={1}
                  stackId="a"
                  strokeWidth={3}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
      {showFooter ? (
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-1">
              <div className="flex items-center gap-2 font-medium leading-none">
                {footerText} <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 leading-none text-muted-foreground">
                {footerSubtext}
              </div>
            </div>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}

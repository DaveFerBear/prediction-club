'use client';

import { useId } from 'react';
import { format } from 'date-fns';
import {
  Legend,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
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
};

function currency(value: number) {
  return `$${formatUsdAmount(Math.round(value * 1_000_000).toString(), 6, 2)}`;
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
}: Props) {
  const chartId = useId();
  const isHero = compact && seamless && !showHeader && !showFooter;

  const rootClass = seamless
    ? 'border-0 bg-transparent shadow-none'
    : compact
      ? 'border-border/70 bg-white/90 shadow-sm'
      : undefined;

  const contentClass = seamless || compact ? 'p-0' : undefined;

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
            'relative',
            isHero ? 'h-44 md:h-48' : compact ? 'h-56 md:h-64' : 'h-72',
          ].join(' ')}
        >
          {isHero ? (
            <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/45 px-2 py-0.5 text-xs text-[color:var(--club-text-primary)] shadow-sm supports-[backdrop-filter]:backdrop-blur-md">
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
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/45 px-2 py-0.5 text-xs text-[color:var(--club-text-primary)] shadow-sm supports-[backdrop-filter]:backdrop-blur-md">
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
              {windowBadgeLabel ? (
                <div className="inline-flex items-center rounded-full border border-slate-300/80 bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm supports-[backdrop-filter]:backdrop-blur-md">
                  {windowBadgeLabel}
                </div>
              ) : null}
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height="100%">
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
                hide={isHero}
                tickLine={false}
                axisLine={false}
                tickMargin={isHero ? 10 : 6}
                minTickGap={28}
                tickCount={6}
                tickFormatter={(value: number) => format(new Date(value), 'MMM d')}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                cursor={isHero ? { stroke: 'rgba(71, 85, 105, 0.25)', strokeWidth: 1 } : { strokeDasharray: '3 3' }}
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
                strokeOpacity={isHero ? 0 : 1}
                fill={`url(#${chartId}-market)`}
                fillOpacity={1}
                stackId="a"
                strokeWidth={isHero ? 0 : 2}
                activeDot={isHero ? false : { r: 4 }}
              />
              <Area
                dataKey="wallet"
                name="Wallet"
                type="monotone"
                stroke={colors.wallet}
                strokeOpacity={isHero ? 0 : 1}
                fill={`url(#${chartId}-wallet)`}
                fillOpacity={1}
                stackId="a"
                strokeWidth={isHero ? 0 : 2}
                activeDot={isHero ? false : { r: 4 }}
              />
              {isHero ? null : (
                <Legend
                  iconType="square"
                  wrapperStyle={{
                    fontSize: 12,
                    lineHeight: '1.2',
                  }}
                  iconSize={14}
                  formatter={(value: string) =>
                    value === 'Wallet' ? 'Wallet' : 'In markets'
                  }
                  payload={undefined}
                  content={(props) => {
                    const { payload } = props;
                    if (!payload) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
                        {payload.map((entry) => {
                          const label = entry.dataKey === 'wallet' ? 'Wallet' : 'In markets';
                          const markerColor = entry.dataKey === 'wallet' ? colors.wallet : colors.market;
                          return (
                            <div
                              key={entry.dataKey as string}
                              className="inline-flex items-center gap-2 rounded-full bg-white/60 px-2.5 py-1 text-[13px] text-[color:var(--club-text-primary)]"
                            >
                              <span
                                className="inline-block"
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  backgroundColor: markerColor,
                                }}
                              />
                              <span>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              )}
            </AreaChart>
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

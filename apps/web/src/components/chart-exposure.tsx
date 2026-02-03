'use client';

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

type ExposurePoint = {
  label: string;
  wallet: number;
  market: number;
};

type Props = {
  data: ExposurePoint[];
  title?: string;
  description?: string;
  footerText?: string;
  footerSubtext?: string;
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
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 8, right: 8, top: 10 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number, name: string) => [
                  currency(value),
                  name === 'wallet' ? 'Wallet' : 'In markets',
                ]}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                dataKey="market"
                name="In markets"
                type="monotone"
                stroke={colors.market}
                fill={colors.market}
                fillOpacity={0.35}
                stackId="a"
                strokeWidth={2}
                activeDot={{ r: 4 }}
              />
              <Area
                dataKey="wallet"
                name="Wallet"
                type="monotone"
                stroke={colors.wallet}
                fill={colors.wallet}
                fillOpacity={0.35}
                stackId="a"
                strokeWidth={2}
                activeDot={{ r: 4 }}
              />
              <Legend
                iconType="square"
                wrapperStyle={{
                  fontSize: 12,
                  lineHeight: '1.2',
                }}
                iconSize={14}
                formatter={(value: string) =>
                  value === 'wallet' ? 'Wallet' : 'In markets'
                }
                payload={undefined}
                content={(props) => {
                  const { payload } = props;
                  if (!payload) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {payload.map((entry) => {
                        const label = entry.value === 'wallet' ? 'Wallet' : 'In markets';
                        return (
                          <div key={entry.dataKey as string} className="flex items-center gap-2">
                            <span
                              className="inline-block"
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                backgroundColor: entry.color || colors.wallet,
                              }}
                            />
                            <span style={{ transform: 'translateY(1px)' }}>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
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
    </Card>
  );
}

'use client';

import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Skeleton } from '@prediction-club/ui';
import { usePolymarketPriceHistory } from '@/hooks';

type Props = {
  tokenId: string;
  orderPrice: number | null;
};

type ChartPoint = { t: number; p: number };

function formatCents(value: number): string {
  return `${Math.round(value * 100)}c`;
}

export function PredictionPriceChart({ tokenId, orderPrice }: Props) {
  const { data, error, isLoading } = usePolymarketPriceHistory(tokenId);

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (error || !data?.history?.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
        {error ? 'Failed to load price history' : 'No price history available'}
      </div>
    );
  }

  const points: ChartPoint[] = data.history;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={40}
            tickCount={5}
            tickFormatter={(value: number) => format(new Date(value * 1000), 'MMM d')}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={36}
            domain={['auto', 'auto']}
            tickFormatter={formatCents}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            labelFormatter={(label: number) => format(new Date(label * 1000), 'MMM d, h:mm a')}
            formatter={(value: number) => [formatCents(value), 'Price']}
            contentStyle={{
              fontSize: 12,
              borderRadius: 10,
              border: '1px solid rgba(203, 213, 225, 0.8)',
              boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
            }}
          />
          <Line
            dataKey="p"
            type="monotone"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          {orderPrice != null ? (
            <ReferenceLine
              y={orderPrice}
              stroke="#d97706"
              strokeDasharray="6 3"
              label={{
                value: `Entry ${formatCents(orderPrice)}`,
                position: 'insideTopRight',
                fill: '#d97706',
                fontSize: 11,
              }}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

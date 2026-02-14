'use client';

import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';
import { cn } from '@prediction-club/ui';
import type { MarketItem } from '@/hooks/use-market-search';
import {
  formatCompactNumber,
  formatMarketUrl,
  formatOutcomePrice,
  getMarketDescription,
  getMarketImage,
  getMarketOutcomes,
  getMarketStatus,
  getMarketTitle,
  getMarketUrl,
} from './market-utils';

type MarketCardProps = {
  market: MarketItem;
  selected?: boolean;
  onSelect?: (market: MarketItem) => void;
  actionLabel?: string;
  onAction?: (market: MarketItem) => void;
  actionHref?: string;
  className?: string;
};

export function MarketCard({
  market,
  selected = false,
  onSelect,
  actionLabel,
  onAction,
  actionHref,
  className,
}: MarketCardProps) {
  const status = getMarketStatus(market);
  const image = getMarketImage(market);
  const title = getMarketTitle(market);
  const description = getMarketDescription(market);
  const outcomes = getMarketOutcomes(market).slice(0, 3);
  const marketUrl = getMarketUrl(market);
  const isInteractive = Boolean(onSelect);

  const handleSelect = () => {
    if (!onSelect) return;
    onSelect(market);
  };

  return (
    <Card
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleSelect : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSelect();
              }
            }
          : undefined
      }
      className={cn(
        'border-border/70 transition',
        isInteractive ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : '',
        selected ? 'border-primary shadow-md shadow-primary/10' : '',
        className
      )}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {image ? (
              <img src={image} alt="" className="h-10 w-10 rounded-md border object-cover" />
            ) : null}
            <div className="min-w-0">
              <CardTitle className="line-clamp-2 text-base leading-tight">{title}</CardTitle>
              {description ? (
                <CardDescription className="mt-1 line-clamp-2 text-xs">{description}</CardDescription>
              ) : null}
            </div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="rounded-md border bg-muted/20 px-2 py-1.5">
            <div className="uppercase tracking-wide">Volume</div>
            <div className="font-medium text-foreground">{formatCompactNumber(market.volume)}</div>
          </div>
          <div className="rounded-md border bg-muted/20 px-2 py-1.5">
            <div className="uppercase tracking-wide">Liquidity</div>
            <div className="font-medium text-foreground">{formatCompactNumber(market.liquidity)}</div>
          </div>
        </div>

        {outcomes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {outcomes.map((item) => (
              <Badge key={item.outcome} variant="outline" className="font-normal">
                {item.outcome}: {formatOutcomePrice(item.price)}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {actionLabel && onAction ? (
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(market);
              }}
            >
              {actionLabel}
            </Button>
          ) : null}
          {actionLabel && actionHref ? (
            <Button asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
          {marketUrl ? (
            <a
              href={marketUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="text-xs text-muted-foreground underline decoration-transparent hover:decoration-current"
            >
              {formatMarketUrl(marketUrl)}
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

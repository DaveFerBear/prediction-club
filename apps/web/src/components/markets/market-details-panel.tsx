import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';
import type { MarketItem } from '@/hooks/use-market-search';
import {
  formatCompactNumber,
  formatMarketUrl,
  formatOutcomePrice,
  getMarketDescription,
  getMarketOutcomes,
  getMarketStatus,
  getMarketTitle,
  getMarketUrl,
} from './market-utils';

export function MarketDetailsPanel({
  market,
  emptyLabel = 'Select a market to see details',
}: {
  market: MarketItem | null;
  emptyLabel?: string;
}) {
  if (!market) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</CardContent>
      </Card>
    );
  }

  const status = getMarketStatus(market);
  const title = getMarketTitle(market);
  const description = getMarketDescription(market);
  const outcomes = getMarketOutcomes(market);
  const marketUrl = getMarketUrl(market);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">Market details</Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <CardTitle className="text-xl leading-tight">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-xs uppercase text-muted-foreground">Volume</div>
            <div className="font-semibold">{formatCompactNumber(market.volume)}</div>
          </div>
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-xs uppercase text-muted-foreground">Liquidity</div>
            <div className="font-semibold">{formatCompactNumber(market.liquidity)}</div>
          </div>
        </div>

        {outcomes.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Outcomes</div>
            <div className="grid gap-2">
              {outcomes.map((item) => (
                <div
                  key={item.outcome}
                  className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <span className="font-medium">{item.outcome}</span>
                  <span className="text-muted-foreground">{formatOutcomePrice(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {marketUrl ? (
          <a
            href={marketUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-muted-foreground underline decoration-transparent hover:decoration-current"
          >
            {formatMarketUrl(marketUrl)}
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

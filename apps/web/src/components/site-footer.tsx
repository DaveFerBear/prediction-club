export function SiteFooter() {
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v0.1.0';

  return (
    <footer className="border-t py-4">
      <div className="container flex flex-col items-center gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-[13px] font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
            online
          </span>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1 text-[13px] font-medium text-muted-foreground">
            {appVersion}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <span className="text-center sm:text-right">
            Built on{' '}
            <a
              href="https://polygon.technology/"
              target="_blank"
              rel="noreferrer"
              className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
            >
              Polygon
            </a>
            . Powered by{' '}
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noreferrer"
              className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
            >
              Polymarket
            </a>{' '}
            .
          </span>
          <a
            href="https://x.com/prediction_club"
            target="_blank"
            rel="noreferrer"
            aria-label="Prediction Club on X"
            className="inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-base text-muted-foreground hover:border-border hover:text-foreground"
          >
            𝕏
          </a>
        </div>
      </div>
    </footer>
  );
}

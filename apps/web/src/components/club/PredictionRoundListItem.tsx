import type { ReactNode } from 'react';
import { formatUsdAmount } from '@prediction-club/shared';
import { Badge, Card, CardContent } from '@prediction-club/ui';
import type { PredictionRound } from '@/hooks';

type PredictionRoundListItemProps = {
  round: PredictionRound;
};

function normalizeOutcome(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function getStatusBadge(round: PredictionRound) {
  const isSettled = round.status === 'SETTLED';
  if (!isSettled) {
    const open = round.status === 'COMMITTED' || round.status === 'PENDING';
    return <Badge variant={open ? 'default' : 'secondary'}>{round.status}</Badge>;
  }

  const normalizedOutcome = normalizeOutcome(round.outcome);
  const normalizedTarget = normalizeOutcome(round.targetOutcome);

  if (!normalizedOutcome || !normalizedTarget) {
    return <Badge variant="secondary">SETTLED</Badge>;
  }

  const hitTarget = normalizedOutcome === normalizedTarget;
  return <Badge variant={hitTarget ? 'success' : 'destructive'}>{`SETTLED · ${hitTarget ? 'HIT' : 'MISS'}`}</Badge>;
}

function renderCommentary(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    if (text.length > 0) {
      nodes.push(
        <p key={`p-${nodes.length}`} className="mb-1 break-words last:mb-0">
          {text}
        </p>
      );
    }
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="mb-1 list-disc space-y-0.5 pl-5 last:mb-0">
        {listItems.map((item, idx) => (
          <li key={`li-${idx}`} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      nodes.push(
        <h4
          key={`h-${nodes.length}`}
          className="mb-1 text-sm font-semibold text-[color:var(--club-text-primary)]"
        >
          {line.slice(4)}
        </h4>
      );
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return nodes;
}

export function PredictionRoundListItem(props: PredictionRoundListItemProps) {
  const { round } = props;

  return (
    <Card className="overflow-hidden border-[color:var(--club-border-soft)] bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold text-[color:var(--club-text-primary)] md:text-lg">
              {round.marketTitle || 'Untitled Market'}
            </h3>
            <div className="mt-1 text-xs text-muted-foreground">
              Created {new Date(round.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {getStatusBadge(round)}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded-lg border border-[color:var(--club-border-soft)] px-3 py-2">
            <div className="text-xs text-muted-foreground">Total stake</div>
            <div className="break-words font-medium">${formatUsdAmount(round.stakeTotal)} USDC</div>
          </div>
          <div className="rounded-lg border border-[color:var(--club-border-soft)] px-3 py-2">
            <div className="text-xs text-muted-foreground">Participants</div>
            <div className="break-words font-medium">{round._count.members}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--club-border-soft)] px-3 py-2">
            <div className="text-xs text-muted-foreground">Target outcome</div>
            <div className="break-words font-medium">{round.targetOutcome}</div>
          </div>
        </div>
        {round.commentary ? (
          <div className="mt-3 rounded-lg border border-[color:var(--club-border-soft)] bg-muted/20 px-3 py-2 text-sm text-[color:var(--club-text-secondary)]">
            {renderCommentary(round.commentary)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatUsdAmount } from '@prediction-club/shared';
import { Badge, Button, Card, CardContent } from '@prediction-club/ui';
import type { PredictionRound } from '@/hooks';

type PredictionRoundListItemProps = {
  round: PredictionRound;
  clubSlug: string;
  isAdmin: boolean;
};

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
  const { round, clubSlug, isAdmin } = props;
  const open = round.status === 'COMMITTED' || round.status === 'PENDING';

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
            <Badge variant={open ? 'default' : 'secondary'}>{round.status}</Badge>
            {isAdmin ? (
              <Link href={`/clubs/${clubSlug}/predict`}>
                <Button size="sm" variant="outline" className="whitespace-nowrap">
                  Manage
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="ghost" disabled title="Round detail page coming soon">
                View
              </Button>
            )}
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

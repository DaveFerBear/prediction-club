'use client';

import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { Badge, Button, Card, CardContent } from '@prediction-club/ui';
import type { PredictionRound } from '@/hooks';

type PredictionRoundListItemProps = {
  round: PredictionRound;
  clubSlug: string;
  isAdmin: boolean;
};

export function PredictionRoundListItem(props: PredictionRoundListItemProps) {
  const { round, clubSlug, isAdmin } = props;
  const open = round.status === 'COMMITTED' || round.status === 'PENDING';

  return (
    <Card className="border-[color:var(--club-border-soft)] bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[color:var(--club-text-primary)] md:text-lg">
              {round.marketTitle || 'Untitled Market'}
            </h3>
            <div className="mt-1 text-xs text-muted-foreground">
              Created {new Date(round.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={open ? 'default' : 'secondary'}>{round.status}</Badge>
            {isAdmin ? (
              <Link href={`/clubs/${clubSlug}/predict`}>
                <Button size="sm" variant="outline">
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
            <div className="font-medium">${formatUsdAmount(round.stakeTotal)} USDC</div>
          </div>
          <div className="rounded-lg border border-[color:var(--club-border-soft)] px-3 py-2">
            <div className="text-xs text-muted-foreground">Participants</div>
            <div className="font-medium">{round._count.members}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--club-border-soft)] px-3 py-2">
            <div className="text-xs text-muted-foreground">Target outcome</div>
            <div className="font-medium truncate">{round.targetOutcome}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

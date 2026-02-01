import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';
import type { ClubListItem } from '@/hooks';

type ClubCardProps = {
  club: ClubListItem;
  statsLabel: 'members' | 'predictions';
};

export function ClubCard({ club, statsLabel }: ClubCardProps) {
  const statsValue =
    statsLabel === 'members' ? club._count.members : club._count.predictionRounds;
  const badgeLabel = statsLabel === 'members' ? `${statsValue} members` : `${statsValue} predictions`;

  return (
    <Link href={`/clubs/${club.slug}`} className="group">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{club.name}</CardTitle>
            <Badge variant="secondary">{badgeLabel}</Badge>
          </div>
          <CardDescription>/{club.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          {club.description && (
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{club.description}</p>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active volume</span>
            <span>${formatUsdAmount(club.activeCommittedVolume)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

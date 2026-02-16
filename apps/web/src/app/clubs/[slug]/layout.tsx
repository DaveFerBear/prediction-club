import type { Metadata } from 'next';
import { prisma } from '@prediction-club/db';

function buildClubMetaDescription(input: { clubName: string; description: string | null }) {
  const description = input.description?.trim();
  if (description && description.length > 0) {
    return description;
  }
  return `Join ${input.clubName} on Prediction Club and trade predictions together on Polymarket.`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const club = await prisma.club.findUnique({
      where: { slug: params.slug },
      select: {
        name: true,
        description: true,
      },
    });

    if (!club) {
      return {
        title: 'Club | Prediction Club',
        description: 'Trade predictions together on Polymarket.',
      };
    }

    const title = `${club.name} | Prediction Club`;
    const description = buildClubMetaDescription({
      clubName: club.name,
      description: club.description,
    });

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'Club | Prediction Club',
      description: 'Trade predictions together on Polymarket.',
    };
  }
}

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}

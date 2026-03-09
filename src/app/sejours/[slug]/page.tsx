import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStays } from '@/lib/stays';
import { StayDetailView } from '@/components/sejours/StayDetailView';

interface StayDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: StayDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const stays = await getStays();
  const stay = stays.find((item) => item.slug === slug);

  if (!stay) {
    return { title: 'Séjour introuvable | Resacolo' };
  }

  return {
    title: `${stay.title} | Resacolo`,
    description: stay.summary
  };
}

export async function generateStaticParams() {
  try {
    const stays = await getStays();
    return stays.map((stay) => ({ slug: stay.slug }));
  } catch {
    return [];
  }
}

export default async function StayDetailPage({ params }: StayDetailPageProps) {
  const { slug } = await params;
  const stays = await getStays();
  const stay = stays.find((item) => item.slug === slug);

  if (!stay) {
    notFound();
  }

  return <StayDetailView stay={stay} />;
}

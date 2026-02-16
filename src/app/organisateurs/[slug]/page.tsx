import { redirect } from 'next/navigation';
import { getOrganizerBySlug } from '@/lib/mockOrganizers';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganisateurSlugRedirect({ params }: PageProps) {
  const { slug } = await params;
  const organizer = getOrganizerBySlug(slug);
  if (!organizer) redirect('/organisateurs');
  redirect(`/organisateurs?organisateur=${encodeURIComponent(slug)}`);
}

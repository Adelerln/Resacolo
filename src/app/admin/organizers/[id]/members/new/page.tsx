import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizerMemberNewPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  await requireRole('ADMIN');
  redirect(`/admin/organizers/${params.id}?openMemberModal=add`);
}

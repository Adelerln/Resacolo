import { requireRole } from '@/lib/auth/require';
import AdminOrganizerCreateForm from '@/components/admin/AdminOrganizerCreateForm';

type PageProps = { searchParams?: Promise<{ error?: string }> };

export default async function AdminOrganizerNewPage({ searchParams }: PageProps) {
  await requireRole('ADMIN');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Créer un organisateur</h1>
        <p className="admin-page-subtitle mt-1">Créer un organisme et son compte principal.</p>
      </div>

      <AdminOrganizerCreateForm initialError={resolvedSearchParams?.error} />
    </div>
  );
}

import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { AdminOrganizersTable } from '@/components/admin/AdminOrganizersTable';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OverviewRow = Database['public']['Views']['organizer_admin_overview']['Row'];

export default async function AdminOrganizersPage() {
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('organizer_admin_overview')
    .select('*')
    .order('name', { ascending: true });

  const rows = (data ?? []) as OverviewRow[];
  const loadError = error?.message ?? null;

  return (
    <div className="space-y-6">
      {!hasServiceRole && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          SUPABASE_SERVICE_ROLE_KEY manquante côté serveur. La liste peut être vide à cause des
          droits d’accès.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="admin-page-title">Organismes</h1>
          <p className="admin-page-subtitle mt-1">Suivi des paramètres business et facturation.</p>
        </div>
        <Link
          href="/admin/organizers/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Créer un organisme
        </Link>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Erreur vue organizer_admin_overview : {loadError}
        </div>
      )}
      {!loadError && <AdminOrganizersTable rows={rows} />}
    </div>
  );
}

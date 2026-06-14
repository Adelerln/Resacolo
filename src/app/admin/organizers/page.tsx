import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { AdminOrganizersTable } from '@/components/admin/AdminOrganizersTable';
import {
  readResacoloBillingSettings,
  resolveOrganizerCommissionPercent
} from '@/lib/resacolo-billing-settings.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OverviewRow = Database['public']['Views']['organizer_admin_overview']['Row'];
type PageProps = {
  searchParams?: Promise<{
    settingsSaved?: string;
    settingsError?: string;
  }>;
};

function percentValue(value: number) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function eurosValue(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AdminOrganizersPage({ searchParams }: PageProps) {
  await requireRole('ADMIN');
  const sp = searchParams ? await searchParams : undefined;
  const supabase = getServerSupabaseClient();
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data, error }, settings] = await Promise.all([
    supabase.from('organizer_admin_overview').select('*').order('name', { ascending: true }),
    readResacoloBillingSettings(supabase)
  ]);

  const rows = ((data ?? []) as OverviewRow[]).map((row) => ({
    ...row,
    commission_percent: resolveOrganizerCommissionPercent(row, settings)
  }));
  const loadError = error?.message ?? null;
  const settingsSaved = sp?.settingsSaved === '1';
  const settingsError = sp?.settingsError;

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
          <p className="admin-page-subtitle mt-1">Pilotage des statuts et des commissions organisateur.</p>
        </div>
        <Link
          href="/admin/organizers/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Créer un organisme
        </Link>
      </div>

      {settingsSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Paramètres globaux enregistrés et réappliqués à tous les organismes.
        </div>
      )}
      {settingsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {settingsError}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Erreur vue organizer_admin_overview : {loadError}
        </div>
      )}

      <form
        action="/api/admin/billing-settings"
        method="post"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:p-6"
      >
        <div>
          <h2 className="admin-section-title">Paramètres business globaux</h2>
          <p className="admin-page-subtitle mt-1 text-xs">
            Les taux sont saisis une seule fois par le comité de direction puis appliqués automatiquement selon le
            statut de chaque organisme. Le statut lui-même reste modifiable uniquement dans l’admin.
            Les changements valent pour les commissions futures uniquement : les commissions déjà constatées restent
            figées dans le journal.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Commission fondateur (%)
            <input
              name="founding_member_commission_percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={percentValue(settings.founding_member_commission_percent)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Commission membre ResaColo (%)
            <input
              name="resacolo_member_commission_percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={percentValue(settings.resacolo_member_commission_percent)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Commission externe (%)
            <input
              name="external_commission_percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={percentValue(settings.external_commission_percent)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="publication_fee_enabled"
              defaultChecked={settings.publication_fee_enabled}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Réactiver les frais de publication globaux
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Désactivé par défaut. Quand la case reste décochée, aucune facturation de publication n’est affichée
                ni générée.
              </span>
            </span>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Montant publication (€ TTC)
            <input
              name="publication_fee_euros"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={eurosValue(settings.publication_fee_cents)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer et appliquer
          </button>
        </div>
      </form>

      {!loadError && <AdminOrganizersTable rows={rows} />}
    </div>
  );
}

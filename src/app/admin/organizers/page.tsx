import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OverviewRow = Database['public']['Views']['organizer_admin_overview']['Row'];

function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolOuiNon(value: boolean | null | undefined) {
  return value ? 'Oui' : 'Non';
}

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
          <h1 className="text-2xl font-semibold text-slate-900">Organismes</h1>
        </div>
        <Link
          href="/admin/organizers/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Créer un organisme
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Organisme</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Fondateur</th>
                <th className="px-3 py-3">Membre</th>
                <th className="px-3 py-3">Complétude</th>
                <th className="px-3 py-3">Séjours</th>
                <th className="px-3 py-3">Publiés</th>
                <th className="px-3 py-3">Ventes</th>
                <th className="px-3 py-3">Commission</th>
                <th className="px-3 py-3">Forfait pub.</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hrefId = row.slug ?? row.id;
                const feeCents = num(row.publication_fee_cents);
                const feeEuros = (feeCents / 100).toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR'
                });
                const commission = num(row.commission_percent);
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="max-w-[10rem] truncate px-3 py-3 text-slate-600">
                      {row.contact_email ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{boolOuiNon(row.is_founding_member)}</td>
                    <td className="px-3 py-3 text-slate-600">{boolOuiNon(row.is_resacolo_member)}</td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">
                      {num(row.profile_completeness_percent).toFixed(0)} %
                    </td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">{num(row.stays_count)}</td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">
                      {num(row.published_stays_count)}
                    </td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">{num(row.sales_count)}</td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">
                      {commission.toLocaleString('fr-FR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2
                      })}
                      %
                    </td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums">{feeEuros}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/organizers/${hrefId}`}
                        className="inline-flex items-center gap-2 font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={11}>
                    {loadError
                      ? `Erreur vue organizer_admin_overview : ${loadError}`
                      : 'Aucun organisme.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

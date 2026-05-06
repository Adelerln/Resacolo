import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { normalizePartnerOffer, PARTNER_OFFER_LABELS } from '@/lib/partner-offers';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CollectivityRow = Database['public']['Tables']['collectivities']['Row'];

export default async function AdminPartnersPage() {
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  const { data, error } = await supabase
    .from('collectivities')
    .select('id,name,code,offer_mode,contact_email,created_at')
    .order('name', { ascending: true });

  const partners = (data ?? []) as Pick<
    CollectivityRow,
    'id' | 'name' | 'code' | 'offer_mode' | 'contact_email' | 'created_at'
  >[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="admin-page-title">Partenaires</h1>
          <p className="admin-page-subtitle mt-1">Créez et suivez les collectivités partenaires.</p>
        </div>
        <Link
          href="/admin/partenaires/nouveau"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Créer un partenaire
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible de charger les partenaires : {error.message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Offre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{partner.name}</td>
                  <td className="px-4 py-3 text-slate-600">{partner.code}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {PARTNER_OFFER_LABELS[normalizePartnerOffer(partner.offer_mode)]}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{partner.contact_email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(partner.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-500">
                    Aucun partenaire enregistré.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

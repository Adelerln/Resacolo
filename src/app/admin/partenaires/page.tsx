import Link from 'next/link';
import { requireAdminSection } from '@/lib/auth/require';
import { canMutateAdminSection, isAdminWorkspaceRole } from '@/lib/admin-access';
import { normalizePartnerOffer, PARTNER_OFFER_LABELS } from '@/lib/partner-offers';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type CollectivityRow = Database['public']['Tables']['collectivities']['Row'];
type CollectivityMemberRow = Database['public']['Tables']['collectivity_members']['Row'];
type SortKey =
  | 'name'
  | 'code'
  | 'offer_mode'
  | 'contact_email'
  | 'created_at'
  | 'user_count'
  | 'last_connection';
type SortDirection = 'asc' | 'desc';
type SearchParamsValue = string | string[] | undefined;
type AdminPartnersPageProps = {
  searchParams?: Promise<Record<string, SearchParamsValue>> | Record<string, SearchParamsValue>;
};
type PartnerRow = Pick<
  CollectivityRow,
  'id' | 'name' | 'code' | 'offer_mode' | 'contact_email' | 'created_at'
> & {
  lastConnectionAt: string | null;
  userCount: number;
};

const SORT_KEYS: SortKey[] = [
  'name',
  'code',
  'offer_mode',
  'contact_email',
  'created_at',
  'user_count',
  'last_connection'
];

function isSortKey(value: string | null): value is SortKey {
  return Boolean(value && SORT_KEYS.includes(value as SortKey));
}

function isSortDirection(value: string | null): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

function getSingleSearchParam(value: SearchParamsValue): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

function normalizeNullableString(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('fr-FR');
}

function compareNullableStrings(left: string | null | undefined, right: string | null | undefined) {
  return normalizeNullableString(left).localeCompare(normalizeNullableString(right), 'fr', { sensitivity: 'base' });
}

function compareNullableDates(left: string | null | undefined, right: string | null | undefined) {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return leftValue - rightValue;
}

function compareNumbers(left: number, right: number) {
  return left - right;
}

function getNextSortDirection(
  activeSort: SortKey | null,
  activeDirection: SortDirection | null,
  column: SortKey
): SortDirection | null {
  if (activeSort !== column) return 'asc';
  if (activeDirection === 'asc') return 'desc';
  return null;
}

function getSortIndicator(
  activeSort: SortKey | null,
  activeDirection: SortDirection | null,
  column: SortKey
) {
  if (activeSort !== column) return '↕';
  return activeDirection === 'asc' ? '↑' : '↓';
}

function formatLastConnection(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function getOfferBadgeClass(offerMode: string | null | undefined) {
  return normalizePartnerOffer(offerMode) === 'IDENTITE'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-sky-100 text-sky-800 border-sky-200';
}

export default async function AdminPartnersPage({ searchParams }: AdminPartnersPageProps) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const session = await requireAdminSection('partners');
  const canEditPartners = isAdminWorkspaceRole(session.role) && canMutateAdminSection(session.role, 'partners');
  const supabase = getServerSupabaseClient();
  const requestedSort = getSingleSearchParam(resolvedSearchParams?.sort);
  const requestedDirection = getSingleSearchParam(resolvedSearchParams?.dir);
  const activeSort = isSortKey(requestedSort) ? requestedSort : null;
  const activeDirection =
    activeSort && isSortDirection(requestedDirection) ? requestedDirection : null;

  const { data, error } = await supabase
    .from('collectivities')
    .select('id,name,code,offer_mode,contact_email,created_at');

  const partnersRaw = (data ?? []) as Pick<
    CollectivityRow,
    'id' | 'name' | 'code' | 'offer_mode' | 'contact_email' | 'created_at'
  >[];
  const partnerIds = partnersRaw.map((partner) => partner.id);
  const { data: membersRaw } =
    partnerIds.length > 0
      ? await supabase
          .from('collectivity_members')
          .select('collectivity_id,user_id')
          .in('collectivity_id', partnerIds)
      : { data: [] as Pick<CollectivityMemberRow, 'collectivity_id' | 'user_id'>[] };
  const uniqueUserIds = Array.from(new Set((membersRaw ?? []).map((member) => member.user_id).filter(Boolean)));
  const userLastConnectionEntries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      return [userId, userData?.user?.last_sign_in_at ?? null] as const;
    })
  );
  const userLastConnectionById = new Map(userLastConnectionEntries);
  const lastConnectionByCollectivityId = new Map<string, string | null>();
  const userCountByCollectivityId = new Map<string, number>();

  for (const member of membersRaw ?? []) {
    userCountByCollectivityId.set(
      member.collectivity_id,
      (userCountByCollectivityId.get(member.collectivity_id) ?? 0) + 1
    );
    const candidate = userLastConnectionById.get(member.user_id) ?? null;
    const current = lastConnectionByCollectivityId.get(member.collectivity_id) ?? null;
    if (!candidate) continue;
    if (!current || new Date(candidate).getTime() > new Date(current).getTime()) {
      lastConnectionByCollectivityId.set(member.collectivity_id, candidate);
    }
  }

  const partners: PartnerRow[] = partnersRaw.map((partner) => ({
    ...partner,
    lastConnectionAt: lastConnectionByCollectivityId.get(partner.id) ?? null,
    userCount: userCountByCollectivityId.get(partner.id) ?? 0
  }));

  const sortedPartners =
    activeSort && activeDirection
      ? [...partners].sort((left, right) => {
          let comparison = 0;

          switch (activeSort) {
            case 'name':
              comparison = compareNullableStrings(left.name, right.name);
              break;
            case 'code':
              comparison = compareNullableStrings(left.code, right.code);
              break;
            case 'offer_mode':
              comparison = compareNullableStrings(
                PARTNER_OFFER_LABELS[normalizePartnerOffer(left.offer_mode)],
                PARTNER_OFFER_LABELS[normalizePartnerOffer(right.offer_mode)]
              );
              break;
            case 'contact_email':
              comparison = compareNullableStrings(left.contact_email, right.contact_email);
              break;
            case 'created_at':
              comparison = compareNullableDates(left.created_at, right.created_at);
              break;
            case 'user_count':
              comparison = compareNumbers(left.userCount, right.userCount);
              break;
            case 'last_connection':
              comparison = compareNullableDates(left.lastConnectionAt, right.lastConnectionAt);
              break;
          }

          return activeDirection === 'asc' ? comparison : -comparison;
        })
      : partners;

  function buildSortHref(column: SortKey) {
    const nextDirection = getNextSortDirection(activeSort, activeDirection, column);
    const params = new URLSearchParams();
    if (nextDirection) {
      params.set('sort', column);
      params.set('dir', nextDirection);
    }
    const queryString = params.toString();
    return queryString ? `/admin/partenaires?${queryString}` : '/admin/partenaires';
  }

  function renderSortableHeader(label: string, column: SortKey) {
    const indicator = getSortIndicator(activeSort, activeDirection, column);

    return (
      <Link
        href={buildSortHref(column)}
        className="inline-flex items-center gap-2 font-semibold text-slate-600 transition hover:text-slate-900"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-[11px] text-slate-400">
          {indicator}
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="admin-page-title">Partenaires</h1>
        </div>
        {canEditPartners ? (
          <Link
            href="/admin/partenaires/nouveau"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Créer un partenaire
          </Link>
        ) : null}
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
                <th className="px-4 py-3">{renderSortableHeader('Nom', 'name')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Code', 'code')}</th>
                <th className="px-4 py-3">{renderSortableHeader("Type d'abonnement", 'offer_mode')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Email', 'contact_email')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Créé le', 'created_at')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Utilisateurs', 'user_count')}</th>
                <th className="px-4 py-3">{renderSortableHeader('Dernière connexion', 'last_connection')}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPartners.map((partner) => (
                <tr key={partner.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{partner.name}</td>
                  <td className="px-4 py-3 text-slate-600">{partner.code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOfferBadgeClass(
                        partner.offer_mode
                      )}`}
                    >
                      {PARTNER_OFFER_LABELS[normalizePartnerOffer(partner.offer_mode)]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{partner.contact_email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(partner.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{partner.userCount}</td>
                  <td className="px-4 py-3 text-slate-600">{formatLastConnection(partner.lastConnectionAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/partenaires/${partner.id}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                    >
                      {canEditPartners ? 'Gérer' : 'Voir'}
                    </Link>
                  </td>
                </tr>
              ))}
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-slate-500">
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

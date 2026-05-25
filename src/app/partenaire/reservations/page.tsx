import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  clampPartnerFinanceCents,
  computePartnerFinanceSplit,
  normalizePartnerFinanceMode,
  PARTNER_FINANCE_MODE_LABELS
} from '@/lib/partner-offers';
import {
  listPartnerBeneficiaryUserIds,
  listPartnerReservations,
  readPartnerCollectivity
} from '@/lib/partner.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

function orderStatusBadgeClassName(status: Database['public']['Enums']['order_status'] | string) {
  switch (status) {
    case 'REQUESTED':
      return 'bg-amber-100 text-amber-900';
    case 'VALIDATED':
      return 'bg-sky-100 text-sky-900';
    case 'BOOKED':
      return 'bg-indigo-100 text-indigo-900';
    case 'PAID':
      return 'bg-emerald-100 text-emerald-900';
    case 'CONFIRMED':
      return 'bg-emerald-200 text-emerald-950';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-900';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function parseEurosToCents(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function distributeCentsAcrossItems(totalTargetCents: number, itemTotals: Array<{ id: string; totalCents: number }>) {
  if (itemTotals.length === 0) return [] as Array<{ id: string; cents: number }>;
  const sanitizedTarget = Math.max(0, Math.round(totalTargetCents));
  const positiveTotal = itemTotals.reduce((sum, item) => sum + Math.max(item.totalCents, 0), 0);

  if (positiveTotal <= 0) {
    return itemTotals.map((item, index) => ({
      id: item.id,
      cents: index === itemTotals.length - 1 ? sanitizedTarget : 0
    }));
  }

  let allocated = 0;
  return itemTotals.map((item, index) => {
    if (index === itemTotals.length - 1) {
      return { id: item.id, cents: sanitizedTarget - allocated };
    }
    const cents = Math.floor((sanitizedTarget * Math.max(item.totalCents, 0)) / positiveTotal);
    allocated += cents;
    return { id: item.id, cents };
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PartnerReservationsPage() {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);

  if (!canAccessPartnerSection(accessRole, 'reservations')) {
    redirect('/partenaire');
  }

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Réservations</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  async function saveManualContribution(formData: FormData) {
    'use server';

    const session = await requirePartner();
    const collectivityId = session.tenantId;
    const accessRole = getPartnerAccessRoleFromSession(session);
    if (!collectivityId) {
      redirect('/partenaire/reservations');
    }
    if (!canAccessPartnerSection(accessRole, 'reservations')) {
      redirect('/partenaire');
    }

    const collectivity = await readPartnerCollectivity(collectivityId);
    if (normalizePartnerFinanceMode(collectivity.finance_mode) !== 'MANUAL') {
      redirect('/partenaire/reservations');
    }

    const orderId = String(formData.get('order_id') ?? '').trim();
    if (!orderId) {
      redirect('/partenaire/reservations');
    }

    const supabase = getServerSupabaseClient();
    const allowedUserIds = await listPartnerBeneficiaryUserIds(collectivityId, session.userId);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,client_user_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order || !allowedUserIds.includes(order.client_user_id)) {
      redirect('/partenaire/reservations');
    }

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('id,total_price_cents')
      .eq('order_id', orderId);

    if (orderItemsError || !orderItems || orderItems.length === 0) {
      redirect('/partenaire/reservations');
    }

    const totalCents = orderItems.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
    const manualPartnerCents = clampPartnerFinanceCents(parseEurosToCents(formData.get('manual_partner_euros')), totalCents);
    const orderItemIds = orderItems.map((item) => item.id);

    if (manualPartnerCents <= 0) {
      await supabase
        .from('collectivity_contributions')
        .delete()
        .eq('collectivity_id', collectivityId)
        .in('order_item_id', orderItemIds);
    } else {
      const allocations = distributeCentsAcrossItems(
        manualPartnerCents,
        orderItems.map((item) => ({
          id: item.id,
          totalCents: item.total_price_cents ?? 0
        }))
      );

      const now = new Date().toISOString();
      const { error: upsertError } = await supabase.from('collectivity_contributions').upsert(
        allocations.map((allocation) => ({
          collectivity_id: collectivityId,
          order_item_id: allocation.id,
          mode: 'FIXED' as const,
          fixed_cents: allocation.cents,
          percent_value: null,
          cap_cents: null,
          status: 'APPROVED' as const,
          approved_at: now,
          approved_by_user_id: session.userId,
          updated_at: now
        })),
        { onConflict: 'order_item_id' }
      );

      if (upsertError) {
        redirect(`/partenaire/reservations?error=${encodeURIComponent(upsertError.message)}`);
      }
    }

    revalidatePath('/partenaire/reservations');
    redirect('/partenaire/reservations');
  }

  const [collectivity, reservations] = await Promise.all([
    readPartnerCollectivity(collectivityId),
    listPartnerReservations(collectivityId, session.userId)
  ]);
  const financeMode = normalizePartnerFinanceMode(collectivity.finance_mode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Réservations</h1>
        <p className="admin-page-subtitle mt-1">
          Commandes des ayants-droit actuellement rattachés à {collectivity.name}.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Mode de financement actif : <span className="font-semibold text-slate-900">{PARTNER_FINANCE_MODE_LABELS[financeMode]}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1360px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Participants</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Part partenaire</th>
                <th className="px-4 py-3">Reste client</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => {
                const split = computePartnerFinanceSplit({
                  mode: collectivity.finance_mode,
                  totalCents: reservation.totalCents,
                  percentValue: collectivity.finance_percent_value,
                  fixedCents: collectivity.finance_fixed_cents,
                  manualPartnerCents: reservation.manualContributionCents
                });

                return (
                  <tr key={reservation.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-900">#{reservation.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(reservation.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-900">{reservation.beneficiaryName}</p>
                      <p className="mt-1 text-xs text-slate-500">{reservation.beneficiaryEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-900">{reservation.stayTitle}</p>
                      <p className="mt-1 text-xs text-slate-500">{reservation.stayLocation}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{reservation.sessionLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{reservation.childrenLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusBadgeClassName(
                            reservation.status
                          )}`}
                        >
                          {reservation.statusLabel}
                        </span>
                        {reservation.isTaggedToCollectivity ? (
                          <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
                            Code partenaire appliqué
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{reservation.totalLabel}</td>
                    <td className="px-4 py-3">
                      {financeMode === 'MANUAL' ? (
                        <form action={saveManualContribution} className="flex min-w-[220px] flex-col gap-2">
                          <input type="hidden" name="order_id" value={reservation.id} />
                          <input
                            type="number"
                            name="manual_partner_euros"
                            min="0"
                            step="0.01"
                            defaultValue={
                              split.partnerCents > 0 ? String((split.partnerCents / 100).toFixed(2).replace('.', '.')) : ''
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder="Montant partenaire"
                          />
                          <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                            Enregistrer
                          </button>
                        </form>
                      ) : (
                        <div className="font-semibold text-slate-900">{formatCurrencyFromCents(split.partnerCents)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{formatCurrencyFromCents(split.clientCents)}</div>
                    </td>
                  </tr>
                );
              })}
              {reservations.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    Aucune réservation trouvée pour vos ayants-droit rattachés.
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

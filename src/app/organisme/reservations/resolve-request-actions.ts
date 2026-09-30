'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { parseAmountEurosToCents, resolveStatusAfterRequestResolution } from '@/lib/order-workflow';
import { computePartnerContributionSnapshotCents } from '@/lib/partner-offers';

export async function resolveOrganizerCoverageRequestAction(formData: FormData) {
  const requestedOrganizerId = String(formData.get('organizer_id') ?? '').trim();
  const organizerAccess = await requireOrganizerPageAccess({
    requestedOrganizerId,
    requiredSection: 'reservations',
    forServerAction: true
  });
  const organizerId = organizerAccess.selectedOrganizerId;
  const orderId = String(formData.get('order_id') ?? '').trim();
  const requestKindRaw = String(formData.get('request_kind') ?? '').trim();
  const requestKind =
    requestKindRaw === 'VACAF' ||
    requestKindRaw === 'ANCV_CONNECT' ||
    requestKindRaw === 'ANCV_PAPER'
      ? requestKindRaw
      : null;
  const amountCents = parseAmountEurosToCents(String(formData.get('resolved_amount_euros') ?? ''));

  if (!organizerId || !orderId || !requestKind) {
    redirect(withOrganizerQuery('/organisme/reservations', organizerId));
  }

  const supabase = getServerSupabaseClient();
  // Éviter les colonnes snapshot absentes en prod (vacaf_number_snapshot, etc.).
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('id,status,request_kind,external_aid_cents,external_paid_cents')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !orderRow) {
    redirect(
      withOrganizerQuery(
        `/organisme/reservations?error=${encodeURIComponent('Réservation introuvable.')}`,
        organizerId
      )
    );
  }

  if (amountCents <= 0) {
    redirect(
      withOrganizerQuery(
        `/organisme/reservations?error=${encodeURIComponent('Indiquez un montant de prise en charge valide.')}`,
        organizerId
      )
    );
  }

  const { data: orderItemsRaw, error: itemsError } = await supabase
    .from('order_items')
    .select('id,total_price_cents,session_id')
    .eq('order_id', orderId);

  if (itemsError || !orderItemsRaw || orderItemsRaw.length === 0) {
    redirect(
      withOrganizerQuery(
        `/organisme/reservations?error=${encodeURIComponent('Impossible de charger les lignes de la réservation.')}`,
        organizerId
      )
    );
  }
  const orderItems = orderItemsRaw;

  const sessionIds = Array.from(new Set(orderItems.map((item) => item.session_id).filter(Boolean)));
  const { data: sessions } = sessionIds.length
    ? await supabase.from('sessions').select('id,stay_id').in('id', sessionIds)
    : { data: [] };
  const stayIds = Array.from(new Set((sessions ?? []).map((item) => item.stay_id).filter(Boolean)));
  const { data: stays } = stayIds.length
    ? await supabase.from('stays').select('id,organizer_id').in('id', stayIds)
    : { data: [] };

  if ((stays ?? []).some((stay) => stay.organizer_id !== organizerId)) {
    redirect(
      withOrganizerQuery(
        `/organisme/reservations?error=${encodeURIComponent('Cette réservation ne dépend pas de votre organisme.')}`,
        organizerId
      )
    );
  }

  const { data: successfulPayments } = await supabase
    .from('payments')
    .select('amount_cents,status')
    .eq('order_id', orderId)
    .eq('status', 'SUCCEEDED');
  const onlinePaidCents = (successfulPayments ?? []).reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);

  const { data: latestPayment } = await supabase
    .from('payments')
    .select('id,raw_payload')
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const totalCents = orderItems.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
  const orderItemIds = orderItems.map((item) => item.id);
  const { data: contributionRows } = orderItemIds.length
    ? await supabase
        .from('collectivity_contributions')
        .select('order_item_id,mode,fixed_cents,percent_value,cap_cents')
        .in('order_item_id', orderItemIds)
        .eq('status', 'APPROVED')
    : { data: [] };
  const contributionByOrderItemId = new Map((contributionRows ?? []).map((row) => [row.order_item_id, row]));
  const partnerContributionCents = orderItems.reduce((sum, item) => {
    const contribution = contributionByOrderItemId.get(item.id);
    if (!contribution) return sum;
    return (
      sum +
      computePartnerContributionSnapshotCents({
        mode: contribution.mode,
        totalCents: item.total_price_cents ?? 0,
        percentValue: contribution.percent_value,
        fixedCents: contribution.fixed_cents,
        capCents: contribution.cap_cents
      })
    );
  }, 0);
  const familyPayableTotalCents = Math.max(0, totalCents - partnerContributionCents);
  const nextExternalAidCents = requestKind === 'VACAF' ? amountCents : orderRow.external_aid_cents ?? 0;

  const existingPayload =
    latestPayment?.raw_payload &&
    typeof latestPayment.raw_payload === 'object' &&
    !Array.isArray(latestPayment.raw_payload)
      ? ({ ...(latestPayment.raw_payload as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const existingBreakdown =
    existingPayload.ancvCoverageBreakdown &&
    typeof existingPayload.ancvCoverageBreakdown === 'object' &&
    !Array.isArray(existingPayload.ancvCoverageBreakdown)
      ? (existingPayload.ancvCoverageBreakdown as Record<string, unknown>)
      : {};
  const existingConnectCents = Math.max(
    0,
    Math.round(Number(existingBreakdown.connectCents ?? 0)) || 0
  );
  const existingPaperCents = Math.max(0, Math.round(Number(existingBreakdown.paperCents ?? 0)) || 0);
  const hasAncvBreakdown = existingConnectCents > 0 || existingPaperCents > 0;
  const nextConnectCents =
    requestKind === 'ANCV_CONNECT'
      ? amountCents
      : hasAncvBreakdown
        ? existingConnectCents
        : 0;
  const nextPaperCents =
    requestKind === 'ANCV_PAPER'
      ? amountCents
      : hasAncvBreakdown
        ? existingPaperCents
        : 0;
  const nextExternalPaidCents =
    requestKind === 'ANCV_CONNECT' || requestKind === 'ANCV_PAPER'
      ? nextConnectCents + nextPaperCents
      : orderRow.external_paid_cents ?? 0;
  const nextStatus = resolveStatusAfterRequestResolution({
    totalCents: familyPayableTotalCents,
    externalAidCents: nextExternalAidCents,
    externalPaidCents: nextExternalPaidCents,
    onlinePaidCents
  });
  const now = new Date().toISOString();

  // Conserver le request_kind d'origine si l'autre aide est aussi en jeu (cumul CAF + ANCV).
  // ANCV_PAPER n'est pas une valeur DB : on ne l'écrit pas dans request_kind.
  const nextRequestKind =
    requestKind === 'VACAF'
      ? 'VACAF'
      : orderRow.request_kind === 'VACAF'
        ? 'VACAF'
        : requestKind === 'ANCV_CONNECT'
          ? 'ANCV_CONNECT'
          : orderRow.request_kind;

  // Ne pas inclure request_resolved_at / partially_paid_at : absents sur certaines bases prod.
  const updatePayload: Record<string, string | number | null> = {
    request_kind: nextRequestKind,
    external_aid_cents: nextExternalAidCents,
    external_paid_cents: nextExternalPaidCents,
    status: nextStatus,
    paid_at: nextStatus === 'PAID' ? now : null
  };

  let updateError = (await supabase.from('orders').update(updatePayload).eq('id', orderId)).error;

  if (updateError && isMissingAnyColumnError(updateError, ['external_paid_cents'])) {
    const { external_paid_cents: _ignored, ...withoutExternalPaid } = updatePayload;
    updateError = (await supabase.from('orders').update(withoutExternalPaid).eq('id', orderId)).error;
  }

  if (
    !updateError &&
    latestPayment?.id &&
    (requestKind === 'ANCV_CONNECT' || requestKind === 'ANCV_PAPER')
  ) {
    const nextPayload = {
      ...existingPayload,
      ancvCoverageBreakdown: {
        connectCents: nextConnectCents,
        paperCents: nextPaperCents,
        updatedAt: now
      }
    };
    const { error: payloadError } = await supabase
      .from('payments')
      .update({ raw_payload: nextPayload })
      .eq('id', latestPayment.id);
    if (payloadError) {
      console.error('organisme/reservations: ventilation ANCV non enregistrée', payloadError);
    }
  }

  if (updateError) {
    redirect(
      withOrganizerQuery(
        `/organisme/reservations?error=${encodeURIComponent(updateError.message)}`,
        organizerId
      )
    );
  }

  if (nextStatus === 'PAID') {
    try {
      const { ensureClientTravelInvoiceForOrder } = await import('@/lib/client-travel-invoice.server');
      await ensureClientTravelInvoiceForOrder(orderId);
    } catch (invoiceError) {
      console.error('organisme/reservations: génération facture client échouée', invoiceError);
    }
  }

  revalidatePath('/organisme/reservations');
  redirect(
    withOrganizerQuery(
      `/organisme/reservations?coverageSaved=1&coverageOrderId=${encodeURIComponent(orderId)}`,
      organizerId
    )
  );
}

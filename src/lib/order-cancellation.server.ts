import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import type { Database } from '@/types/supabase';

export type CancellationKind = 'CANCEL_ONLY' | 'REFUND';
export type CancellationRequestStatus =
  | 'PENDING_MNEMOS'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED_DIRECT';

export async function getOrderOnlinePaidCents(
  supabase: SupabaseClient<Database>,
  orderId: string
) {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents, status')
    .eq('order_id', orderId)
    .eq('status', 'SUCCEEDED');

  return (payments ?? []).reduce((sum, payment) => sum + Math.max(0, payment.amount_cents ?? 0), 0);
}

export async function assertOrderBelongsToOrganizer(
  supabase: SupabaseClient<Database>,
  orderId: string,
  organizerId: string
) {
  const { data: items } = await supabase
    .from('order_items')
    .select('session_id')
    .eq('order_id', orderId);

  const sessionIds = Array.from(new Set((items ?? []).map((item) => item.session_id).filter(Boolean)));
  if (sessionIds.length === 0) {
    throw new Error('Réservation introuvable.');
  }

  const { data: sessions } = await supabase.from('sessions').select('stay_id').in('id', sessionIds);
  const stayIds = Array.from(new Set((sessions ?? []).map((row) => row.stay_id).filter(Boolean)));
  const { data: stays } = stayIds.length
    ? await supabase.from('stays').select('id, organizer_id').in('id', stayIds)
    : { data: [] as Array<{ id: string; organizer_id: string }> };

  if (!(stays ?? []).length || (stays ?? []).some((stay) => stay.organizer_id !== organizerId)) {
    throw new Error('Cette réservation ne dépend pas de votre organisme.');
  }
}

async function notifyFamilyCancellation(input: {
  email: string | null;
  orderId: string;
  kind: CancellationKind;
  approved?: boolean;
}) {
  if (!input.email || !input.email.includes('@')) return;

  const isCancelOnly = input.kind === 'CANCEL_ONLY';
  const subject = isCancelOnly
    ? input.approved === false
      ? '[Resacolo] Demande d’annulation refusée'
      : '[Resacolo] Votre réservation a été annulée'
    : input.approved
      ? '[Resacolo] Demande de remboursement acceptée'
      : '[Resacolo] Demande de remboursement refusée';

  const text = isCancelOnly
    ? input.approved === false
      ? [
          'Bonjour,',
          '',
          `La demande d’annulation pour la réservation ${input.orderId} n’a pas été acceptée.`,
          `Contactez-nous si besoin : ${SITE_URL}/contact`,
          '',
          '— L’équipe Resacolo'
        ].join('\n')
      : [
          'Bonjour,',
          '',
          `Votre réservation ${input.orderId} a été annulée.`,
          `Vous pouvez consulter votre espace : ${SITE_URL}/mon-compte`,
          '',
          '— L’équipe Resacolo'
        ].join('\n')
    : input.approved
      ? [
          'Bonjour,',
          '',
          `Votre demande de remboursement pour la réservation ${input.orderId} a été acceptée.`,
          'Le remboursement sera traité sous peu.',
          '',
          '— L’équipe Resacolo'
        ].join('\n')
      : [
          'Bonjour,',
          '',
          `Votre demande de remboursement pour la réservation ${input.orderId} n’a pas été acceptée.`,
          `Contactez-nous si besoin : ${SITE_URL}/contact`,
          '',
          '— L’équipe Resacolo'
        ].join('\n');

  try {
    await sendSmtpEmail({ to: input.email, subject, text });
  } catch (error) {
    console.error('[order-cancellation] family mail failed', error);
  }
}

export async function createOrganizerCancellationRequest(input: {
  supabase: SupabaseClient<Database>;
  orderId: string;
  organizerId: string;
  userId: string;
  reason: string;
  attachmentPath?: string | null;
  amountCents?: number | null;
}) {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new Error('Indiquez un motif (5 caractères minimum).');
  }

  await assertOrderBelongsToOrganizer(input.supabase, input.orderId, input.organizerId);

  const { data: order, error: orderError } = await input.supabase
    .from('orders')
    .select('id, status, client_user_id, cancellation_reason')
    .eq('id', input.orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error('Réservation introuvable.');
  }
  if (order.status === 'CANCELLED' || order.status === 'FAILED' || order.status === 'CART') {
    throw new Error('Cette réservation est déjà annulée.');
  }

  const { data: pending } = await input.supabase
    .from('order_cancellation_requests')
    .select('id')
    .eq('order_id', input.orderId)
    .eq('status', 'PENDING_MNEMOS')
    .maybeSingle();

  if (pending) {
    throw new Error('Une demande d’annulation / remboursement est déjà en attente.');
  }

  const onlinePaidCents = await getOrderOnlinePaidCents(input.supabase, input.orderId);
  const kind: CancellationKind = onlinePaidCents > 0 ? 'REFUND' : 'CANCEL_ONLY';

  const amountCents =
    kind === 'REFUND'
      ? input.amountCents != null && Number.isFinite(input.amountCents)
        ? Math.max(0, Math.round(input.amountCents))
        : onlinePaidCents
      : null;

  if (kind === 'REFUND' && (amountCents == null || amountCents <= 0 || amountCents > onlinePaidCents)) {
    throw new Error('Montant de remboursement invalide.');
  }

  const { data: request, error: insertError } = await input.supabase
    .from('order_cancellation_requests')
    .insert({
      order_id: input.orderId,
      organizer_id: input.organizerId,
      kind,
      status: 'PENDING_MNEMOS',
      reason,
      attachment_path: input.attachmentPath ?? null,
      amount_cents: amountCents,
      created_by_user_id: input.userId
    })
    .select('id')
    .single();

  if (insertError || !request) {
    throw new Error(insertError?.message ?? 'Impossible de créer la demande.');
  }

  try {
    const subjectKind = kind === 'REFUND' ? 'remboursement' : 'annulation';
    await sendSmtpEmail({
      to: 'jeanne@thalie.org',
      subject: `[Resacolo] Demande d’${subjectKind} à valider — ${input.orderId}`,
      text: [
        `Nouvelle demande d’${subjectKind} organisateur (contrôle Mnemos).`,
        `Demande : ${request.id}`,
        `Commande : ${input.orderId}`,
        kind === 'REFUND' && amountCents != null
          ? `Montant : ${(amountCents / 100).toFixed(2)} €`
          : 'Aucun paiement CB encaissé.',
        `Motif : ${reason}`,
        `${SITE_URL}/mnemos/cancellations/${request.id}`
      ]
        .filter(Boolean)
        .join('\n')
    });
  } catch (error) {
    console.error('[order-cancellation] mnemos alert mail failed', error);
  }

  return { requestId: request.id, kind, status: 'PENDING_MNEMOS' as const };
}

export async function reviewCancellationRequest(input: {
  supabase: SupabaseClient<Database>;
  requestId: string;
  reviewerUserId: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
}) {
  const { data: request, error } = await input.supabase
    .from('order_cancellation_requests')
    .select('*')
    .eq('id', input.requestId)
    .maybeSingle();

  if (error || !request) {
    throw new Error('Demande introuvable.');
  }
  if (request.status !== 'PENDING_MNEMOS') {
    throw new Error('Cette demande a déjà été traitée.');
  }

  const now = new Date().toISOString();
  const reviewNote = input.reviewNote?.trim() || null;

  if (input.decision === 'REJECTED') {
    const { error: updateError } = await input.supabase
      .from('order_cancellation_requests')
      .update({
        status: 'REJECTED',
        reviewed_by_user_id: input.reviewerUserId,
        reviewed_at: now,
        review_note: reviewNote,
        updated_at: now
      })
      .eq('id', input.requestId);

    if (updateError) throw new Error(updateError.message);

    const { data: order } = await input.supabase
      .from('orders')
      .select('client_user_id')
      .eq('id', request.order_id)
      .maybeSingle();
    const { data: profile } = order
      ? await input.supabase
          .from('client_profiles')
          .select('parent1_email')
          .eq('user_id', order.client_user_id)
          .maybeSingle()
      : { data: null };

    await notifyFamilyCancellation({
      email: profile?.parent1_email ?? null,
      orderId: request.order_id,
      kind: request.kind === 'CANCEL_ONLY' ? 'CANCEL_ONLY' : 'REFUND',
      approved: false
    });

    return { status: 'REJECTED' as const };
  }

  const defaultReviewNote =
    request.kind === 'CANCEL_ONLY'
      ? 'Annulation validée par Mnemos.'
      : 'Remboursement validé (traitement opérationnel manuel).';

  const { error: updateError } = await input.supabase
    .from('order_cancellation_requests')
    .update({
      status: 'APPROVED',
      reviewed_by_user_id: input.reviewerUserId,
      reviewed_at: now,
      review_note: reviewNote ?? defaultReviewNote,
      updated_at: now
    })
    .eq('id', input.requestId);

  if (updateError) throw new Error(updateError.message);

  const cancellationReasonPrefix =
    request.kind === 'CANCEL_ONLY' ? 'ANNULATION_VALIDEE' : 'REMBOURSEMENT_VALIDE';

  const { error: cancelError } = await input.supabase
    .from('orders')
    .update({
      status: 'CANCELLED',
      cancelled_at: now,
      cancellation_reason: `${cancellationReasonPrefix}: ${request.reason}`.slice(0, 500),
      updated_at: now
    })
    .eq('id', request.order_id);

  if (cancelError) throw new Error(cancelError.message);

  const { data: order } = await input.supabase
    .from('orders')
    .select('client_user_id')
    .eq('id', request.order_id)
    .maybeSingle();
  const { data: profile } = order
    ? await input.supabase
        .from('client_profiles')
        .select('parent1_email')
        .eq('user_id', order.client_user_id)
        .maybeSingle()
    : { data: null };

  await notifyFamilyCancellation({
    email: profile?.parent1_email ?? null,
    orderId: request.order_id,
    kind: request.kind === 'CANCEL_ONLY' ? 'CANCEL_ONLY' : 'REFUND',
    approved: true
  });

  return { status: 'APPROVED' as const };
}

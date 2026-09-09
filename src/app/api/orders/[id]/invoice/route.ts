import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CHECKOUT_CLIENT_COOKIE_NAME } from '@/lib/checkout/clientIdentity';
import { getSession } from '@/lib/auth/session';
import { ensureClientTravelInvoiceForOrder } from '@/lib/client-travel-invoice.server';
import { createSignedMnemosInvoicePdfUrl } from '@/lib/mnemos/invoice-pdf.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveOrderOwnerUserId() {
  const session = await getSession();
  if (session?.isClient && session.userId) {
    return session.userId;
  }

  const store = await cookies();
  const guestId = store.get(CHECKOUT_CLIENT_COOKIE_NAME)?.value?.trim();
  if (guestId && isUuid(guestId)) {
    return guestId;
  }

  return null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  if (!orderId || !isUuid(orderId)) {
    return NextResponse.json({ error: 'Identifiant de commande invalide.' }, { status: 400 });
  }

  const ownerUserId = await resolveOrderOwnerUserId();
  if (!ownerUserId) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,client_user_id,status,external_paid_cents')
    .eq('id', orderId)
    .eq('client_user_id', ownerUserId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: 'Impossible de charger la commande.' }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }
  if (order.status === 'CART' || order.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'La facture n’est pas disponible pour cette commande.' },
      { status: 409 }
    );
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount_cents,status')
    .eq('order_id', orderId);

  if (paymentsError) {
    return NextResponse.json({ error: 'Impossible de vérifier le paiement.' }, { status: 500 });
  }

  const onlinePaidCents = (payments ?? [])
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
  const clientPaidCents = onlinePaidCents + Math.max(0, order.external_paid_cents ?? 0);
  if (clientPaidCents <= 0) {
    return NextResponse.json(
      { error: 'La facture n’est disponible qu’après un paiement.' },
      { status: 409 }
    );
  }

  try {
    const invoice = await ensureClientTravelInvoiceForOrder(orderId);
    const signedUrl = await createSignedMnemosInvoicePdfUrl(supabase, invoice.pdfPath);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Impossible de préparer le téléchargement de la facture.' }, { status: 500 });
    }
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de générer la facture.';
    const unpaid =
      message.includes('après un paiement') || message.includes('pas disponible');
    return NextResponse.json({ error: message }, { status: unpaid ? 409 : 500 });
  }
}

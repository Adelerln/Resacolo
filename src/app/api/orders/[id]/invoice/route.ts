import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CHECKOUT_CLIENT_COOKIE_NAME } from '@/lib/checkout/clientIdentity';
import { getSession } from '@/lib/auth/session';
import { ensureClientTravelInvoiceForOrder } from '@/lib/client-travel-invoice.server';
import { formatClientTravelInvoiceNumber } from '@/lib/mnemos/client-travel-invoice-template.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVOICE_PDF_BUCKET = 'invoice-pdfs';

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

async function downloadInvoicePdfBytes(supabase: ReturnType<typeof getServerSupabaseClient>, pdfPath: string) {
  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from(INVOICE_PDF_BUCKET)
    .download(pdfPath);
  if (downloadError || !pdfBlob) {
    return null;
  }
  return Buffer.from(await pdfBlob.arrayBuffer());
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
  if (order.status === 'CART' || order.status === 'CANCELLED' || order.status === 'FAILED') {
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
    // Réutilise le PDF déjà stocké ; ne régénère que s’il manque.
    let invoice = await ensureClientTravelInvoiceForOrder(orderId, { refreshPdf: false });
    if (!invoice.pdfPath) {
      invoice = await ensureClientTravelInvoiceForOrder(orderId, { refreshPdf: true });
    }
    if (!invoice.pdfPath) {
      return NextResponse.json({ error: 'PDF facture introuvable.' }, { status: 500 });
    }

    let bytes = await downloadInvoicePdfBytes(supabase, invoice.pdfPath);
    if (!bytes?.length) {
      invoice = await ensureClientTravelInvoiceForOrder(orderId, { refreshPdf: true });
      if (!invoice.pdfPath) {
        return NextResponse.json({ error: 'PDF facture introuvable.' }, { status: 500 });
      }
      bytes = await downloadInvoicePdfBytes(supabase, invoice.pdfPath);
    }

    if (!bytes?.length) {
      return NextResponse.json({ error: 'Impossible de télécharger la facture.' }, { status: 500 });
    }

    const fileName = `facture-${formatClientTravelInvoiceNumber(invoice.invoiceYear, invoice.invoiceNumber)}.pdf`;
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300',
        'Content-Length': String(bytes.length)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de générer la facture.';
    const unpaid = message.includes('après un paiement') || message.includes('pas disponible');
    return NextResponse.json({ error: message }, { status: unpaid ? 409 : 500 });
  }
}

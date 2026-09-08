import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId')?.trim();
  const transId = url.searchParams.get('transId')?.trim();
  const source = url.searchParams.get('source')?.trim().toLowerCase();

  // Balance payments come from the family account area — send them back there.
  if (source === 'balance' && orderId) {
    const target = new URL(`/mon-compte/reservations/${orderId}/paiement`, url.origin);
    target.searchParams.set('cancelled', '1');
    if (transId) target.searchParams.set('transId', transId);
    return NextResponse.redirect(target);
  }

  // Checkout tunnel: customer can retry without failing the payment immediately.
  const target = new URL('/checkout/paiement', url.origin);
  target.searchParams.set('cancelled', '1');
  if (orderId) target.searchParams.set('orderId', orderId);
  if (transId) target.searchParams.set('transId', transId);
  return NextResponse.redirect(target);
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prepareOrderBalancePayment } from '@/lib/order-balance-payment';

export const runtime = 'nodejs';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseAmountCents(body: unknown): number | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.amountCents === 'number' && Number.isFinite(record.amountCents)) {
    return Math.round(record.amountCents);
  }
  if (typeof record.amountEuros === 'number' && Number.isFinite(record.amountEuros)) {
    return Math.round(record.amountEuros * 100);
  }
  if (typeof record.amountEuros === 'string' && record.amountEuros.trim()) {
    const parsed = Number(record.amountEuros.trim().replace(',', '.'));
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    if (!orderId || !isUuid(orderId)) {
      return NextResponse.json({ error: 'Identifiant de commande invalide.' }, { status: 400 });
    }

    const session = await getSession();
    if (!session?.isClient || !session.userId) {
      return NextResponse.json({ error: 'Connexion famille requise.' }, { status: 401 });
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const result = await prepareOrderBalancePayment({
      orderId,
      clientUserId: session.userId,
      amountCents: parseAmountCents(body)
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de préparer le paiement.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prepareOrderBalancePayment } from '@/lib/order-balance-payment';

export const runtime = 'nodejs';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    if (!orderId || !isUuid(orderId)) {
      return NextResponse.json({ error: 'Identifiant de commande invalide.' }, { status: 400 });
    }

    const session = await getSession();
    if (!session?.isClient || !session.userId) {
      return NextResponse.json({ error: 'Connexion famille requise.' }, { status: 401 });
    }

    const result = await prepareOrderBalancePayment({
      orderId,
      clientUserId: session.userId
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de préparer le paiement.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

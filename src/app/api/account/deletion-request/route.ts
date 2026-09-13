import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import {
  createAccountDeletionRequest,
  getPendingAccountDeletionRequest
} from '@/lib/account-deletion.server';
import { getApiErrorMessage } from '@/lib/checkout/api';

export const runtime = 'nodejs';

const createSchema = z.object({
  reason: z.string().trim().max(2000).optional().default(''),
  fullName: z.string().trim().max(200).optional().default(''),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez confirmer la demande de suppression.' })
  })
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const pending = await getPendingAccountDeletionRequest(session.userId);
    return NextResponse.json({ pending });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const email = (session.email || '').trim();
    if (!email) {
      return NextResponse.json({ error: 'Adresse e-mail du compte introuvable.' }, { status: 400 });
    }
    const request = await createAccountDeletionRequest({
      userId: session.userId,
      email,
      fullName: body.fullName || session.name || '',
      reason: body.reason
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
    }
    const message = getApiErrorMessage(error);
    const isConflict = message.toLowerCase().includes('déjà en cours');
    return NextResponse.json({ error: message }, { status: isConflict ? 409 : 400 });
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildEmailConfirmRedirectUrl } from '@/lib/auth/urls';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  email: z.string().trim().email('Adresse email invalide.')
});

export async function POST(req: Request) {
  try {
    const { email } = bodySchema.parse(await req.json());
    const normalizedEmail = email.toLowerCase();
    const emailRedirectTo = buildEmailConfirmRedirectUrl(req);

    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });

    // Explicit user action: allow a longer SMTP wait than registration.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo }
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'Envoi impossible.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 500 });
  }
}

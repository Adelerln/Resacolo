import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findLegacyWpCustomerByEmail } from '@/lib/legacy-wp/server';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email()
});

/**
 * Indique si un email legacy non claimé doit passer par la réinitialisation MDP.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ needsPasswordReset: false }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const legacy = await findLegacyWpCustomerByEmail(email);
    const needsPasswordReset = Boolean(legacy && !legacy.claimed_user_id);

    return NextResponse.json({ needsPasswordReset });
  } catch (error) {
    console.warn('[auth/legacy-status] unexpected error:', error);
    return NextResponse.json({ needsPasswordReset: false });
  }
}

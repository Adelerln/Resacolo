import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { buildAuthCallbackUrl } from '@/lib/auth/urls';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const inviteSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide.'),
  firstName: z.string().trim().max(80).optional().default(''),
  lastName: z.string().trim().max(80).optional().default('')
});

function canInviteFamilyMember(session: Awaited<ReturnType<typeof getSession>>) {
  return Boolean(session && (session.role === 'CLIENT' || session.isClient));
}

function buildInviterDisplayName(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const fromSession = session.name?.trim();
  if (fromSession) return fromSession;
  if (session.email) return session.email;
  return 'Un proche';
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!canInviteFamilyMember(session) || !session) {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const body = inviteSchema.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    if (email === session.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas vous inviter vous-même.' },
        { status: 400 }
      );
    }

    const inviteeName = [body.firstName, body.lastName].filter(Boolean).join(' ').trim();
    const invitedByName = buildInviterDisplayName(session);
    const redirectTo = buildAuthCallbackUrl(req, {
      next: '/login/reinitialiser?invite=1',
      loginMode: 'family',
      flow: 'invite'
    });

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_by_user_id: session.userId,
        invited_by_email: session.email,
        invited_by_name: invitedByName,
        full_name: inviteeName || undefined,
        name: inviteeName || undefined,
        account_type: 'family'
      }
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('already been registered') ||
        message.includes('already registered') ||
        message.includes('user already exists') ||
        error.code === 'email_exists'
      ) {
        return NextResponse.json(
          { error: 'Un compte existe déjà avec cette adresse e-mail.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message || "Impossible d'envoyer l'invitation." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      email,
      userId: data.user?.id ?? null
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { buildAuthCallbackUrl } from '@/lib/auth/urls';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email()
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
    }

    const nextEmail = parsed.data.email.trim().toLowerCase();
    const cookieStore = await cookies();
    const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
    const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    }

    const currentEmail = user.email?.trim().toLowerCase() ?? '';
    if (currentEmail === nextEmail) {
      return NextResponse.json({ error: 'Cette adresse est déjà associée à votre compte.' }, { status: 400 });
    }

    const emailRedirectTo = buildAuthCallbackUrl(req, {
      next: '/confirmation-mail?status=success',
      flow: 'email-change'
    });

    const { error } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Ne pas mettre à jour client_profiles ici : l'e-mail affiché sur Mon compte
    // doit rester l'ancien jusqu'à validation du lien de confirmation Auth.

    return NextResponse.json({
      ok: true,
      message:
        'Un e-mail de confirmation a été envoyé à la nouvelle adresse. Le changement sera effectif après validation.'
    });
  } catch (error) {
    console.error('[auth/change-email]', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

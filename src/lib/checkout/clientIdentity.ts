import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { getServerSupabaseClient } from '@/lib/supabase/server';

const CLIENT_COOKIE_NAME = 'resacolo_client_id';
const CHECKOUT_GUEST_DOMAIN = 'checkout.resacolo.local';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function createGuestCheckoutUserId() {
  const supabase = getServerSupabaseClient();
  const email = `guest+${randomUUID()}@${CHECKOUT_GUEST_DOMAIN}`;
  const password = `${randomUUID()}${randomUUID()}`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      source: 'checkout_guest'
    }
  });

  if (error || !data.user?.id) {
    throw new Error('Impossible de créer l’utilisateur client pour le checkout.');
  }

  return data.user.id;
}

async function ensureCheckoutUserId(candidate: string) {
  if (!isUuid(candidate)) return null;

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(candidate);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

function canUseGuestFallback() {
  if (process.env.MOCK_UI === '1') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.NEXT_PUBLIC_DEV_BYPASS_CHECKOUT === '1';
}

export async function getOrCreateClientUserId() {
  const session = await getSession();
  if (session?.role === 'CLIENT' && session.userId) {
    return session.userId;
  }

  if (!canUseGuestFallback()) {
    throw new Error('Connexion famille requise pour finaliser le paiement.');
  }

  const store = await cookies();
  const existing = store.get(CLIENT_COOKIE_NAME)?.value;

  if (existing) {
    const ensured = await ensureCheckoutUserId(existing);
    if (ensured) return ensured;
  }

  const generated = await createGuestCheckoutUserId();
  store.set(CLIENT_COOKIE_NAME, generated, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365
  });

  return generated;
}

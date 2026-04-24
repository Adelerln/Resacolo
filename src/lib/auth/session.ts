import crypto from 'crypto';
import { cookies } from 'next/headers';

export type AppRole = 'ADMIN' | 'ORGANISATEUR' | 'PARTENAIRE' | 'CLIENT';

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string | null;
  role: AppRole;
  tenantId?: string | null;
};

type SessionCookieOptions = {
  rememberMe?: boolean;
};

const COOKIE_NAME = 'resacolo_session';
const SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me';

function sign(data: string) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex');
}

export function createSessionToken(payload: SessionPayload) {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString('base64url');
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  const expected = sign(data);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const json = Buffer.from(data, 'base64url').toString('utf-8');
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload, options?: SessionCookieOptions) {
  const token = createSessionToken(payload);
  const cookieStore = await cookies();
  const rememberMe = options?.rememberMe === true;
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    ...(rememberMe ? { maxAge: 7 * 24 * 60 * 60 } : {})
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0)
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

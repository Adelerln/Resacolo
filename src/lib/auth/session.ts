import crypto from 'crypto';
import { cookies } from 'next/headers';

export type AppRole = 'ADMIN' | 'ORGANISATEUR' | 'PARTENAIRE';

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string | null;
  role: AppRole;
  tenantId?: string | null;
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

export function setSessionCookie(payload: SessionPayload) {
  const token = createSessionToken(payload);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export function getSession(): SessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

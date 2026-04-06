import crypto from 'crypto';

const ITERATIONS = 120000;
const KEYLEN = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, iterStr, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2' || !iterStr || !salt || !hash) return false;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations)) return false;
  const computed = crypto.pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
}

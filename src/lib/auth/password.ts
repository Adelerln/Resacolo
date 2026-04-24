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
  try {
    const [algo, iterStr, salt, hash] = stored.split('$');
    if (algo !== 'pbkdf2' || !iterStr || !salt || !hash) return false;

    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations < 1) return false;

    // Compatibilite: certains comptes historiques peuvent avoir une longueur de hash differente.
    if (!/^[a-f0-9]+$/i.test(hash) || hash.length % 2 !== 0) return false;
    const keyLength = hash.length / 2;
    if (!Number.isInteger(keyLength) || keyLength < 1) return false;

    const computed = crypto.pbkdf2Sync(password, salt, iterations, keyLength, DIGEST).toString('hex');
    if (hash.length !== computed.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

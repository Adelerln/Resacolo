import type { Json } from '@/types/supabase';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(^|[^\w])((?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4})(?!\w)/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const SENSITIVE_KEYWORDS = [
  'email',
  'mail',
  'phone',
  'telephone',
  'tel',
  'contact',
  'password',
  'token',
  'secret',
  'auth',
  'user_id',
  'client_user_id',
  'assigned_to_user_id',
  'created_by_user_id',
  'author_user_id'
];

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function redactPIIText(value: string) {
  return value
    .replace(EMAIL_RE, '[EMAIL_REDACTED]')
    .replace(PHONE_RE, (_match, prefix: string) => `${prefix}[PHONE_REDACTED]`)
    .replace(UUID_RE, '[ID_REDACTED]');
}

export function redactPIIJson(value: Json): Json {
  if (value === null) return null;
  if (typeof value === 'string') return redactPIIText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.map((entry) => redactPIIJson(entry as Json));
  }

  const output: Record<string, Json> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = redactPIIJson((entry ?? null) as Json);
  }
  return output;
}

export function serializeRedactedObject(input: Record<string, unknown>) {
  const json = redactPIIJson((input as Json) ?? {});
  return JSON.stringify(json, null, 2);
}

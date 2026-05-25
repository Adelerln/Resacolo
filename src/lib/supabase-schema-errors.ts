type SupabaseErrorLike = { message?: string | null; code?: string | null } | null | undefined;

function toMessage(input: SupabaseErrorLike | string | null | undefined) {
  if (typeof input === 'string') return input;
  return String(input?.message ?? '');
}

export function isSchemaCacheError(input: SupabaseErrorLike | string | null | undefined) {
  const message = toMessage(input).toLowerCase();
  return message.includes('schema cache');
}

export function isMissingColumnError(
  input: SupabaseErrorLike | string | null | undefined,
  column: string
) {
  const message = toMessage(input);
  return message.includes(`Could not find the '${column}' column`);
}

export function isMissingAnyColumnError(
  input: SupabaseErrorLike | string | null | undefined,
  columns: string[]
) {
  return columns.some((column) => isMissingColumnError(input, column));
}

export function extractMissingColumn(input: SupabaseErrorLike | string | null | undefined) {
  const message = toMessage(input);
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

export function buildFeatureActivationMessage(featureLabel: string) {
  return `${featureLabel} n'est pas encore activé sur cet environnement. Appliquez les migrations puis rafraîchissez le cache Supabase/PostgREST.`;
}


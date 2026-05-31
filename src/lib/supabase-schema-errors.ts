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
  const normalized = message.toLowerCase();
  const columnLower = column.toLowerCase();

  if (message.includes(`Could not find the '${column}' column`)) {
    return true;
  }

  if (normalized.includes(`could not find the '${columnLower}' column`)) {
    return true;
  }

  // Postgres / PostgREST variants, e.g. "column orders.partially_paid_at does not exist"
  return (
    normalized.includes(`${columnLower} does not exist`) ||
    normalized.includes(`column ${columnLower} does not exist`)
  );
}

export function isMissingAnyColumnError(
  input: SupabaseErrorLike | string | null | undefined,
  columns: string[]
) {
  return columns.some((column) => isMissingColumnError(input, column));
}

export function extractMissingColumn(input: SupabaseErrorLike | string | null | undefined) {
  const message = toMessage(input);
  const cacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (cacheMatch?.[1]) {
    return cacheMatch[1];
  }

  const postgresMatch = message.match(/column (?:[a-z0-9_]+\.)?([a-z0-9_]+) does not exist/i);
  return postgresMatch?.[1] ?? null;
}

export function buildFeatureActivationMessage(featureLabel: string) {
  return `${featureLabel} n'est pas encore activé sur cet environnement. Appliquez les migrations puis rafraîchissez le cache Supabase/PostgREST.`;
}


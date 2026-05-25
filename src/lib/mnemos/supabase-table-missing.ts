/** Erreur PostgREST : relation absente ou cache schéma. */
export function isMissingPublicTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('schema cache') || msg.includes('could not find the table') || error.code === 'PGRST205';
}

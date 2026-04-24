const MNEMOS_BACKOFFICE_ACCESS_ADMINS = new Set([
  'jeanne.rolinv@gmail.com',
  'adele.rolin@gmail.com'
]);

export function canManageBackofficeAccess(email: string | null | undefined): boolean {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  return normalizedEmail.length > 0 && MNEMOS_BACKOFFICE_ACCESS_ADMINS.has(normalizedEmail);
}

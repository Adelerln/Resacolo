/**
 * Séjour « complet » côté catalogue : au moins une session encore affichée
 * (non terminée / non archivée) mais aucune en statut OPEN (places dispo).
 */
export function staySessionsAppearFullyBooked(
  sessions: Array<{ status: string | null }> | null | undefined
): boolean {
  if (!sessions || sessions.length === 0) return false;
  const visible = sessions.filter(
    (session) => session.status !== 'COMPLETED' && session.status !== 'ARCHIVED'
  );
  if (visible.length === 0) return false;
  return !visible.some((session) => session.status === 'OPEN');
}

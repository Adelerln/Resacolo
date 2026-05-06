import { requireRole } from '@/lib/auth/require';

export default async function PartnerHome() {
  const session = await requireRole('PARTENAIRE');

  return (
    <div className="space-y-4">
      <h1 className="admin-page-title">Bonjour {session.name ?? 'Partenaire'}</h1>
      <p className="admin-page-subtitle">
        Consulte le catalogue attribué et suis les réservations.
      </p>
    </div>
  );
}

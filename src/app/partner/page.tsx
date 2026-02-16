import { requireRole } from '@/lib/auth/require';

export default function PartnerHome() {
  const session = requireRole('PARTENAIRE');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Bonjour {session.name ?? 'Partenaire'}</h1>
      <p className="text-sm text-slate-600">
        Consulte le catalogue attribue et suis les demandes.
      </p>
    </div>
  );
}

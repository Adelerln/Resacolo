import { requireRole } from '@/lib/auth/require';

export default function OrganizerHome() {
  const session = requireRole('ORGANISATEUR');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Bonjour {session.name ?? 'Organisateur'}</h1>
      <p className="text-sm text-slate-600">
        Gere tes sejours, sessions et demandes.
      </p>
    </div>
  );
}

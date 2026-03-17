import { requireRole } from '@/lib/auth/require';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PartnerHome() {
  const session = requireRole('PARTENAIRE');

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">Bonjour {session.name ?? 'Partenaire'}</h1>
      <p className="text-sm text-slate-600">
        Consulte le catalogue attribué et suis les réservations.
      </p>
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import ManualDraftAutoStart from './ManualDraftAutoStart';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
  }>;
};

function formatRedirectValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * La saisie manuelle crée un brouillon puis redirige tout de suite vers le tunnel (relecture),
 * sans écran « ouvrir l’éditeur de brouillon ».
 */
export default async function NewStayManualPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const errorParam = formatRedirectValue(resolvedSearchParams?.error);

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  return (
    <div className="space-y-6">
      {errorParam ? <ErrorToast message={decodeURIComponent(errorParam)} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saisie manuelle</h1>
          <p className="mt-1 text-sm text-slate-600">
            {selectedOrganizer
              ? `Préparation du formulaire pour ${selectedOrganizer.name}…`
              : 'Préparation du formulaire…'}
          </p>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/sejours/new', selectedOrganizerId)}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour au choix
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <ManualDraftAutoStart organizerId={selectedOrganizerId} />
      </div>
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import {
  OrganizerWorkspaceNav,
  OrganizerWorkspaceSelector
} from '@/components/organisme/OrganizerWorkspaceControls';
import { resolveOrganizerSelection } from '@/lib/organizers.server';

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const session = requireRole('ORGANISATEUR');
  const { organizers, selectedOrganizerId } = await resolveOrganizerSelection(
    undefined,
    session.tenantId ?? null
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white">
          <div className="px-6 py-6">
            <div className="mb-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </Link>
            </div>
            <div>
              <Link href="/organisme" className="text-lg font-semibold text-slate-900">
                Espace Organisateur
              </Link>
              <p className="mt-1 text-xs text-slate-500">Gestion des séjours</p>
            </div>
          </div>
          <Suspense fallback={<div className="px-3 text-sm text-slate-500">Chargement...</div>}>
            <OrganizerWorkspaceNav
              organizers={organizers}
              initialSelectedOrganizerId={selectedOrganizerId}
            />
          </Suspense>
          <div className="mt-auto px-6 pb-6 pt-4">
            <form action="/api/auth/logout" method="post">
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300">
                Déconnexion
              </button>
            </form>
            <div className="mt-4 flex items-center justify-start">
              <Image
                src="/image/accueil/images_accueil/logo-resacolo.png"
                alt="Resacolo"
                width={120}
                height={32}
                className="h-8 w-auto opacity-70"
              />
            </div>
          </div>
        </aside>
        <main className="flex-1 px-6 py-10">
          <Suspense
            fallback={<div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4" />}
          >
            <OrganizerWorkspaceSelector
              organizers={organizers}
              initialSelectedOrganizerId={selectedOrganizerId}
            />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}

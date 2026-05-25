import Image from 'next/image';
import Link from 'next/link';
import { PartnerSidebarNav } from '@/components/partner/PartnerSidebarNav';
import { requirePartner } from '@/lib/auth/require';
import { getPartnerAccessRoleFromSession, getPartnerNavLinks } from '@/lib/partner-access';
import { partnerHasMarqueBlancheAccess } from '@/lib/partner-offers';
import { readPartnerCollectivity } from '@/lib/partner.server';

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePartner();
  const tenantId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);

  let partnerNavLinks = getPartnerNavLinks(accessRole);
  if (tenantId) {
    try {
      const collectivity = await readPartnerCollectivity(tenantId);
      if (!partnerHasMarqueBlancheAccess(collectivity.offer_mode)) {
        partnerNavLinks = partnerNavLinks.filter((item) => item.href !== '/partenaire/marque-blanche');
      }
    } catch {
      partnerNavLinks = partnerNavLinks.filter((item) => item.href !== '/partenaire/marque-blanche');
    }
  } else {
    partnerNavLinks = partnerNavLinks.filter((item) => item.href !== '/partenaire/marque-blanche');
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:h-screen lg:overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-center gap-3">
          <Link href="/partenaire" className="text-base font-semibold text-slate-900">
            Espace Partenaire
          </Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm text-slate-600">
          {partnerNavLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="inline-flex shrink-0 rounded-full border border-slate-200 px-3 py-1.5 font-semibold transition hover:border-slate-300 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex min-h-screen lg:h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:h-screen lg:overflow-y-auto">
          <div className="px-6 py-6">
            <p className="text-lg font-semibold text-slate-900">Espace Partenaire</p>
          </div>
          <PartnerSidebarNav links={partnerNavLinks} />
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
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

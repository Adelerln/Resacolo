import Link from 'next/link';

const helpLinks = [
  { href: '/bien-choisir-sa-colo', label: 'Bien choisir sa colo' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' }
];

const legalLinks = [
  { href: '/confidentialite', label: 'Politique de Confidentialité' },
  { href: '/cgv', label: 'Conditions Générales de Vente des organisateurs' },
  { href: '/cgu', label: 'Conditions Générales d’utilisation' },
  { href: '/mentions-legales', label: 'Mentions légales' }
];

export function Footer() {
  return (
    <footer className="bg-[#7dbcf0] text-white">
      <div className="section-container py-6 sm:py-8">
        <div className="border-t border-white/35 pt-5 sm:pt-6">
          <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.2fr_0.9fr]">
            <div className="max-w-md">
              <Link href="/" className="inline-flex items-start text-white">
                <span className="font-display text-[34px] font-bold uppercase leading-none tracking-tight sm:text-[42px] lg:text-[52px]">
                  RESACOLO
                </span>
              </Link>
              <div className="mt-4 space-y-3 text-sm leading-6 text-white sm:text-[15px]">
                <p>
                  Plateforme de référencement et de réservation de colonies de vacances élaborée par des organisateurs
                  de séjours.
                </p>
                <p>
                  Faciliter l&apos;accès à une offre centralisée, riche et variée de séjours de vacances à destination
                  d&apos;enfants, d&apos;adolescents et de jeunes adultes, sans intermédiaire ni surcoût.
                </p>
              </div>
            </div>

            <div className="space-y-7">
              <div>
                <h2 className="text-[15px] font-bold uppercase tracking-[0.03em] text-white">Aide</h2>
                <ul className="mt-4 space-y-3 text-[15px] font-semibold leading-5 text-white">
                  {helpLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-white transition hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-[15px] font-bold uppercase tracking-[0.03em] text-white">Informations légales</h2>
                <ul className="mt-4 space-y-3 text-[15px] font-semibold leading-5 text-white">
                  {legalLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-white transition hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/20 px-4 py-3 text-center text-xs font-bold text-white sm:text-sm">
        © 2026 – RESACOLO | Colonie de vacances pour enfants, ados et séjour jeunes adultes
      </div>
    </footer>
  );
}

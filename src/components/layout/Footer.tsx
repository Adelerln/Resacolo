import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type FooterHighlight = {
  title: string;
  imageSrc: string;
  description: ReactNode;
};

const footerHighlights: FooterHighlight[] = [
  {
    title: 'Authenticité',
    description: (
      <>
        <strong>100 % des séjours</strong> conçus et organisés par des opérateurs producteurs
      </>
    ),
    imageSrc: '/image/accueil/pictos_accueil/qualite.png'
  },
  {
    title: 'Savoir-faire',
    description: (
      <>
        <strong>De 5 à 75 ans</strong> d’expérience dans le secteur des accueils collectifs de mineurs
      </>
    ),
    imageSrc: '/image/accueil/pictos_accueil/evaluation.png'
  },
  {
    title: 'Engagement',
    description: (
      <>
        <strong>La sécurité et l’épanouissement</strong> des enfants comme premières préoccupations
      </>
    ),
    imageSrc: '/image/accueil/pictos_accueil/bouclier.png'
  }
];

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

export function Footer({ hideHelpAndLegal = false }: { hideHelpAndLegal?: boolean }) {
  return (
    <footer className="relative overflow-visible bg-[#7dbcf0] text-white">
      <div className="pointer-events-none absolute right-0 top-0 z-10 translate-y-[-42%]" aria-hidden>
        <Image
          src="/image/accueil/pictos_accueil/gouttes.png"
          alt=""
          width={320}
          height={240}
          className="h-auto w-28 object-contain sm:w-36 lg:w-52 xl:w-64"
        />
      </div>

      <div className="section-container relative py-9 sm:py-10 lg:py-12">
        <h2 className="mx-auto max-w-4xl text-center font-display text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
          Ce que RESACOLO vous offre
        </h2>

        <div className="mt-6 grid gap-5 sm:mt-7 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          {footerHighlights.map((item) => {
            return (
              <article key={item.title} className="flex flex-col items-center text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Image
                    src={item.imageSrc}
                    alt=""
                    width={40}
                    height={40}
                    className="h-9 w-9 object-contain"
                  />
                </div>
                <h3 className="text-xl font-bold leading-tight sm:text-[1.25rem]">{item.title}</h3>
                <p className="mx-auto mt-2 max-w-[17rem] text-[0.92rem] leading-6 text-white/95 sm:max-w-xs sm:text-[0.95rem]">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="section-container py-6 sm:py-8">
        <div className="border-t border-white/35 pt-5 sm:pt-6">
          <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.2fr_0.9fr]">
            <div className="max-w-md">
              <Link href="/" className="inline-flex items-start text-white">
                <Image
                  src="/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final copie 2.png"
                  alt="Resacolo"
                  width={420}
                  height={110}
                  className="h-auto w-56 object-contain sm:w-64 lg:w-80"
                />
              </Link>
              <div className="mt-4 space-y-3 text-sm leading-6 text-white sm:text-[15px]">
                <p>
                  Plateforme de référencement et de réservation de colonies de vacances élaborée par
                  des organisateurs de séjours.
                </p>
                <p>
                  Faciliter l&apos;accès à une offre centralisée, riche et variée de séjours de
                  vacances à destination d&apos;enfants, d&apos;adolescents et de jeunes adultes,
                  sans intermédiaire ni surcoût.
                </p>
              </div>
            </div>

            {!hideHelpAndLegal ? (
              <div className="space-y-7">
                <div>
                  <h2 className="text-[15px] font-bold uppercase tracking-[0.03em] text-white">
                    Aide
                  </h2>
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
                  <h2 className="text-[15px] font-bold uppercase tracking-[0.03em] text-white">
                    Informations légales
                  </h2>
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
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="section-container py-3">
          <div className="pl-5 text-left text-xs font-bold text-white sm:pl-6 sm:text-sm lg:pl-8">
            © 2026 – RESACOLO | Colonies de vacances pour enfants, ados et séjours jeunes adultes
          </div>
        </div>
      </div>
    </footer>
  );
}

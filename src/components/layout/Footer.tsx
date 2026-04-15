import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, CircleHelp, FileLock2, Mail, Scale, Shield } from 'lucide-react';

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
    imageSrc: '/image/footer/qualite.png'
  },
  {
    title: 'Savoir-faire',
    description: (
      <>
        <strong>De 5 à 75 ans</strong> d’expérience dans le secteur des accueils collectifs de mineurs
      </>
    ),
    imageSrc: '/image/footer/evaluation.png'
  },
  {
    title: 'Engagement',
    description: (
      <>
        <strong>La sécurité et l’épanouissement</strong> des enfants comme premières préoccupations
      </>
    ),
    imageSrc: '/image/footer/bouclier.png'
  }
];

const helpLinks: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/bien-choisir-sa-colo', label: 'Bien choisir sa colo', Icon: BarChart3 },
  { href: '/faq', label: 'FAQ', Icon: CircleHelp },
  { href: '/contact', label: 'Contact', Icon: Mail }
];

const legalLinks: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/confidentialite', label: 'Politique de Confidentialité', Icon: Shield },
  { href: '/cgv', label: 'Conditions Générales de Vente des organisateurs', Icon: FileLock2 },
  { href: '/cgu', label: 'Conditions Générales d’utilisation', Icon: FileLock2 },
  { href: '/mentions-legales', label: 'Mentions légales', Icon: Scale }
];

const footerLinkIconClass =
  'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-white/90';

export function Footer({ hideHelpAndLegal = false }: { hideHelpAndLegal?: boolean }) {
  return (
    <footer className="relative overflow-visible bg-[color:var(--color-primary)] text-white">
      <div className="pointer-events-none absolute right-0 top-0 z-10 translate-y-[-42%]" aria-hidden>
        <Image
          src="/image/footer/gouttes.png"
          alt=""
          width={320}
          height={240}
          sizes="(max-width: 640px) 7rem, (max-width: 1024px) 9rem, (max-width: 1280px) 13rem, 16rem"
          className="h-auto w-28 object-contain sm:w-36 lg:w-52 xl:w-64"
          style={{ height: 'auto' }}
          loading="eager"
        />
      </div>

      <div className="section-container relative py-7 sm:py-8 lg:py-9">
        <h2 className="mx-auto max-w-4xl text-center font-display text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
          Ce que RESACOLO vous offre
        </h2>

        <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {footerHighlights.map((item) => {
            return (
              <article key={item.title} className="flex flex-col items-center text-center">
                <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Image
                    src={item.imageSrc}
                    alt=""
                    width={40}
                    height={40}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <h3 className="text-xl font-bold leading-tight sm:text-[1.25rem]">{item.title}</h3>
                <p className="mx-auto mt-1.5 max-w-[17rem] text-[0.92rem] leading-6 text-white/95 sm:max-w-xs sm:text-[0.95rem]">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="section-container py-5 sm:py-6">
        <div className="border-t border-white/35 pt-4 sm:pt-5">
          <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.2fr_0.9fr]">
            <div className="max-w-md overflow-visible text-left">
              <Link
                href="/"
                className="footer-logo-resacolo-link block w-fit max-w-full text-white"
              >
                <Image
                  src="/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final copie 2.png"
                  alt="Resacolo"
                  width={420}
                  height={110}
                  className="h-auto w-56 object-contain object-left sm:w-64 lg:w-80"
                  style={{ height: 'auto' }}
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
              <div className="space-y-5">
                <div>
                  <h2 className="text-[15px] font-bold uppercase tracking-[0.03em] text-white">
                    Aide
                  </h2>
                  <ul className="mt-3 space-y-2 text-[15px] font-semibold leading-snug text-white">
                    {helpLinks.map(({ href, label, Icon }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="flex w-full cursor-pointer items-start gap-2 text-white hover:text-white"
                        >
                          <span className={footerLinkIconClass} aria-hidden>
                            <Icon className="h-4 w-4" strokeWidth={2} />
                          </span>
                          <span className="min-w-0 flex-1">{label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2 className="text-[15px] font-bold uppercase tracking-[0.03em] text-white">
                    Informations légales
                  </h2>
                  <ul className="mt-3 space-y-2 text-[15px] font-semibold leading-snug text-white">
                    {legalLinks.map(({ href, label, Icon }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="flex w-full cursor-pointer items-start gap-2 text-white hover:text-white"
                        >
                          <span className={footerLinkIconClass} aria-hidden>
                            <Icon className="h-4 w-4" strokeWidth={2} />
                          </span>
                          <span className="min-w-0 flex-1">{label}</span>
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
          <div className="text-center text-xs font-bold text-white sm:text-sm">
            © 2026 – RESACOLO | Colonies de vacances pour enfants, ados et séjours jeunes adultes
          </div>
        </div>
      </div>
    </footer>
  );
}

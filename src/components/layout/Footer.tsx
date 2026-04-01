import Link from 'next/link';
import { Award, CheckCircle2, HeartHandshake, type LucideIcon } from 'lucide-react';

type FooterHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const footerHighlights: FooterHighlight[] = [
  {
    title: 'Authenticité',
    description: '100 % des séjours conçus et organisés par des opérateurs producteurs',
    icon: CheckCircle2
  },
  {
    title: 'Savoir-faire',
    description: 'De 5 à 75 ans d’expérience dans le secteur des accueils collectifs de mineurs',
    icon: Award
  },
  {
    title: 'Engagement',
    description: 'La sécurité et l’épanouissement des enfants comme premières préoccupations',
    icon: HeartHandshake
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

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#7dbcf0] text-white">
      <div
        className="pointer-events-none absolute right-4 top-6 h-8 w-8 rounded-[60%_40%_65%_35%/40%_55%_45%_60%] bg-[#FA8500] sm:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[-3.5rem] top-[4.75rem] hidden h-[16rem] w-[20rem] xl:block"
        aria-hidden
      >
        <span className="absolute right-44 top-0 h-32 w-20 rotate-[40deg] rounded-[72%_28%_65%_35%/64%_60%_40%_36%] bg-[#FA8500]">
          <span className="absolute left-4 top-4 h-2.5 w-8 rounded-full bg-white/90" />
        </span>
        <span className="absolute right-16 top-9 h-40 w-24 rotate-[33deg] rounded-[68%_32%_60%_40%/64%_58%_42%_36%] bg-[#FA8500]">
          <span className="absolute left-4 top-5 h-2.5 w-10 rounded-full bg-white/90" />
        </span>
        <span className="absolute right-0 top-28 h-28 w-40 rotate-[16deg] rounded-[62%_38%_58%_42%/58%_45%_55%_42%] bg-[#FA8500]">
          <span className="absolute right-7 top-4 h-2.5 w-8 rotate-[18deg] rounded-full bg-white/90" />
        </span>
      </div>

      <div className="section-container relative py-9 sm:py-10 lg:py-12">
        <h2 className="mx-auto max-w-4xl text-center font-display text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
          Ce que RESACOLO vous offre
        </h2>

        <div className="mt-6 grid gap-5 sm:mt-7 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          {footerHighlights.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="flex flex-col items-center text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#FA8500] shadow-sm">
                  <Icon className="h-6 w-6" aria-hidden />
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
                <span className="font-display text-[34px] font-bold uppercase leading-none tracking-tight sm:text-[42px] lg:text-[52px]">
                  RESACOLO
                </span>
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
          </div>
        </div>
      </div>

      <div className="border-t border-white/20 px-4 py-3 text-center text-xs font-bold text-white sm:text-sm">
        © 2026 – RESACOLO | Colonie de vacances pour enfants, ados et séjour jeunes adultes
      </div>
    </footer>
  );
}

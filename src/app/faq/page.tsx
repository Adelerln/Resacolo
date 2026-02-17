import Link from 'next/link';
import { FaqAccordion } from '@/components/faq/FaqAccordion';

const BLUE = '#3B82F6';
const LIGHT_BLUE = '#60A5FA';
const ORANGE = '#F97316';

export const metadata = {
  title: 'FAQ | ResaColo',
  description:
    "Questions fréquentes sur le processus d'inscription et les colonies de vacances ResaColo."
};

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1: FAQ Accordion */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <header className="mb-10 text-center">
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            Processus <span style={{ color: BLUE }}>d&apos;inscription</span>
          </h1>
          <p className="mt-4 text-slate-600">
            Un doute ? Nous vous accompagnons durant tout le processus de réservation.
          </p>
        </header>
        <FaqAccordion />
      </section>

      {/* Section 2: Contact Banner */}
      <section
        className="border-t border-slate-100 py-16 md:py-20"
        style={{ backgroundColor: '#F7F8FA' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
          {/* Visual: Airplane + wavy lines */}
          <div className="relative flex-shrink-0 lg:order-1">
            <svg
              viewBox="0 0 200 160"
              className="h-40 w-40 sm:h-52 sm:w-52 lg:h-56 lg:w-56"
              aria-hidden
            >
              <defs>
                <linearGradient id="plane-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={LIGHT_BLUE} />
                  <stop offset="100%" stopColor={BLUE} />
                </linearGradient>
              </defs>
              {/* Wavy trail behind plane */}
              <path
                d="M 80 90 Q 120 70 180 85 Q 220 95 280 90"
                fill="none"
                stroke={LIGHT_BLUE}
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.7"
              />
              <path
                d="M 75 100 Q 115 82 175 97 Q 215 107 275 102"
                fill="none"
                stroke={LIGHT_BLUE}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.5"
              />
              {/* Airplane body */}
              <g transform="translate(20, 45) rotate(-15 40 35)">
                <path
                  d="M 10 35 L 75 35 L 70 30 L 78 35 L 70 40 L 75 35 Z"
                  fill="url(#plane-grad)"
                />
                <path
                  d="M 35 15 L 45 35 L 35 35 Z"
                  fill="url(#plane-grad)"
                  opacity="0.9"
                />
                <path
                  d="M 50 25 L 55 35 L 50 45 L 48 35 Z"
                  fill="url(#plane-grad)"
                  opacity="0.9"
                />
                <circle cx="25" cy="35" r="6" fill="url(#plane-grad)" />
              </g>
            </svg>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col items-center text-center lg:order-2 lg:items-start lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Contactez-nous !
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold text-slate-800 sm:text-3xl">
              Envie d&apos;échanger sur votre projet de{' '}
              <span style={{ color: ORANGE }} className="font-bold">
                Colonie de vacances
              </span>{' '}
              pour votre enfant ?
            </h2>
            <span className="mt-2 block text-4xl font-bold text-slate-300 sm:text-5xl">?</span>
            <p className="mt-6 max-w-xl text-slate-600 text-sm leading-relaxed sm:text-base">
              Pour toute question sur une de nos colonies de vacances, n&apos;hésitez pas à contacter
              l&apos;organisateur du séjour qui vous intéresse. Chaque colonie de vacances est gérée par un
              organisateur spécifique, expert dans son domaine, et prêt à vous fournir des informations détaillées
              et adaptées à vos besoins.
            </p>
            <div className="mt-8 w-full lg:flex lg:justify-end">
              <Link
                href="/contact"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#F97316] px-8 py-4 font-semibold uppercase tracking-wide text-white shadow-md transition hover:opacity-95 sm:w-auto"
              >
                Contactez un des organisateurs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

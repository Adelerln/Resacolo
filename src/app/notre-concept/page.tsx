import Link from 'next/link';
import {
  Users,
  Globe,
  Handshake,
  Euro,
  MapPin,
  Shapes
} from 'lucide-react';
import { PourquoiChoisirTabs } from '@/components/concept/PourquoiChoisirTabs';

const BLUE = '#3B82F6';
const ORANGE = '#F97316';
const LIGHT_BLUE = '#93C5FD';

const strengths = [
  {
    icon: Users,
    title: 'Projet ambitieux',
    caption: 'porté par un collectif d\'organisateurs engagés'
  },
  {
    icon: Globe,
    title: 'Destinations multiples',
    caption: ''
  },
  {
    icon: Handshake,
    title: 'Plateforme mutualiste',
    caption: ''
  },
  {
    icon: Euro,
    title: 'Démarche qualitative',
    caption: 'au prix le plus juste'
  },
  {
    icon: MapPin,
    title: 'Ancrage territorial',
    caption: ''
  },
  {
    icon: Shapes,
    title: 'Diversité de l\'offre',
    caption: ''
  }
];

export const metadata = {
  title: 'Notre Concept | ResaColo',
  description:
    'Découvrez l\'origine, les valeurs et les garanties de la plateforme ResaColo.'
};

export default function NotreConceptPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* 1. INTRO HEADER */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              À propos
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Notre <span style={{ color: ORANGE }}>concept</span>
            </h1>
            <p className="mt-6 max-w-xl leading-relaxed text-slate-600">
              Né d&apos;une réflexion collective sur la protection et la valorisation d&apos;un savoir-faire, RESACOLO
              est devenu le projet mutualiste de membres de l&apos;association ResoColo.
            </p>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative inline-block">
              <span
                className="font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl lg:text-6xl"
                style={{
                  background: `linear-gradient(135deg, ${LIGHT_BLUE} 0%, ${BLUE} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                RESACOLO
              </span>
              <div className="absolute -right-1 top-2 h-2.5 w-2.5 rounded-full opacity-80" style={{ backgroundColor: ORANGE }} aria-hidden />
              <div className="absolute bottom-2 left-4 h-2 w-2 rounded-full opacity-70" style={{ backgroundColor: ORANGE }} aria-hidden />
              <div className="absolute right-6 top-6 h-3 w-3 rounded-full opacity-90" style={{ backgroundColor: ORANGE }} aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* 2. ORIGIN STORY */}
      <section className="border-t border-slate-100 bg-slate-50/30 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="flex items-center justify-center gap-0">
              <div className="flex items-center justify-center gap-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="text-center">
                  <span className="font-display text-2xl font-bold text-slate-800">
                    Reso<span style={{ color: '#DC2626' }}>C</span>
                    <span style={{ color: '#EAB308' }}>o</span>lo
                  </span>
                </div>
                <div className="h-16 w-px rotate-[-15deg] bg-slate-300" />
                <div className="text-center">
                  <span className="font-display text-2xl font-bold" style={{ color: BLUE }}>
                    RESACOLO
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                <span style={{ color: BLUE }}>À l&apos;origine,</span> un projet collectif.
              </h2>
              <p className="mt-6 leading-relaxed text-slate-600">
                RESACOLO est le fruit de l&apos;imagination de professionnels de l&apos;Enfance-Jeunesse réunis au sein
                de l&apos;association ResoColo. Soucieux de protéger et valoriser leur savoir-faire, ils ont conçu une
                plateforme mutualiste qui met en avant une offre collective riche et variée de colonies de vacances, tout
                en facilitant l&apos;accès des familles à des séjours de qualité.
              </p>
              <div className="mt-8 flex justify-end">
                <a
                  href="https://resocolo.org"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-xl px-6 py-3 font-semibold text-white shadow-md transition hover:opacity-95"
                  style={{ backgroundColor: ORANGE }}
                >
                  Resocolo.org
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. STRENGTHS GRID */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {strengths.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${ORANGE}20` }}
                >
                  <item.icon className="h-7 w-7" style={{ color: ORANGE }} />
                </div>
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                {item.caption && (
                  <p className="mt-1 text-sm text-slate-500">{item.caption}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              Nos <span style={{ color: BLUE }}>6 points forts</span>
            </h2>
            <blockquote className="mt-8 border-l-4 pl-6 italic text-slate-600" style={{ borderColor: BLUE }}>
              « Concevoir des séjours, c&apos;est notre métier et notre passion »
            </blockquote>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE TABS */}
      <section className="border-t border-slate-100 bg-slate-50/30 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-12 text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Pourquoi nous <span style={{ color: BLUE }}>choisir</span> ?
          </h2>
          <PourquoiChoisirTabs />
        </div>
      </section>

      {/* 5. GUARANTEES */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[20%_1fr] lg:gap-16">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              Nos <span style={{ color: BLUE }}>garanties</span>
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            <div className="flex flex-col gap-4 py-6 first:pt-0 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                Atout France
              </div>
              <p className="text-slate-600">
                Les organisateurs sont tous{' '}
                <strong className="text-slate-800">immatriculés au registre des opérateurs de voyages</strong> et
                s&apos;engagent à respecter les normes en vigueur pour la protection des mineurs et la qualité des
                séjours.
              </p>
            </div>
            <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                Marianne
              </div>
              <p className="text-slate-600">
                Chaque séjour fait l&apos;objet de déclarations officielles auprès des{' '}
                <strong className="text-slate-800">autorités de tutelle</strong>. La conformité et la sécurité des
                accueils collectifs de mineurs sont ainsi garanties.
              </p>
            </div>
            <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                EDV
              </div>
              <p className="text-slate-600">
                Les membres de RESACOLO sont adhérents{' '}
                <strong className="text-slate-800">des Entreprises du Voyage</strong>, signe d&apos;un engagement
                professionnel et d&apos;une exigence de qualité reconnue par la filière.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

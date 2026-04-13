import type { Metadata } from 'next';
import Image from 'next/image';
import { MapPin, ClipboardList, Mail } from 'lucide-react';

const ORANGE = '#FA8500';
const ORIGIN_GRAY = '#505050';

export const metadata: Metadata = {
  title: 'Rejoindre Resacolo | Resacolo',
  description:
    'Rejoignez le collectif Resacolo en tant qu’organisateur de séjours et valorisez vos colonies de vacances.'
};

export default function RejoindreResacoloPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-slate-100 pb-16 pt-14 md:pb-20 md:pt-16 lg:pb-24 lg:pt-20">
        <div className="section-container grid min-h-0 gap-7 pb-3 md:grid-cols-2 md:items-center md:gap-10 md:pb-5 lg:gap-12">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">À propos</p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.06] text-slate-900 sm:text-4xl lg:text-[3.25rem]">
              <span style={{ color: ORANGE }}>Rejoindre </span>
              <span style={{ color: ORIGIN_GRAY }}>Resacolo</span>
            </h1>
            <p className="mt-6 max-w-xl text-justify font-medium leading-relaxed text-slate-600">
              Vous portez des colonies de vacances ou des séjours jeunesse&nbsp;? Rejoignez le collectif Resacolo pour
              gagner en visibilité dans un cadre qualitatif et mutualiste.
              <br />
              <br />
              Seuls les organisateurs producteurs de séjours sont référencés&nbsp;: les revendeurs ne sont pas
              éligibles (clause d&apos;exclusion en cas de manquement).
            </p>
            <ul className="mt-6 space-y-2.5 text-sm font-medium leading-relaxed text-slate-600">
              <li className="flex items-start gap-2.5">
                <Image
                  src="/image/organisateurs/pictos_orga/age.png"
                  alt=""
                  width={16}
                  height={16}
                  className="mt-0.5 h-4 w-4 shrink-0 object-contain"
                />
                Intégrer un collectif d&apos;organisateurs engagés.
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" aria-hidden />
                Valoriser vos destinations et vos projets éducatifs.
              </li>
              <li className="flex items-start gap-2.5">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" aria-hidden />
                Centraliser la présentation de votre catalogue.
              </li>
            </ul>
          </div>

          <div className="flex min-h-[9rem] items-center justify-center md:min-h-[13rem] md:justify-end">
            <div className="w-full max-w-[36rem]">
              <Image
                src="/image/concept/pictos_concept/projetambitieux.png"
                alt="Projet ambitieux Resacolo"
                width={400}
                height={400}
                priority
                className="mx-auto h-auto w-full max-w-[18rem] object-contain md:max-w-[22rem]"
                sizes="(max-width: 768px) 18rem, 22rem"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-container pb-20">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-white px-6 py-8 md:px-10 md:py-10">
            <h2 className="text-center text-3xl font-bold text-slate-900 sm:text-4xl">
              Prendre contact avec Resacolo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-600">
              Décrivez votre structure, vos types de séjours et vos attentes. Nous reviendrons vers vous pour
              échanger sur les modalités d&apos;intégration au collectif.
            </p>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-8 md:px-10 md:pb-10 md:pt-8">
            <form className="mx-auto max-w-3xl space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nom de l&apos;organisme *
                </label>
                <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Numéro Atout France (IM + 9 chiffres) *
                </label>
                <input
                  placeholder="ex : IM012345678"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Numéro SDJES (format XXXORGXXXX) *
                </label>
                <input
                  placeholder="ex : 123ORG4567"
                  pattern="^[0-9]{3}ORG[0-9]{4}$"
                  title="Format attendu : 123ORG4567"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 uppercase shadow-sm outline-none focus:border-brand-600"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Site web (facultatif)
                </label>
                <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Nom *</label>
                <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Prénom *</label>
                <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Email *</label>
                <input
                  type="email"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Téléphone (facultatif)
                </label>
                <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Présentez brièvement vos séjours et vos attentes *
              </label>
              <textarea
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white p-4 shadow-sm outline-none focus:border-brand-600"
                placeholder="Types de séjours, publics accueillis, périodes, volumes approximatifs, etc."
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">* champs obligatoires</p>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-accent-600"
              >
                <Mail className="h-4 w-4" />
                Envoyer la demande
              </button>
            </div>
          </form>
          </div>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import { Users, MapPin, ClipboardList, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Devenir organisateur | Resacolo',
  description:
    'Rejoignez le collectif Resacolo en tant qu’organisateur de séjours et valorisez vos colonies de vacances.'
};

export default function DevenirOrganisateurPage() {
  return (
    <div className="bg-white">
      {/* Hero / garde courte */}
      <section className="section-container py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              À PROPOS
            </p>
            <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              Présenter vos <span className="text-accent-500">séjours</span> sur Resacolo
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Vous portez des colonies de vacances ou des séjours jeunesse&nbsp;? Rejoignez le collectif Resacolo pour
              gagner en visibilité dans un cadre qualitatif et mutualiste.
              <br />
              Seuls les organisateurs producteurs de séjours sont référencés&nbsp;: les revendeurs ne sont pas
              éligibles (clause d&apos;exclusion en cas de manquement).
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent-500" />
                Intégrer un collectif d&apos;organisateurs engagés.
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent-500" />
                Valoriser vos destinations et vos projets éducatifs.
              </li>
              <li className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent-500" />
                Centraliser la présentation de votre catalogue.
              </li>
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="flex h-56 w-56 items-center justify-center rounded-3xl bg-accent-50 shadow-md ring-1 ring-accent-200 md:h-72 md:w-72">
              <Users className="h-28 w-28 text-accent-500 md:h-36 md:w-36" />
            </div>
          </div>
        </div>
      </section>

      {/* Formulaire de contact simple */}
      <section className="section-container pb-20">
        <div className="rounded-2xl bg-slate-50 p-6 md:p-10">
          <h2 className="text-center text-3xl font-bold text-slate-900 sm:text-4xl">
            Prendre contact avec Resacolo
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-slate-600 leading-relaxed">
            Décrivez votre structure, vos types de séjours et vos attentes. Nous reviendrons vers vous pour
            échanger sur les modalités d&apos;intégration au collectif.
          </p>

          <form className="mx-auto mt-10 max-w-3xl space-y-6">
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

            <div className="flex items-center justify-between">
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
      </section>
    </div>
  );
}

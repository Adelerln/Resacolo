import { ExternalLink, Calendar, User, ShieldCheck } from 'lucide-react';
import { SlotMachineVisual } from '@/components/bien-choisir/SlotMachineVisual';
import { ChoisirSaColoLogo } from '@/components/bien-choisir/ChoisirSaColoLogo';

const ORANGE = '#F97316';
const BLUE = '#3B82F6';

export const metadata = {
  title: 'Bien choisir sa colo | ResaColo',
  description:
    'Conseils et ressources pour bien choisir la colonie de vacances de votre enfant. Découvrez ChoisirSaColo.fr.'
};

export default function BienChoisirSaColoPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1: Header */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Aide & conseils
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              <span style={{ color: ORANGE }}>Bien choisir</span> sa colo
            </h1>
            <p className="mt-6 max-w-xl leading-relaxed text-slate-600">
              Sélectionner une colonie de vacances peut s&apos;avérer compliqué face à une offre diversifiée de
              séjours, surtout si c&apos;est la première fois que l&apos;on confie son enfant. Profitez de nos
              conseils pour bien choisir !
            </p>
          </div>
          <div className="flex items-center justify-center lg:justify-end">
            <SlotMachineVisual />
          </div>
        </div>
      </section>

      {/* Section 2: Spotlight - ChoisirSaColo.fr */}
      <section className="bg-gradient-to-r from-blue-50 to-white py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-white/80 p-8 shadow-xl backdrop-blur-sm sm:p-10 md:flex md:items-center md:gap-12 md:p-12">
            <div className="flex flex-shrink-0 justify-center md:max-w-[45%]">
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <ChoisirSaColoLogo />
              </div>
            </div>
            <div className="mt-8 flex-1 md:mt-0">
              <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                Besoin d&apos;aller plus loin ?
              </h2>
              <p className="mt-2 text-lg font-semibold text-slate-700">
                Découvrez{' '}
                <span className="font-bold" style={{ color: BLUE }}>
                  ChoisirSaColo.fr
                </span>
              </p>
              <p className="mt-4 leading-relaxed text-slate-600">
                La plateforme de référence pour tout savoir sur les colonies de vacances :
                réglementations, aides financières, projet éducatif…
              </p>
              <a
                href="https://www.choisirsacolo.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 font-semibold text-white shadow-lg transition hover:opacity-95 sm:w-auto"
                style={{
                  background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #DC2626 100%)'
                }}
              >
                Visiter le site officiel
                <ExternalLink className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Quick Tips */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Calendar,
              title: "S'y prendre à l'avance",
              description: 'Réservez tôt pour avoir le choix des dates et des séjours.'
            },
            {
              icon: User,
              title: 'Impliquer son enfant',
              description: 'Choisissez ensemble la thématique et le type d\'activités qui lui plaisent.'
            },
            {
              icon: ShieldCheck,
              title: 'Vérifier le label',
              description: 'Privilégiez les organisateurs agréés et les séjours déclarés.'
            }
          ].map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${BLUE}15` }}
              >
                <item.icon className="h-7 w-7" style={{ color: BLUE }} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

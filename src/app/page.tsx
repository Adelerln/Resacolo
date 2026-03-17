'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import { OrganizersMarquee } from '@/components/organisateurs/OrganizersMarquee';
import {
  Users,
  Repeat,
  Award,
  PawPrint,
  Waves,
  Palette,
  Mountain,
  BookOpen,
  Search,
  UserPlus,
  CheckCircle,
  Briefcase,
  Home,
  HeartHandshake,
  CreditCard,
  Building2,
  MapPin,
  Clock,
  Euro,
  ArrowRight,
  ChevronRight,
  X,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Data ────────────────────────────────────────────────────────────────── */

const benefits = [
  { icon: Users, text: "Un site conçu par un collectif d'organisateurs." },
  { icon: Repeat, text: 'Réservation en circuit court sans intermédiaire.' },
  { icon: Award, text: "Une offre riche et variée issue d'opérateurs reconnus." }
];

const categories = [
  { label: 'Animaux', icon: PawPrint },
  { label: 'Aquatiques', icon: Waves },
  { label: 'Artistiques', icon: Palette },
  { label: 'Aventure', icon: Mountain },
  { label: 'Culture', icon: BookOpen }
];

const exampleCamps: Record<
  string,
  { title: string; age: string; location: string; duration: string; price: string }[]
> = {
  Animaux: [
    { title: 'La ferme enchantée', age: '6-10 ans', location: 'Normandie', duration: '7 jours', price: '490 €' },
    { title: 'Aventure équestre', age: '10-14 ans', location: 'Auvergne', duration: '10 jours', price: '650 €' },
    { title: 'Découverte animalière', age: '8-12 ans', location: 'Bretagne', duration: '5 jours', price: '380 €' }
  ],
  Aquatiques: [
    { title: 'Stage voile & kayak', age: '10-14 ans', location: "Côte d'Azur", duration: '7 jours', price: '550 €' },
    { title: 'Surf & bodyboard', age: '12-16 ans', location: 'Landes', duration: '10 jours', price: '720 €' },
    { title: 'Plongée junior', age: '11-15 ans', location: 'Corse', duration: '7 jours', price: '680 €' }
  ],
  Artistiques: [
    { title: 'Atelier théâtre & cirque', age: '8-12 ans', location: 'Provence', duration: '7 jours', price: '460 €' },
    { title: 'Musique & création', age: '10-14 ans', location: 'Île-de-France', duration: '5 jours', price: '350 €' },
    { title: 'Cinéma & vidéo', age: '12-16 ans', location: 'Lyon', duration: '7 jours', price: '520 €' }
  ],
  Aventure: [
    { title: 'Rando & bivouac', age: '12-16 ans', location: 'Pyrénées', duration: '10 jours', price: '600 €' },
    { title: 'Multi-activités nature', age: '8-12 ans', location: 'Jura', duration: '7 jours', price: '480 €' },
    { title: 'Escalade & VTT', age: '10-14 ans', location: 'Alpes', duration: '7 jours', price: '560 €' }
  ],
  Culture: [
    { title: 'Découverte du patrimoine', age: '10-14 ans', location: 'Loire', duration: '5 jours', price: '380 €' },
    { title: 'Séjour linguistique', age: '12-16 ans', location: 'Angleterre', duration: '14 jours', price: '1 200 €' },
    { title: 'Sciences & espace', age: '8-12 ans', location: 'Toulouse', duration: '7 jours', price: '510 €' }
  ]
};

const processSteps = [
  { icon: Search, title: 'Choisir', desc: 'Trouvez la destination, les activités idéales…' },
  { icon: UserPlus, title: "S'inscrire", desc: 'Choisissez vos options, saisissez vos informations…' },
  { icon: CheckCircle, title: 'Valider', desc: "L'organisateur se met en relation avec vous…" }
];

const aids = [
  {
    icon: Briefcase,
    label: 'Employeur / CSE',
    desc: 'Votre comité social et économique peut prendre en charge une partie ou la totalité du séjour. Renseignez-vous auprès de votre employeur.'
  },
  {
    icon: Home,
    label: 'CAF',
    desc: "La Caisse d'Allocations Familiales propose des aides comme les bons VACAF pour financer les séjours de vos enfants."
  },
  {
    icon: Building2,
    label: 'Collectivité (Mairie/Région)',
    desc: 'De nombreuses mairies et régions offrent des subventions ou chèques vacances pour les familles.'
  },
  {
    icon: HeartHandshake,
    label: 'JPA',
    desc: 'La Jeunesse au Plein Air propose des bourses et aides financières pour les familles à revenus modestes.'
  },
  {
    icon: CreditCard,
    label: 'ANCV (Chèque-vacances)',
    desc: 'Les chèques-vacances ANCV sont acceptés par de nombreux organisateurs de colos partenaires.'
  }
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.5 } })
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [activeTheme, setActiveTheme] = useState('Animaux');
  const [openAidIdx, setOpenAidIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      {/* ── Hero ── */}
      <section
        id="accueil"
        className="relative overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-24"
        style={{ background: 'var(--hero-gradient)' }}
      >
        <div className="section-container flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text */}
          <motion.div
            className="flex-1 text-center lg:text-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Resa<span className="text-brand-500">Colo</span>
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-lg mx-auto lg:mx-0">
              Les organisateurs de colos réunis vous offrent leur savoir-faire pour faire grandir vos enfants.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link
                href="/sejours"
                className="btn btn-primary btn-md"
              >
                Trouver une colo
                <ArrowRight size={18} />
              </Link>
              <a
                href="#comment-ca-marche"
                className="btn btn-secondary btn-md"
              >
                Comment ça marche ?
              </a>
            </div>

            <p className="mt-6 text-xs sm:text-sm text-slate-500">
              Sans intermédiaire • Circuit court • Organisateurs reconnus
            </p>
          </motion.div>

          {/* Image */}
          <motion.div
            className="flex-1 w-full max-w-lg lg:max-w-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="relative aspect-[16/10] rounded-3xl overflow-hidden shadow-lg">
              <Image
                src={getMockImageUrl(mockImages.home.hero, 900, 80)}
                alt="Enfants heureux en colonie de vacances"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pourquoi Resacolo ── */}
      <section className="section-padding bg-slate-50">
        <div className="section-container">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold text-center text-slate-900"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Pourquoi choisir <span className="text-brand-500">Resacolo</span> ?
          </motion.h2>

          <div className="mt-14 grid lg:grid-cols-2 gap-12 items-start">
            <motion.p
              className="text-lg sm:text-xl text-slate-600 leading-relaxed"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              Les organisateurs de colos réunis vous offrent leur savoir-faire pour{' '}
              <strong className="text-slate-900">faire grandir vos enfants</strong>.
            </motion.p>

            <div className="flex flex-col gap-5">
              {benefits.map((item, i) => (
                <motion.div
                  key={i}
                  className="resacolo-card flex items-start gap-4"
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                >
                  <div className="icon-box shrink-0">
                    <item.icon size={22} />
                  </div>
                  <p className="pt-0.5 text-slate-700 font-medium">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <OrganizersMarquee embedded />
          </div>
        </div>
      </section>

      {/* ── Thématiques ── */}
      <section id="thematiques" className="section-padding">
        <div className="section-container">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold text-center text-slate-900"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Choisir votre <span className="text-brand-500">thématique</span>
          </motion.h2>

          {/* Category pills */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {categories.map((cat) => {
              const isActive = activeTheme === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => setActiveTheme(cat.label)}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-accent-500 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Image */}
          <motion.div
            className="mt-10 flex justify-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="relative w-full max-w-2xl aspect-[3/2] overflow-hidden rounded-2xl bg-slate-100 shadow-md">
              <Image
                src={getMockImageUrl(mockImages.home.thematiques, 800, 80)}
                alt="Enfants en activité de colonie"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 672px"
              />
            </div>
          </motion.div>

          {/* Example camps */}
          <h3 className="mt-12 text-lg font-semibold text-center text-slate-900 font-display">
            Exemples de colos
          </h3>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTheme}
              className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {exampleCamps[activeTheme].map((camp, i) => (
                <div key={i} className="resacolo-card space-y-3">
                  <h4 className="font-bold text-slate-900">{camp.title}</h4>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} /> {camp.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> {camp.duration}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{camp.age}</span>
                    <span className="flex items-center gap-1 font-bold text-brand-500">
                      <Euro size={14} /> {camp.price}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="comment-ca-marche" className="section-padding bg-slate-50">
        <div className="section-container text-center">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold text-slate-900"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            RESACOLO, <span className="text-brand-500">comment ça marche ?</span>
          </motion.h2>

          <div className="mt-14 grid sm:grid-cols-3 gap-8">
            {processSteps.map((step, i) => (
              <motion.div
                key={i}
                className="resacolo-card flex flex-col items-center text-center gap-4"
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <div className="icon-box">
                  <step.icon size={22} />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="text-slate-500 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-accent-600 transition-colors"
            >
              En savoir plus
              <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Aides financières ── */}
      <section id="financement" className="section-padding relative overflow-hidden">
        <span
          className="watermark-euro top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          €
        </span>

        <div className="section-container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="block text-xs font-bold uppercase tracking-widest text-accent-500">
              COUP DE POUCE
            </span>
            <h2 className="font-display mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
              Des solutions pour financer votre séjour
            </h2>
          </motion.div>

          <div className="mt-12 grid lg:grid-cols-2 gap-12 items-start">
            <motion.p
              className="text-lg text-slate-600 leading-relaxed"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              De nombreux dispositifs existent pour obtenir des aides et minimiser le coût de votre séjour.
              Employeur, CAF, mairie, JPA, chèques-vacances… découvrez les partenaires et aides disponibles.
            </motion.p>

            <div className="grid sm:grid-cols-2 gap-4">
              {aids.map((aid, i) => (
                <motion.button
                  key={i}
                  className="resacolo-card flex items-center gap-3 text-left w-full cursor-pointer"
                  onClick={() => setOpenAidIdx(i)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="icon-box shrink-0">
                    <aid.icon size={20} />
                  </div>
                  <span className="font-semibold text-sm text-slate-800">{aid.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {openAidIdx !== null && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenAidIdx(null)}
            >
              <motion.div
                className="bg-white rounded-2xl p-8 max-w-md w-full relative shadow-2xl"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setOpenAidIdx(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
                <div className="icon-box mb-4">
                  {(() => {
                    const Icon = aids[openAidIdx].icon;
                    return <Icon size={22} />;
                  })()}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">{aids[openAidIdx].label}</h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{aids[openAidIdx].desc}</p>
                <Link
                  href="/contact"
                  onClick={() => setOpenAidIdx(null)}
                  className="mt-6 inline-flex items-center rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-600 transition-colors"
                >
                  Nous contacter
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="section-padding bg-slate-50">
        <div className="section-container max-w-xl mx-auto text-center">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold text-slate-900"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Contact
          </motion.h2>

          {submitted ? (
            <motion.div
              className="mt-10 resacolo-card flex flex-col items-center gap-4 py-12"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="icon-box">
                <CheckCircle size={28} />
              </div>
              <p className="text-lg font-semibold text-slate-900">Merci pour votre message !</p>
              <p className="text-sm text-slate-500">Nous vous répondrons dans les plus brefs délais.</p>
            </motion.div>
          ) : (
            <motion.form
              className="mt-10 space-y-5 text-left"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nom
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  placeholder="Votre nom"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  placeholder="votre@email.com"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition resize-none"
                  placeholder="Votre message…"
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-7 py-3 text-base font-semibold text-white shadow-md hover:bg-accent-600 transition-colors"
              >
                Envoyer
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </div>
      </section>
    </div>
  );
}

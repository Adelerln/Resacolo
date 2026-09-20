'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_CATEGORIES, type FaqCategoryId } from '@/lib/faq-content';

const BLUE = '#52B0EA';
/** Titres rubrique sous les cartes (maquette) */
const SECTION_TITLE_LEAD = '#4D4D4D';
const SECTION_TITLE_ACCENT = '#38B6FF';
const SECTION_INTRO = '#666666';

function AnswerBlock({ children }: { children: React.ReactNode }) {
  return <div className="text-sm leading-relaxed text-slate-600 sm:text-base">{children}</div>;
}

function FaqAnswer({ question, answer }: { question: string; answer: string }) {
  if (question.includes('politique de confidentialité')) {
    return (
      <AnswerBlock>
        Conformément aux dispositions légales, nous ne conservons vos données que dans le cadre de votre réservation.
        Voir plus de détails sur notre{' '}
        <Link href="/confidentialite" className="font-semibold text-brand-600 underline">
          page politique de confidentialité
        </Link>
        .
      </AnswerBlock>
    );
  }
  return <AnswerBlock>{answer}</AnswerBlock>;
}

export function FaqHubClient() {
  const [active, setActive] = useState<FaqCategoryId>(() => {
    if (typeof window === 'undefined') return 'inscription';
    const hash = window.location.hash.replace('#', '') as FaqCategoryId;
    return FAQ_CATEGORIES.some((category) => category.id === hash) ? hash : 'inscription';
  });

  const activeDef = FAQ_CATEGORIES.find((c) => c.id === active)!;

  const select = (id: FaqCategoryId) => {
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="relative">
      <section
        className="relative min-h-[min(60vh,500px)] overflow-hidden pb-20 pt-16 sm:min-h-[min(58vh,580px)] sm:pb-28 sm:pt-20 lg:min-h-[min(56vh,640px)] lg:pb-32 lg:pt-24"
        style={{ backgroundColor: BLUE }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%] max-w-2xl opacity-95 sm:w-[55%]">
          <Image
            src="/image/faq/pictos_faq/questions.png"
            alt=""
            width={480}
            height={480}
            className="absolute bottom-6 right-[max(1.25rem,10vw)] top-6 h-auto max-h-[min(52vh,300px)] w-auto max-w-[min(100%,300px)] translate-x-[-6%] translate-y-[-12px] object-contain object-bottom sm:right-[max(2rem,14vw)] sm:bottom-10 sm:top-4 sm:max-h-[min(48vh,340px)] sm:max-w-[min(100%,340px)] sm:translate-x-[-10%] sm:translate-y-[-16px] lg:right-[max(3rem,18vw)] lg:max-h-[min(44vh,360px)] lg:max-w-[min(100%,360px)] lg:translate-x-[-14%] lg:translate-y-[-20px]"
            priority
          />
        </div>

        <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 pb-6 pr-[clamp(1rem,min(42vw,20rem),22rem)] text-left text-white sm:px-6 sm:pb-10 sm:pr-[clamp(1.25rem,min(46vw,24rem),26rem)] lg:pr-[clamp(1.5rem,min(44vw,26rem),28rem)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90 sm:text-[13px]">Aide & conseils</p>
          <h1 className="font-display mt-4 text-5xl font-bold tracking-tight sm:mt-5 sm:text-6xl lg:text-7xl">FAQ</h1>
          <p className="mt-5 max-w-full text-justify text-base leading-relaxed text-white/95 sm:mt-6 sm:max-w-[42rem] sm:text-lg">
            Des interrogations ? Nous avons référencé diverses questions que vous pourriez vous poser. Prenez le temps
            de parcourir notre FAQ. Pour toute précision sur une colonie de vacances, merci d&apos;envoyer un mail à
            l&apos;organisateur du séjour via le formulaire de contact.
          </p>
        </div>
      </section>

      <div className="relative z-[2] -mt-12 px-4 sm:-mt-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {FAQ_CATEGORIES.map((cat) => {
            const selected = active === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => select(cat.id)}
                className={`origin-center cursor-pointer flex flex-col items-center rounded-2xl border bg-white px-3 py-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out will-change-transform hover:scale-[1.05] sm:py-8 ${
                  selected
                    ? 'border-transparent ring-2 ring-[#FA8500] ring-offset-2 ring-offset-white'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
                aria-pressed={selected}
              >
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Image
                    src={cat.cardPictoSrc}
                    alt={cat.cardPictoAlt || cat.cardTitle}
                    width={120}
                    height={120}
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="mt-4 text-sm font-bold leading-snug text-slate-800 sm:text-base">{cat.cardTitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section id="faq-content" className="scroll-mt-6 bg-white px-4 pb-16 pt-10 sm:px-6 sm:pt-14 md:pt-12">
        <div className="mx-auto max-w-3xl">
          <header className="mb-10 border-b border-slate-100 pb-10 text-center">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-[2.5rem] md:leading-snug">
              <span style={{ color: SECTION_TITLE_LEAD }}>{activeDef.sectionTitleLead}</span>
              <span style={{ color: SECTION_TITLE_ACCENT }}>{activeDef.sectionTitleAccent}</span>
            </h2>
            <p
              className="mx-auto mt-4 max-w-2xl text-sm font-normal leading-relaxed sm:mt-5 sm:text-base"
              style={{ color: SECTION_INTRO }}
            >
              {activeDef.sectionIntro}
            </p>
          </header>

          <div className="space-y-3">
            {activeDef.pairs.map((item, index) => (
              <details
                key={`${active}-${index}`}
                className="group rounded-xl border border-slate-200 bg-white shadow-sm open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <span className="text-left font-semibold text-slate-800">{item.question}</span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-slate-100 px-5 py-4">
                  <FaqAnswer question={item.question} answer={item.answer} />
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

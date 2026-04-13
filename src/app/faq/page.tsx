import Image from 'next/image';
import Link from 'next/link';
import { FaqHubClient } from '@/components/faq/FaqHubClient';

const ORANGE = '#FA8500';
const AVION_SRC = '/image/faq/pictos_faq/avion.png';

export const metadata = {
  title: 'FAQ | ResaColo',
  description:
    "Questions fréquentes sur le processus d'inscription, les tarifs, les données personnelles et les annulations."
};

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white">
      <FaqHubClient />

      <section className="relative overflow-hidden border-t border-slate-100 bg-[#F8F8F8] py-16 md:py-20">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={AVION_SRC}
            alt=""
            fill
            sizes="100vw"
            unoptimized
            className="object-cover object-left object-top opacity-[0.34] sm:opacity-[0.38] md:opacity-[0.42]"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F8F8F8]/45 via-[#F8F8F8]/62 to-[#F8F8F8]/82"
          aria-hidden
        />

        <div className="relative z-[1] ml-auto mr-6 flex w-full max-w-xl -translate-x-1 flex-col items-start px-5 pb-8 text-left sm:mr-10 sm:px-6 sm:pb-10 md:mr-14 md:max-w-2xl md:px-6 lg:mr-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Contactez-nous !</p>
          <h2 className="relative mt-3 w-full font-display text-2xl font-bold text-slate-800 sm:text-3xl">
            Envie d&apos;échanger sur votre projet de{' '}
            <span style={{ color: ORANGE }} className="font-bold">
              colonie de vacances
            </span>{' '}
            pour votre enfant ?
          </h2>
          <p className="mt-6 w-full text-justify text-sm leading-relaxed text-slate-600 sm:text-base">
            Pour toute question sur une de nos colonies de vacances, n&apos;hésitez pas à contacter l&apos;organisateur
            du séjour qui vous intéresse. Chaque colonie de vacances est gérée par un organisateur spécifique, expert
            dans son domaine, et prêt à vous fournir des informations détaillées et adaptées à vos besoins.
          </p>
          <div className="mt-8 flex w-full justify-start">
            <Link
              href="/contact"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-accent-500 px-8 py-4 font-semibold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-accent-600 sm:w-auto"
            >
              Contactez un des organisateurs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

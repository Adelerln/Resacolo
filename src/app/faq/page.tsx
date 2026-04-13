import Image from 'next/image';
import Link from 'next/link';
import { FaqHubClient } from '@/components/faq/FaqHubClient';

const ORANGE = '#FA8500';

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
            src="/image/faq/pictos_faq/avion.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[75%_center] sm:object-[65%_center] md:object-center"
            quality={90}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F8F8F8]/78 via-[#F8F8F8]/62 to-[#F8F8F8]/80"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto flex w-full max-w-3xl flex-col items-center pl-8 pr-4 text-center sm:pl-12 sm:pr-6 md:pl-16 md:pr-8 lg:pl-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Contactez-nous !</p>
          <h2 className="relative mt-3 font-display text-2xl font-bold text-slate-800 sm:text-3xl">
            Envie d&apos;échanger sur votre projet de{' '}
            <span style={{ color: ORANGE }} className="font-bold">
              colonie de vacances
            </span>{' '}
            pour votre enfant ?
          </h2>
          <p className="mt-6 max-w-xl text-justify text-sm leading-relaxed text-slate-600 sm:text-base">
            Pour toute question sur une de nos colonies de vacances, n&apos;hésitez pas à contacter l&apos;organisateur
            du séjour qui vous intéresse. Chaque colonie de vacances est gérée par un organisateur spécifique, expert
            dans son domaine, et prêt à vous fournir des informations détaillées et adaptées à vos besoins.
          </p>
          <div className="mt-8 flex w-full max-w-xl justify-center">
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

import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

const MAP_BLEU = '/image/sejours/pictos_fichesejour/map-bleu.png';

export type OrganizerStayPreviewCardProps = {
  title: string;
  summary: string | null;
  description: string | null;
  locationLabel: string;
  ageRangeLabel: string;
  seasonIconSrc: string;
  seasonBadge: string;
  durationLabel: string;
  priceFromEuros: number | null;
  coverUrl: string | null;
  href: string;
  organizerLogoUrl: string | null;
  organizerName: string;
  overlayAction?: ReactNode;
};

export function OrganizerStayPreviewCard({
  title,
  summary,
  description,
  locationLabel,
  ageRangeLabel,
  seasonIconSrc,
  seasonBadge,
  durationLabel,
  priceFromEuros,
  coverUrl,
  href,
  organizerLogoUrl,
  organizerName,
  overlayAction
}: OrganizerStayPreviewCardProps) {
  const body =
    description?.trim() || summary?.trim() || 'Présentation du séjour à venir.';
  const subtitle = summary?.trim() && summary.trim() !== title.trim() ? summary.trim() : null;
  const metaTextClass = 'text-xs font-semibold leading-snug text-black';

  return (
    <article className="flex h-full w-full max-w-[320px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
      <div className="relative h-52 shrink-0 bg-slate-100">
        {overlayAction ? <div className="absolute left-3 top-3 z-10">{overlayAction}</div> : null}
        <Link href={href} className="relative block h-full w-full">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              fill
              sizes="320px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <MapPin className="h-10 w-10" aria-hidden />
            </div>
          )}
          {organizerLogoUrl ? (
            <div className="absolute right-3 top-3 h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
              <Image
                src={organizerLogoUrl}
                alt={organizerName}
                width={44}
                height={44}
                sizes="44px"
                className="h-full w-full object-contain p-1"
              />
            </div>
          ) : null}
          <span className="absolute bottom-3 left-3 rounded-full bg-[#FA8500] px-3 py-1 text-xs font-bold text-white shadow-sm">
            {ageRangeLabel}
          </span>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#FA8500] shadow-sm">
            <Image
              src={seasonIconSrc}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
            />
            <span>{seasonBadge}</span>
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-2">
        <span className={`flex min-w-0 items-start gap-2 ${metaTextClass}`}>
          <Image
            src={MAP_BLEU}
            alt=""
            width={24}
            height={24}
            className="mt-0.5 h-5 w-5 shrink-0 object-contain"
          />
          <span className="min-w-0 break-words line-clamp-3">{locationLabel}</span>
        </span>
        <span className={`flex min-w-0 items-center justify-end gap-2 text-right ${metaTextClass}`}>
          <Image
            src="/image/sejours/pictos_duree/duree.png"
            alt=""
            width={24}
            height={24}
            className="h-5 w-5 shrink-0 object-contain"
          />
          <span className="min-w-0">{durationLabel}</span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-0 pt-2 text-center">
        <h3 className="text-lg font-bold leading-snug text-[#505050]">{title}</h3>
        {subtitle ? (
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-[#505050]">{subtitle}</p>
        ) : null}
        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-6 text-slate-600">{body}</p>
        <p className="mt-4 shrink-0 text-base font-semibold text-slate-600">
          {priceFromEuros != null ? (
            <>
              À partir de{' '}
              <span className="text-xl font-bold text-[#FA8500]">
                {priceFromEuros.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                €
              </span>
            </>
          ) : (
            <span className="text-lg font-bold text-[#FA8500]">Sur demande</span>
          )}
        </p>
      </div>

      <Link
        href={href}
        className="mt-auto flex w-full shrink-0 items-center justify-center rounded-b-[26px] bg-[#6DC7FE] px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#52B0EA]"
      >
        DÉCOUVRIR LE SÉJOUR
      </Link>
    </article>
  );
}

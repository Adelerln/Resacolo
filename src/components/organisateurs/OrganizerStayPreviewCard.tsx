import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';

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
  partnerPriceFromEuros?: number | null;
  partnerDiscountPercent?: number | null;
  partnerFinanceMode?: string | null;
  partnerFinancePercentValue?: number | null;
  partnerFinanceFixedCents?: number | null;
  csePriceFromEuros?: number | null;
  cseAidFromEuros?: number | null;
  cseLabel?: string | null;
  coverUrl: string | null;
  href: string;
  organizerLogoUrl: string | null;
  organizerName: string;
  overlayAction?: ReactNode;
  disableBlueHoverEffect?: boolean;
  compact?: boolean;
  liftOnHover?: boolean;
  /** Aucune session ouverte : affiche « Complet » au lieu du CTA catalogue. */
  isFullyBooked?: boolean;
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
  partnerPriceFromEuros = null,
  partnerDiscountPercent = null,
  partnerFinanceMode = null,
  partnerFinancePercentValue = null,
  partnerFinanceFixedCents = null,
  csePriceFromEuros = null,
  cseAidFromEuros = null,
  cseLabel = null,
  coverUrl,
  href,
  organizerLogoUrl,
  organizerName,
  overlayAction,
  disableBlueHoverEffect = false,
  compact = false,
  liftOnHover = false,
  isFullyBooked = false
}: OrganizerStayPreviewCardProps) {
  const body = description?.trim() || summary?.trim() || 'Présentation du séjour à venir.';
  const normalizedTitle = title.trim();
  const normalizedSummary = summary?.trim() || null;
  const normalizedDescription = description?.trim() || null;
  const subtitle = normalizedSummary && normalizedSummary !== normalizedTitle ? normalizedSummary : null;
  const teaser =
    normalizedDescription && normalizedDescription !== normalizedTitle && normalizedDescription !== subtitle
      ? normalizedDescription
      : !subtitle && body.trim() !== normalizedTitle
        ? body
        : null;
  const hasPartnerPrice =
    partnerPriceFromEuros != null &&
    priceFromEuros != null &&
    partnerPriceFromEuros < priceFromEuros;
  const hasLegacyCsePrice = !hasPartnerPrice && csePriceFromEuros != null;
  const pricePillLabel =
    hasPartnerPrice && partnerDiscountPercent != null
      ? `-${Math.round(partnerDiscountPercent)}%`
      : null;
  const hoverEnabled = !disableBlueHoverEffect;
  const groupEnabled = hoverEnabled || liftOnHover;
  const articleClass = `${groupEnabled ? 'group ' : ''}flex h-full w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] ${compact ? `${hasPartnerPrice ? 'min-h-[522px]' : 'min-h-[492px]'} max-w-[304px] rounded-[24px]` : `${hasPartnerPrice ? 'min-h-[548px]' : 'min-h-[516px]'} max-w-[320px] rounded-[28px]`} ${liftOnHover ? 'transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-28px_rgba(15,23,42,0.42)]' : ''}`;
  const agePillClass = `absolute bottom-0 left-0 z-20 inline-flex translate-y-[42%] items-center rounded-r-2xl bg-[#FA8500] font-bold text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.45)] ${compact ? 'min-h-8 px-3.5 py-1.5 text-[11px]' : 'min-h-9 px-4 py-2 text-xs'}`;
  const seasonPillClass = hoverEnabled
    ? `absolute bottom-0 right-0 z-20 inline-flex translate-y-[42%] items-center gap-1.5 rounded-l-2xl bg-white font-bold uppercase tracking-[0.06em] text-[#FA8500] shadow-[0_14px_28px_-18px_rgba(15,23,42,0.45)] transition-colors group-hover:text-[#37B5F5] ${compact ? 'min-h-8 px-3 py-1.5 text-[11px]' : 'min-h-9 px-3.5 py-2 text-xs'}`
    : `absolute bottom-0 right-0 z-20 inline-flex translate-y-[42%] items-center gap-1.5 rounded-l-2xl bg-white font-bold uppercase tracking-[0.06em] text-[#FA8500] shadow-[0_14px_28px_-18px_rgba(15,23,42,0.45)] ${compact ? 'min-h-8 px-3 py-1.5 text-[11px]' : 'min-h-9 px-3.5 py-2 text-xs'}`;
  const contentClass = hoverEnabled ? 'card-blue-vertical-sweep flex min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col';
  const metaTextClass = hoverEnabled
    ? `${compact ? 'text-[11px]' : 'text-xs'} font-normal leading-snug text-slate-600 transition-colors group-hover:text-white`
    : `${compact ? 'text-[11px]' : 'text-xs'} font-normal leading-snug text-slate-600`;
  const locationSlotClass = compact ? 'min-h-[2.2rem]' : 'min-h-[2.6rem]';
  const headingClass = hoverEnabled
    ? `${compact ? 'line-clamp-2 text-[0.98rem] leading-[1.28]' : 'text-lg leading-snug'} font-bold text-[#505050] transition-colors group-hover:text-white`
    : `${compact ? 'line-clamp-2 text-[0.98rem] leading-[1.28]' : 'text-lg leading-snug'} font-bold text-[#505050]`;
  const titleSlotClass = compact ? 'min-h-[2.55rem]' : '';
  const subtitleSlotClass = compact ? 'mt-1.5 min-h-[2.05rem]' : subtitle ? 'mt-2' : '';
  const subtitleClass = hoverEnabled
    ? `${compact ? 'line-clamp-2 text-[0.76rem] leading-[1.35]' : 'text-sm leading-snug'} font-semibold text-[#505050] transition-colors group-hover:text-white`
    : `${compact ? 'line-clamp-2 text-[0.76rem] leading-[1.35]' : 'text-sm leading-snug'} font-semibold text-[#505050]`;
  const teaserSlotClass = compact ? 'mt-2 min-h-[3.2rem]' : 'mt-2.5 min-h-[4.25rem]';
  const teaserClass = hoverEnabled
    ? `${compact ? 'text-[0.72rem] leading-[1.45]' : 'text-sm'} line-clamp-3 font-normal text-slate-600 transition-colors group-hover:text-white/95`
    : `${compact ? 'text-[0.72rem] leading-[1.45]' : 'text-sm'} line-clamp-3 font-normal text-slate-600`;
  const priceLineClass = hoverEnabled
    ? `${compact ? 'mt-3 text-sm' : 'mt-4 text-base'} shrink-0 font-semibold text-slate-600 transition-colors group-hover:text-white`
    : `${compact ? 'mt-3 text-sm' : 'mt-4 text-base'} shrink-0 font-semibold text-slate-600`;
  const priceValueClass = hoverEnabled
    ? `${compact ? 'text-lg' : 'text-xl'} font-bold text-[#FA8500] transition-colors group-hover:text-white`
    : `${compact ? 'text-lg' : 'text-xl'} font-bold text-[#FA8500]`;
  const onRequestClass = hoverEnabled
    ? `${compact ? 'text-base' : 'text-lg'} font-bold text-[#FA8500] transition-colors group-hover:text-white`
    : `${compact ? 'text-base' : 'text-lg'} font-bold text-[#FA8500]`;
  const publicPriceClass = hoverEnabled
    ? `${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-400 line-through transition-colors group-hover:text-white/70`
    : `${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-400 line-through`;
  const partnerPriceRowClass = hoverEnabled
    ? 'mt-1 flex items-center justify-center gap-2 transition-colors group-hover:text-white'
    : 'mt-1 flex items-center justify-center gap-2';
  const partnerBadgeClass = hoverEnabled
    ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 transition-colors group-hover:bg-white group-hover:text-accent-700'
    : 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800';
  const helperLineClass = hoverEnabled
    ? 'mt-1 text-[11px] font-semibold text-emerald-700 transition-colors group-hover:text-white/85'
    : 'mt-1 text-[11px] font-semibold text-emerald-700';
  const ctaClass = `mt-auto flex w-full shrink-0 items-center justify-center border-t border-white/15 bg-[linear-gradient(151deg,var(--color-primary)_38%,#52b0ea_100%)] px-4 ${compact ? 'py-3 text-[12px]' : 'py-3.5 text-sm'} font-bold uppercase tracking-wide text-white transition-opacity ${hoverEnabled ? 'group-hover:opacity-95' : ''}`;
  const fullCtaClass = `mt-auto flex w-full shrink-0 items-center justify-center border-t border-slate-200 bg-white px-4 ${compact ? 'py-3 text-[12px]' : 'py-3.5 text-sm'} font-bold uppercase tracking-wide text-[#FA8500]`;
  const normalizedFinanceMode = partnerFinanceMode ? normalizePartnerFinanceMode(partnerFinanceMode) : null;
  const financeHelperText =
    normalizedFinanceMode === 'TOTAL'
      ? 'Tarif partenaire · prise en charge totale'
      : normalizedFinanceMode === 'PERCENT' && typeof partnerFinancePercentValue === 'number'
        ? `Tarif partenaire · ${partnerFinancePercentValue.toLocaleString('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          })} % pris en charge`
        : normalizedFinanceMode === 'FIXED' && typeof partnerFinanceFixedCents === 'number'
          ? `Tarif partenaire · jusqu'à ${(partnerFinanceFixedCents / 100).toLocaleString('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} € pris en charge`
            : normalizedFinanceMode === 'MANUAL'
              ? 'Tarif affiché · demande de devis'
            : 'Tarif partenaire';

  return (
    <article className={articleClass}>
      <div className={`relative z-10 shrink-0 bg-slate-100 ${compact ? 'h-48 rounded-t-[24px]' : 'h-52 rounded-t-[28px]'}`}>
        {overlayAction ? <div className="absolute left-3 top-3 z-10">{overlayAction}</div> : null}
        <Link href={href} className="relative block h-full w-full">
          <div className={`absolute inset-0 overflow-hidden bg-slate-100 ${compact ? 'rounded-t-[24px]' : 'rounded-t-[28px]'}`}>
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={title}
                fill
                sizes={compact ? '304px' : '320px'}
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <MapPin className="h-10 w-10" aria-hidden />
              </div>
            )}
            {organizerLogoUrl ? (
            <div
              className={`absolute right-3 top-3 overflow-hidden border-2 border-white bg-white shadow-md ${compact ? 'h-14 w-14 rounded-2xl' : 'h-16 w-16 rounded-[22px]'}`}
            >
                <Image
                  src={organizerLogoUrl}
                  alt={organizerName}
                  width={compact ? 56 : 64}
                  height={compact ? 56 : 64}
                  sizes={compact ? '56px' : '64px'}
                className="h-full w-full object-contain p-1.5"
                />
              </div>
            ) : null}
          </div>
          <div className="relative h-full w-full">
            <span className={agePillClass}>{ageRangeLabel}</span>
            <span className={seasonPillClass}>
              <Image
                src={seasonIconSrc}
                alt=""
                width={20}
                height={20}
                className="h-4.5 w-4.5 shrink-0 object-contain"
              />
              <span>{seasonBadge}</span>
            </span>
          </div>
        </Link>
      </div>

      <Link
        href={href}
        className={`${contentClass} no-underline`}
        aria-label={isFullyBooked ? `Fiche du séjour ${title} (complet)` : `Découvrir le séjour ${title}`}
      >
        <div className={`grid grid-cols-2 items-center gap-2 ${compact ? 'px-3.5 pb-0.5 pt-[0.75rem]' : 'px-4 pb-1 pt-[0.85rem]'}`}>
          <span className={`flex min-w-0 items-center gap-2 ${metaTextClass} ${locationSlotClass}`}>
            <Image
              src={MAP_BLEU}
              alt=""
              width={24}
              height={24}
              className="h-4 w-4 shrink-0 object-contain"
            />
            <span className="min-w-0 break-words line-clamp-2">{locationLabel}</span>
          </span>
          <span className={`flex min-w-0 items-center justify-end gap-2 text-right ${metaTextClass}`}>
            <Image
              src="/image/sejours/pictos_duree/duree.png"
              alt=""
              width={24}
              height={24}
              className="h-4 w-4 shrink-0 object-contain"
            />
            <span className="min-w-0">{durationLabel}</span>
          </span>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col text-center ${compact ? 'px-3.5 pb-3 pt-2.5' : 'px-4 pb-3.5 pt-3'}`}>
          <div className={titleSlotClass}>
            <h3 className={headingClass}>{title}</h3>
          </div>
          <div className={subtitleSlotClass}>
            {subtitle ? (
              <p className={subtitleClass}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className={teaserSlotClass}>
            <p className={teaserClass}>{teaser ?? '\u00A0'}</p>
          </div>
          {hasPartnerPrice ? (
            <div className={`${compact ? 'mt-3' : 'mt-4'} shrink-0`}>
              <p className={publicPriceClass}>
                {priceFromEuros?.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                €
              </p>
              <div className={partnerPriceRowClass}>
                <span className={priceValueClass}>
                  {partnerPriceFromEuros.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                  €
                </span>
                {pricePillLabel ? <span className={partnerBadgeClass}>{pricePillLabel}</span> : null}
              </div>
              <p className={helperLineClass}>{financeHelperText}</p>
            </div>
          ) : (
            <>
              <p className={priceLineClass}>
                {hasLegacyCsePrice ? (
                  <>
                    À partir de{' '}
                    <span className={priceValueClass}>
                      {csePriceFromEuros.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                      €
                    </span>
                    {priceFromEuros != null ? (
                      <span className="ml-2 text-xs font-medium text-slate-500 line-through">
                        {priceFromEuros.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                        €
                      </span>
                    ) : null}
                  </>
                ) : priceFromEuros != null ? (
                  <>
                    À partir de{' '}
                    <span className={priceValueClass}>
                      {priceFromEuros.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                      €
                    </span>
                  </>
                ) : (
                  <span className={onRequestClass}>
                    Sur demande
                  </span>
                )}
              </p>
              {hasLegacyCsePrice ? (
                <p className={helperLineClass}>
                  {cseLabel ?? 'Déduction CSE estimée'}
                  {cseAidFromEuros != null ? ` · Aide dès ${cseAidFromEuros.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}€` : ''}
                </p>
              ) : null}
            </>
          )}
        </div>

        {isFullyBooked ? (
          <span className={fullCtaClass}>Complet</span>
        ) : (
          <span className={ctaClass}>DÉCOUVRIR LE SÉJOUR</span>
        )}
      </Link>
    </article>
  );
}

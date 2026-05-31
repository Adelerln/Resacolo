'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'lucide-react';
import { FavoriteToggleButton } from '@/components/favorites/FavoriteToggleButton';
import type { Stay, StayInsuranceOption, StaySessionOption, StayTransportOption } from '@/types/stay';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { useCart } from '@/context/CartContext';
import { formatSessionDateRangeFr } from '@/lib/cart/formatSessionRange';
import { createCartItemFromStay } from '@/lib/cart/normalizeCartItem';
import { FILTER_LABELS } from '@/lib/constants';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import { getSessionDisplayedBasePrice, getStayDisplayedPrice } from '@/lib/stay-partner-pricing';
import { computePartnerFinanceDisplay, normalizePartnerFinanceMode } from '@/lib/partner-offers';
import StayLocationMap from '@/components/sejours/StayLocationMap';
import { buildStayIntroText } from '@/lib/stay-seo';
import { slugify } from '@/lib/utils';

type TabId = 'sejour' | 'hebergement' | 'infos';
type DiscoveryButton =
  | { label: string; type: 'search'; q: string }
  | {
      label: string;
      type: 'filters';
      filters: {
        season?: string[];
        ageMin?: number;
        ageMax?: number;
      };
    };

const STAY_IMAGE_DISPLAY_QUALITY = 92;
const STAY_IMAGE_REQUEST_WIDTH = 2200;

function getHighQualityImageUrl(imageUrl: string, targetWidth = STAY_IMAGE_REQUEST_WIDTH) {
  const trimmed = imageUrl.trim();
  if (!trimmed || trimmed.startsWith('/')) return trimmed;

  try {
    const url = new URL(trimmed);
    const isUnsplash = url.hostname === 'images.unsplash.com';
    const widthKeys = ['w', 'width'] as const;
    const qualityKeys = ['q', 'quality'] as const;
    let hasWidthParam = false;
    let hasQualityParam = false;

    for (const key of widthKeys) {
      if (!url.searchParams.has(key)) continue;
      hasWidthParam = true;
      const currentWidth = Number(url.searchParams.get(key));
      if (!Number.isFinite(currentWidth) || currentWidth < targetWidth) {
        url.searchParams.set(key, String(targetWidth));
      }
    }

    for (const key of qualityKeys) {
      if (!url.searchParams.has(key)) continue;
      hasQualityParam = true;
      const currentQuality = Number(url.searchParams.get(key));
      if (!Number.isFinite(currentQuality) || currentQuality < STAY_IMAGE_DISPLAY_QUALITY) {
        url.searchParams.set(key, String(STAY_IMAGE_DISPLAY_QUALITY));
      }
    }

    if (isUnsplash) {
      if (!hasWidthParam) {
        url.searchParams.set('w', String(targetWidth));
      }
      if (!hasQualityParam) {
        url.searchParams.set('q', String(STAY_IMAGE_DISPLAY_QUALITY));
      }
      url.searchParams.set('auto', 'format');
      if (!url.searchParams.has('fit')) {
        url.searchParams.set('fit', 'max');
      }
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

function formatLabel(group: keyof typeof FILTER_LABELS, value: string) {
  return FILTER_LABELS[group][value as keyof (typeof FILTER_LABELS)[typeof group]] ?? value;
}

function formatPrice(price?: number | null) {
  if (price == null) return 'Sur demande';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

function formatSessionLabel(session: StaySessionOption) {
  const start = new Date(session.startDate).toLocaleDateString('fr-FR');
  const end = new Date(session.endDate).toLocaleDateString('fr-FR');
  const status = session.status === 'FULL' ? ' (COMPLET)' : '';
  const price =
    session.partnerDiscountedPrice != null
      ? ` · ${formatPrice(session.partnerDiscountedPrice)}`
      : session.familyCentsAfterAid != null
      ? ` · ${formatPrice(session.familyCentsAfterAid / 100)} (après CSE)`
      : session.price != null
        ? ` · ${formatPrice(session.price)}`
        : '';
  return `${start} - ${end}${status}${price}`;
}

function computeDisplayedTotal(input: {
  basePrice: number | null;
  transportAmount: number;
  extraOptionAmount: number;
  insuranceOption: StayInsuranceOption | null;
}) {
  if (input.basePrice == null) return null;

  let total = input.basePrice;
  total += input.transportAmount;
  total += input.extraOptionAmount;

  if (input.insuranceOption?.amount != null) {
    total += input.insuranceOption.amount;
  } else if (input.insuranceOption?.percentValue != null) {
    total += (input.basePrice * input.insuranceOption.percentValue) / 100;
  }

  return Math.round(total * 100) / 100;
}

function formatTransportLabel(option: StayTransportOption, displayAmount?: number) {
  const normalizedDeparture = normalizeTransportCityDisplay(option.departureCity);
  const normalizedReturn = normalizeTransportCityDisplay(option.returnCity);
  const cities = [normalizedDeparture, normalizedReturn].filter(Boolean);
  const route =
    cities.length === 0
      ? 'Transport'
      : cities.length === 1 || normalizedDeparture === normalizedReturn
        ? cities[0]
        : `${normalizedDeparture} / ${normalizedReturn}`;
  const amount = displayAmount ?? option.amount;
  return `${route} · ${formatPrice(amount)}`;
}

function normalizeTransportCityDisplay(value: string | null | undefined) {
  const clean = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return '';

  const parts = clean
    .split(/\s*(?:→|->)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return clean;

  const uniqueParts = Array.from(new Set(parts.map((part) => part.toUpperCase().replace(/\s+/g, ' '))));
  if (uniqueParts.length === 1) return parts[0];
  return clean;
}

function formatInsuranceLabel(option: StayInsuranceOption) {
  if (option.amount != null) {
    return `${option.label} · ${formatPrice(option.amount)}`;
  }
  if (option.percentValue != null) {
    return `${option.label} · ${option.percentValue}%`;
  }
  return option.label;
}

function getUniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeDiscoveryText(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toDiscoveryButton(anchor: string): DiscoveryButton {
  const normalized = normalizeDiscoveryText(anchor);

  if (normalized.includes('colonies de vacances ete')) {
    return {
      label: anchor,
      type: 'filters',
      filters: {
        season: ['Été']
      }
    };
  }

  if (normalized.includes('sejours pour 7-13 ans') || normalized.includes('sejour pour 7-13 ans')) {
    return {
      label: anchor,
      type: 'filters',
      filters: {
        ageMin: 7,
        ageMax: 13
      }
    };
  }

  return {
    label: anchor,
    type: 'search',
    q: anchor
  };
}

function handleDiscoveryClick(item: DiscoveryButton) {
  const params = new URLSearchParams();

  if (item.type === 'search') {
    params.set('q', item.q);
    return `/sejours?${params.toString()}`;
  }

  if (item.filters.season && item.filters.season.length > 0) {
    params.set('season', item.filters.season.join(','));
  }
  if (typeof item.filters.ageMin === 'number') {
    params.set('ageMin', String(item.filters.ageMin));
  }
  if (typeof item.filters.ageMax === 'number') {
    params.set('ageMax', String(item.filters.ageMax));
  }

  return params.toString() ? `/sejours?${params.toString()}` : '/sejours';
}

function formatFrenchList(values: string[]) {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} et ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} et ${values[values.length - 1]}`;
}

function isCenterTransportLabel(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!normalized) return false;
  return (
    normalized.includes('centre') ||
    normalized.includes('sur place') ||
    normalized.includes('rdv sur place') ||
    normalized.includes('rendez vous sur place') ||
    normalized.includes('sans transport') ||
    normalized.includes('sans acheminement')
  );
}

function sanitizeTransportDisplayText(value: string) {
  if (!value) return '';
  return value
    .replace(/Le séjour propose un départ et un retour depuis plusieurs villes[^.]*\.\s*/i, '')
    .replace(/Le séjour propose un départ depuis plusieurs villes[^.]*\.\s*/i, '')
    .replace(/Les modalités de retour sont différenciées selon les villes proposées\.\s*/i, '')
    .replace(/Il est aussi possible d'arriver directement sur le centre\.\s*/i, '')
    .trim();
}

function getCategoryPictoSrc(category: Stay['categories'][number]) {
  switch (category) {
    case 'mer':
      return '/image/sejours/pictos_sejours/mer.png';
    case 'montagne':
      return '/image/sejours/pictos_sejours/montagnes.png';
    case 'campagne':
      return '/image/sejours/pictos_sejours/campagne.png';
    case 'artistique':
      return '/image/sejours/pictos_sejours/artistique.png';
    case 'equestre':
      return '/image/sejours/pictos_sejours/equestre.png';
    case 'linguistique':
      return '/image/sejours/pictos_sejours/linguistique.png';
    case 'scientifique':
      return '/image/sejours/pictos_sejours/scientifique.png';
    case 'sportif':
      return '/image/sejours/pictos_sejours/sport.png';
    case 'itinerant':
      return '/image/sejours/pictos_sejours/itinerant.png';
    case 'etranger':
      return '/image/sejours/pictos_sejours/etranger.png';
  }
}

function getOrganizerHref(stay: Stay) {
  const organizerSlug = stay.organizer.slug?.trim() || slugify(stay.organizer.name);
  return organizerSlug ? `/organisateurs/${organizerSlug}` : '/organisateurs';
}

function getVideoEmbedConfig(url: string) {
  const normalized = url.trim();
  if (!normalized) return null;

  if (/\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(normalized)) {
    return { type: 'native' as const, src: normalized };
  }

  const youtubeMatch =
    normalized.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i) ??
    normalized.match(/[?&]v=([A-Za-z0-9_-]{6,})/i) ??
    normalized.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
  if (youtubeMatch?.[1]) {
    return {
      type: 'iframe' as const,
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}`
    };
  }

  const vimeoMatch =
    normalized.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch?.[1]) {
    return {
      type: 'iframe' as const,
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`
    };
  }

  return { type: 'link' as const, src: normalized };
}

function ScrollablePhotoGallery({
  title,
  imageUrls
}: {
  title: string;
  imageUrls: string[];
}) {
  if (imageUrls.length === 0) return null;
  const displayImageUrls = imageUrls.map((src) => getHighQualityImageUrl(src));

  return (
    <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
      {displayImageUrls.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className="group relative block aspect-[4/3] w-[11rem] shrink-0 snap-start overflow-hidden rounded-[20px] bg-slate-100 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] sm:w-[13rem] lg:w-[15rem]"
        >
          <Image
            src={src}
            alt={`${title} ${index + 1}`}
            fill
            loading={index === 0 ? 'eager' : 'lazy'}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 11rem, (max-width: 1024px) 13rem, 15rem"
            quality={STAY_IMAGE_DISPLAY_QUALITY}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/22 via-transparent to-transparent" />
        </div>
      ))}
    </div>
  );
}

// Build a simple programme from description (split by double newline or "Jour")
function getProgrammeBlocks(description: string): { title?: string; text: string }[] {
  const trimmed = description.trim();
  if (!trimmed) return [];
  const byDay = trimmed.split(/(?=Jour \d+)/i).filter(Boolean);
  if (byDay.length > 1) {
    return byDay.map((block) => {
      const match = block.match(/^(Jour \d+[^\n]*)\n?([\s\S]*)$/i);
      if (match) return { title: match[1].trim(), text: match[2].trim() };
      return { text: block.trim() };
    });
  }
  return [{ text: trimmed }];
}

function normalizeRawText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter(Boolean)
      .join('\n');
  }
  if (value == null) return '';
  return String(value).trim();
}

function cleanEditorialText(value: string) {
  if (!value) return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[’‘`´ʼʹʻ]/g, "'")
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€“|â€”/g, '-')
    .replace(/â€¦/g, '...')
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])[§^]([A-Za-zÀ-ÖØ-öø-ÿ])/g, "$1'$2")
    .replace(/[§^]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])([^\s\n])/g, '$1 $2')
    .trim();
}

function normalizeEditorialText(value: unknown) {
  return cleanEditorialText(normalizeRawText(value));
}

function getRawField(raw: Record<string, unknown> | undefined, keys: string[]) {
  if (!raw) return '';
  for (const key of keys) {
    if (key in raw) {
      const value = normalizeEditorialText(raw[key]);
      if (value) return value;
    }
  }
  return '';
}

function pickFirstEditorialText(values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeEditorialText(value);
    if (normalized) return normalized;
  }
  return '';
}

function splitEditorialParagraphs(value: string): string[] {
  const normalized = normalizeEditorialText(value);
  if (!normalized) return [];

  const explicitParagraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const sourceParagraphs =
    explicitParagraphs.length > 1
      ? explicitParagraphs
      : normalized
          .split(/\n+/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);

  return sourceParagraphs.flatMap((paragraph) => {
    if (paragraph.length <= 280) return [paragraph];

    const sentences =
      paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];

    if (sentences.length <= 1) return [paragraph];

    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (current && next.length > 280) {
        chunks.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  });
}

function EditorialParagraphs({
  text,
  emptyText = 'Informations à venir.',
  className = 'text-sm leading-relaxed text-slate-600'
}: {
  text: string;
  emptyText?: string;
  className?: string;
}) {
  const paragraphs = splitEditorialParagraphs(text);

  if (paragraphs.length === 0) {
    return <p className={className}>{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className={className}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function capitalizeFirstLetter(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function capitalizeHeadingSegments(value: string) {
  if (!value) return value;
  return value
    .split(/(\s*[-|/]\s*)/g)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment.replace(/^(\s*)(\S)/, (_, prefix: string, firstChar: string) => {
        return `${prefix}${firstChar.toUpperCase()}`;
      });
    })
    .join('');
}

const DEFAULT_GALLERY = [
  getMockImageUrl(mockImages.sejours.gallery[0], 1600, 90),
  getMockImageUrl(mockImages.sejours.gallery[1], 1600, 90),
  getMockImageUrl(mockImages.sejours.gallery[2], 1600, 90)
];
const VISIT_TRACKING_DEDUP_MS = 60_000;

export function StayDetailView({ stay }: { stay: Stay }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [activeTab, setActiveTab] = useState<TabId>('sejour');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedTransportId, setSelectedTransportId] = useState('');
  const [selectedDepartureCity, setSelectedDepartureCity] = useState('');
  const [selectedReturnCity, setSelectedReturnCity] = useState('');
  const [selectedInsuranceId, setSelectedInsuranceId] = useState('');
  const [selectedExtraOptionId, setSelectedExtraOptionId] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const bookingOptions = stay.bookingOptions;
  const availableSessions = useMemo(() => bookingOptions?.sessions ?? [], [bookingOptions]);
  const transportMode = bookingOptions?.transportMode ?? 'Sans transport';
  const insuranceOptions = useMemo(() => bookingOptions?.insuranceOptions ?? [], [bookingOptions]);
  const extraOptions = useMemo(() => bookingOptions?.extraOptions ?? [], [bookingOptions]);
  const hasSessions = availableSessions.length > 0;
  const openSessions = useMemo(
    () => availableSessions.filter((sessionItem) => sessionItem.status === 'OPEN'),
    [availableSessions]
  );
  const hasOpenSessions = openSessions.length > 0;
  const selectedSession = useMemo(
    () => availableSessions.find((sessionItem) => sessionItem.id === selectedSessionId) ?? null,
    [availableSessions, selectedSessionId]
  );
  const sessionTransportOptions = useMemo(
    () => selectedSession?.transportOptions ?? [],
    [selectedSession]
  );
  const isDifferentiatedTransport = transportMode === 'Aller/Retour différencié';
  const departureTransportOptions = useMemo(
    () => sessionTransportOptions.filter((option) => option.departureCity.trim()),
    [sessionTransportOptions]
  );
  const returnTransportOptions = useMemo(
    () => sessionTransportOptions.filter((option) => option.returnCity.trim()),
    [sessionTransportOptions]
  );
  const departureCities = useMemo(
    () => getUniqueStrings(departureTransportOptions.map((option) => option.departureCity)),
    [departureTransportOptions]
  );
  const returnCities = useMemo(
    () => getUniqueStrings(returnTransportOptions.map((option) => option.returnCity)),
    [returnTransportOptions]
  );
  const selectedTransportOption = useMemo(() => {
    if (transportMode === 'Sans transport' || isDifferentiatedTransport) return null;
    return sessionTransportOptions.find((option) => option.id === selectedTransportId) ?? null;
  }, [isDifferentiatedTransport, selectedTransportId, sessionTransportOptions, transportMode]);
  const selectedDepartureTransportOption = useMemo(() => {
    if (!isDifferentiatedTransport) return null;
    return (
      departureTransportOptions.find((option) => option.departureCity === selectedDepartureCity) ?? null
    );
  }, [departureTransportOptions, isDifferentiatedTransport, selectedDepartureCity]);
  const selectedReturnTransportOption = useMemo(() => {
    if (!isDifferentiatedTransport) return null;
    return returnTransportOptions.find((option) => option.returnCity === selectedReturnCity) ?? null;
  }, [isDifferentiatedTransport, returnTransportOptions, selectedReturnCity]);
  const selectedTransportAmount = useMemo(() => {
    if (transportMode === 'Sans transport') return 0;
    if (isDifferentiatedTransport) {
      const outboundAmount = selectedDepartureTransportOption
        ? selectedDepartureTransportOption.returnCity
          ? selectedDepartureTransportOption.amount / 2
          : selectedDepartureTransportOption.amount
        : 0;
      const returnAmount = selectedReturnTransportOption
        ? selectedReturnTransportOption.departureCity
          ? selectedReturnTransportOption.amount / 2
          : selectedReturnTransportOption.amount
        : 0;
      return (
        outboundAmount +
        returnAmount
      );
    }
    return selectedTransportOption?.amount ?? 0;
  }, [
    isDifferentiatedTransport,
    selectedDepartureTransportOption,
    selectedReturnTransportOption,
    selectedTransportOption,
    transportMode
  ]);
  const selectedInsuranceOption = useMemo(
    () => insuranceOptions.find((option) => option.id === selectedInsuranceId) ?? null,
    [insuranceOptions, selectedInsuranceId]
  );
  const selectedExtraOption = useMemo(
    () => extraOptions.find((option) => option.id === selectedExtraOptionId) ?? null,
    [extraOptions, selectedExtraOptionId]
  );
  const isSelectedSessionUnavailable = selectedSession ? selectedSession.status !== 'OPEN' : false;
  const publicBasePrice = useMemo(() => {
    if (selectedSession?.price != null) return selectedSession.price;
    if (typeof stay.priceFrom === 'number' && Number.isFinite(stay.priceFrom)) return stay.priceFrom;
    return null;
  }, [selectedSession, stay.priceFrom]);
  const displayedBasePrice = useMemo(
    () => getSessionDisplayedBasePrice(selectedSession, stay),
    [selectedSession, stay]
  );
  const estimatedPrice = useMemo(() => {
    return computeDisplayedTotal({
      basePrice: displayedBasePrice,
      transportAmount: selectedTransportAmount,
      extraOptionAmount: selectedExtraOption?.amount ?? 0,
      insuranceOption: selectedInsuranceOption
    });
  }, [
    displayedBasePrice,
    selectedExtraOption,
    selectedInsuranceOption,
    selectedTransportAmount
  ]);
  const estimatedPublicPrice = useMemo(
    () =>
      computeDisplayedTotal({
        basePrice: publicBasePrice,
        transportAmount: selectedTransportAmount,
        extraOptionAmount: selectedExtraOption?.amount ?? 0,
        insuranceOption: selectedInsuranceOption
      }),
    [publicBasePrice, selectedExtraOption, selectedInsuranceOption, selectedTransportAmount]
  );
  const partnerDiscountAmount =
    estimatedPublicPrice != null &&
    estimatedPrice != null &&
    estimatedPrice < estimatedPublicPrice
      ? Math.round((estimatedPublicPrice - estimatedPrice) * 100) / 100
      : null;
  const hasStartedSelection = Boolean(
    selectedSessionId ||
      selectedTransportId ||
      selectedDepartureCity ||
      selectedReturnCity ||
      selectedInsuranceId ||
      selectedExtraOptionId
  );
  const normalizedFinanceMode = stay.partnerFinanceMode ? normalizePartnerFinanceMode(stay.partnerFinanceMode) : null;
  const financeReferencePrice = hasStartedSelection && estimatedPrice != null ? estimatedPrice : getStayDisplayedPrice(stay);
  const partnerFinanceDisplay = useMemo(() => {
    if (financeReferencePrice == null || !stay.partnerFinanceMode) return null;
    return computePartnerFinanceDisplay({
      mode: stay.partnerFinanceMode,
      totalCents: Math.round(financeReferencePrice * 100),
      percentValue: stay.partnerFinancePercentValue,
      fixedCents: stay.partnerFinanceFixedCents
    });
  }, [financeReferencePrice, stay.partnerFinanceFixedCents, stay.partnerFinanceMode, stay.partnerFinancePercentValue]);

  useEffect(() => {
    setSelectedSessionId('');
    setSelectedTransportId('');
    setSelectedDepartureCity('');
    setSelectedReturnCity('');
    setSelectedInsuranceId('');
    setSelectedExtraOptionId('');
    setBookingError(null);
  }, [stay.id]);

  useEffect(() => {
    const storageKey = `stay-visit:${stay.id}`;
    const now = Date.now();
    const lastTrackedAtRaw = sessionStorage.getItem(storageKey);
    const lastTrackedAt = lastTrackedAtRaw ? Number(lastTrackedAtRaw) : 0;
    if (Number.isFinite(lastTrackedAt) && now - lastTrackedAt < VISIT_TRACKING_DEDUP_MS) {
      return;
    }
    sessionStorage.setItem(storageKey, String(now));

    const controller = new AbortController();
    fetch(`/api/stays/${encodeURIComponent(stay.id)}/visit`, {
      method: 'POST',
      keepalive: true,
      signal: controller.signal
    }).catch(() => {
      // Do not block the page if analytics tracking fails.
    });

    return () => controller.abort();
  }, [stay.id]);

  useEffect(() => {
    setSelectedTransportId('');
    setSelectedDepartureCity('');
    setSelectedReturnCity('');
    setBookingError(null);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!isDifferentiatedTransport) return;
    if (selectedDepartureCity && !departureCities.includes(selectedDepartureCity)) {
      setSelectedDepartureCity('');
    }
  }, [departureCities, isDifferentiatedTransport, selectedDepartureCity]);

  useEffect(() => {
    if (!isDifferentiatedTransport) return;
    if (selectedReturnCity && !returnCities.includes(selectedReturnCity)) {
      setSelectedReturnCity('');
    }
  }, [isDifferentiatedTransport, returnCities, selectedReturnCity]);

  useEffect(() => {
    if (!selectedInsuranceId) return;
    if (!insuranceOptions.some((option) => option.id === selectedInsuranceId)) {
      setSelectedInsuranceId('');
    }
  }, [insuranceOptions, selectedInsuranceId]);

  useEffect(() => {
    if (!selectedExtraOptionId) return;
    if (!extraOptions.some((option) => option.id === selectedExtraOptionId)) {
      setSelectedExtraOptionId('');
    }
  }, [extraOptions, selectedExtraOptionId]);

  const handleReserver = async () => {
    if (hasSessions && !selectedSession) {
      setBookingError('Sélectionnez une session.');
      return;
    }

    if (isSelectedSessionUnavailable) {
      setBookingError('Cette session n’est plus disponible.');
      return;
    }

    if (transportMode !== 'Sans transport' && selectedSession?.transportOptions.length) {
      if (isDifferentiatedTransport) {
        if (departureCities.length > 0 && !selectedDepartureTransportOption) {
          setBookingError('Sélectionnez un transport aller.');
          return;
        }
        if (returnCities.length > 0 && !selectedReturnTransportOption) {
          setBookingError('Sélectionnez un transport retour.');
          return;
        }
      } else if (!selectedTransportOption) {
        setBookingError('Sélectionnez un transport.');
        return;
      }
    }

    if (selectedSession?.id) {
      setIsCheckingAvailability(true);
      try {
        const response = await fetch(`/api/sessions/${selectedSession.id}/availability`, {
          method: 'GET',
          cache: 'no-store'
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setBookingError(payload?.error ?? 'Impossible de vérifier la disponibilité de la session.');
          return;
        }

        const payload = (await response.json()) as { available?: boolean; status?: string };
        if (!payload.available) {
          setBookingError(
            payload.status === 'OPEN'
              ? 'La session sélectionnée est complète.'
              : 'Cette session n’est plus disponible.'
          );
          return;
        }
      } catch {
        setBookingError('Impossible de vérifier la disponibilité de la session.');
        return;
      } finally {
        setIsCheckingAvailability(false);
      }
    }

    setBookingError(null);

    let transportLine: string | null = null;
    if (transportMode === 'Sans transport') {
      transportLine = 'Sans transport';
    } else if (isDifferentiatedTransport) {
      const chunks: string[] = [];
      if (selectedDepartureTransportOption) {
        const opt = selectedDepartureTransportOption;
        chunks.push(`Aller : ${formatTransportLabel(opt, opt.amount / 2)}`);
      } else if (selectedDepartureCity) {
        chunks.push(`Aller : ${normalizeTransportCityDisplay(selectedDepartureCity)}`);
      }
      if (selectedReturnTransportOption) {
        const opt = selectedReturnTransportOption;
        chunks.push(`Retour : ${formatTransportLabel(opt, opt.amount / 2)}`);
      } else if (selectedReturnCity) {
        chunks.push(`Retour : ${normalizeTransportCityDisplay(selectedReturnCity)}`);
      }
      transportLine = chunks.length > 0 ? chunks.join(' — ') : 'Transport aller / retour';
    } else if (selectedTransportOption) {
      transportLine = formatTransportLabel(selectedTransportOption);
    } else {
      transportLine = transportMode;
    }

    addItem(
      createCartItemFromStay(stay, {
        unitPrice: estimatedPrice ?? null,
        selection: {
          sessionId: selectedSession?.id ?? null,
          transportMode,
          transportOptionId: selectedTransportOption?.id ?? null,
          departureTransportOptionId: selectedDepartureTransportOption?.id ?? null,
          returnTransportOptionId: selectedReturnTransportOption?.id ?? null,
          departureCity: selectedDepartureCity || null,
          returnCity: selectedReturnCity || null,
          insuranceOptionId: selectedInsuranceOption?.id ?? null,
          extraOptionId: selectedExtraOption?.id ?? null
        },
        selectionLabels: {
          sessionLine: selectedSession
            ? formatSessionDateRangeFr(selectedSession.startDate, selectedSession.endDate)
            : null,
          transportLine,
          insuranceLine: selectedInsuranceOption ? formatInsuranceLabel(selectedInsuranceOption) : null,
          extraLine: selectedExtraOption
            ? `${selectedExtraOption.label} · ${formatPrice(selectedExtraOption.amount)}`
            : null
        }
      })
    );
    router.push('/panier');
  };
  const galleryImages = useMemo(() => {
    const fromStay = (stay.galleryImages ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0);
    const prioritized = stay.coverImage ? [stay.coverImage, ...fromStay] : fromStay;
    const unique = Array.from(new Set(prioritized));
    if (unique.length >= 3) return unique;
    const fallback = DEFAULT_GALLERY.filter((url) => !unique.includes(url));
    return [...unique, ...fallback].slice(0, 3);
  }, [stay.coverImage, stay.galleryImages]);
  const videoUrls = useMemo(
    () =>
      Array.from(
        new Set(
          (stay.videoUrls ?? [])
            .map((url) => (typeof url === 'string' ? url.trim() : ''))
            .filter((url) => url.length > 0)
        )
      ),
    [stay.videoUrls]
  );
  const rawSejourText = getRawField(stay.rawContext, ['sejour', 'presentation', 'description']);
  const rawProgrammeText = getRawField(stay.rawContext, ['programme', 'program', 'programme_details']);
  const rawActivitiesText = getRawField(stay.rawContext, ['activites', 'activities', 'activities_text']);
  const rawHebergementText = getRawField(stay.rawContext, ['hebergement', 'lodging', 'lodging_details']);
  const rawEncadrementText = getRawField(stay.rawContext, ['encadrement', 'supervision']);
  const rawDocumentsText = getRawField(stay.rawContext, [
    'documents_obligatoires',
    'documents',
    'documentsObligatoires'
  ]);
  const rawTransportText = getRawField(stay.rawContext, ['transport', 'transports']);
  const sejourText = pickFirstEditorialText([stay.description, rawSejourText, stay.summary]);
  const programmeText = pickFirstEditorialText([stay.programText, rawProgrammeText, stay.description]);
  const activitiesText = pickFirstEditorialText([stay.activitiesText, rawActivitiesText]);
  const hebergementText = pickFirstEditorialText([rawHebergementText]);
  const encadrementText = pickFirstEditorialText([rawEncadrementText]);
  const documentsText = pickFirstEditorialText([rawDocumentsText]);
  const transportText = pickFirstEditorialText([stay.transportText, rawTransportText]);
  const cleanedTransportText = useMemo(() => sanitizeTransportDisplayText(transportText), [transportText]);
  const programmeBlocks = useMemo(() => getProgrammeBlocks(programmeText), [programmeText]);
  const categories = stay.categories.length > 0 ? stay.categories : stay.filters.categories;
  const transportSummaryText = useMemo(() => {
    if (transportMode === 'Sans transport') {
      return '';
    }

    const allTransportOptions = availableSessions.flatMap((sessionItem) => sessionItem.transportOptions ?? []);
    const cityLabels = Array.from(
      new Set(
        allTransportOptions
          .flatMap((option) => [option.departureCity, option.returnCity])
          .map((value) => value.trim())
          .filter((value) => value && !isCenterTransportLabel(value))
      )
    );
    const hasDirectCenterArrival = allTransportOptions.some(
      (option) => isCenterTransportLabel(option.departureCity) || isCenterTransportLabel(option.returnCity)
    );

    const sentences: string[] = [];
    if (cityLabels.length > 0) {
      const cityList = formatFrenchList(cityLabels);
      if (transportMode === 'Aller/Retour différencié') {
        sentences.push(`Le séjour propose un départ et un retour depuis plusieurs villes, dont ${cityList}.`);
      } else {
        sentences.push(`Le séjour propose un départ depuis plusieurs villes, dont ${cityList}.`);
      }
    }

    if (transportMode === 'Aller/Retour différencié') {
      sentences.push('Le lieu de départ peut être différent du lieu de retour.');
    }

    if (hasDirectCenterArrival) {
      sentences.push("Il est aussi possible d'arriver directement sur le centre.");
    }

    return sentences.join(' ');
  }, [availableSessions, transportMode]);
  const displayedTransportText = useMemo(
    () => [transportSummaryText, cleanedTransportText].filter(Boolean).join('\n\n'),
    [cleanedTransportText, transportSummaryText]
  );
  const organizerHref = getOrganizerHref(stay);
  const seoInput = {
    title: stay.title,
    summary: stay.summary,
    description: stay.description,
    activitiesText,
    programText: programmeText,
    location: stay.location,
    region: stay.region,
    seasonName: stay.seasonName,
    ageRange: stay.ageRange,
    categories: stay.categories,
    seo: stay.seo
  };
  const displayH1Title = capitalizeHeadingSegments(stay.title);
  const introText = buildStayIntroText(seoInput);
  const seoPrimaryKeyword = stay.seo?.primaryKeyword?.trim();
  const seoInternalAnchors = useMemo(
    () => (stay.seo?.internalLinkAnchorSuggestions ?? []).filter((value) => value.trim().length > 0).slice(0, 6),
    [stay.seo?.internalLinkAnchorSuggestions]
  );
  const discoveryButtons = useMemo(
    () => seoInternalAnchors.map(toDiscoveryButton),
    [seoInternalAnchors]
  );
  const heroImageAlt = `Photo du séjour ${stay.title}${stay.location ? ` à ${stay.location}` : ''}`;
  const locationLabel = stay.displayLocation || stay.location || stay.region || 'Lieu à préciser';

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <section className="relative h-[240px] w-full overflow-hidden sm:h-[300px] md:h-[360px]">
        <Image
          src={getHighQualityImageUrl(stay.coverImage || galleryImages[0])}
          alt={heroImageAlt}
          fill
          className="object-cover"
          sizes="100vw"
          priority
          quality={STAY_IMAGE_DISPLAY_QUALITY}
        />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="px-4 text-center font-display text-3xl font-normal tracking-tight text-white sm:text-4xl md:text-5xl">
            {displayH1Title}
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-700">
                Accueil
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link href="/sejours" className="hover:text-slate-700">
                Séjours
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="text-slate-700" aria-current="page">
              {stay.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
          {/* Main column */}
          <article className="min-w-0">
            {/* Meta line */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-700">
                {categories.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {categories.map((category) => (
                      <span key={category} className="flex items-center gap-2">
                        <Image
                          src={getCategoryPictoSrc(category)}
                          alt=""
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px]"
                        />
                        <span>{formatLabel('categories', category)}</span>
                      </span>
                    ))}
                  </span>
                ) : null}

                <span className="flex items-center gap-2">
                  <Image
                    src="/image/sejours/pictos_fichesejour/map.png"
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px]"
                  />
                  {locationLabel}
                </span>

                <span className="flex items-center gap-2">
                  <Image
                    src="/image/sejours/pictos_age/age.png"
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px]"
                  />
                  {stay.ageRange}
                </span>

                <span className="flex items-center gap-2">
                  <Image
                    src="/image/sejours/pictos_duree/duree.png"
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px]"
                  />
                  {stay.duration}
                </span>
              </div>
            </div>

            <div className="mb-8 max-w-3xl">
              <EditorialParagraphs text={introText} className="text-base leading-relaxed text-slate-600" />
            </div>

            {/* Tabs */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {(
                [
                  { id: 'sejour' as TabId, label: 'Séjour' },
                  { id: 'hebergement' as TabId, label: 'Hébergement' },
                  { id: 'infos' as TabId, label: 'Infos pratiques' }
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-lg px-4 py-2.5 text-base font-semibold transition-colors ${
                    activeTab === id
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="prose prose-slate max-w-none [&_li]:[text-align:justify] [&_p]:[text-align:justify]">
              {activeTab === 'sejour' && (
                <section className="space-y-6">
                  <h2 className="font-display text-2xl font-semibold text-slate-900">
                    {seoPrimaryKeyword || 'Séjour'}
                  </h2>
                  <EditorialParagraphs text={sejourText} className="text-base leading-relaxed text-slate-600" />
                  {galleryImages.length > 0 ? (
                    <div className="pt-2">
                      <ScrollablePhotoGallery
                        title={stay.title}
                        imageUrls={galleryImages}
                      />
                    </div>
                  ) : null}
                  {activitiesText && (
                    <div className="pt-2">
                      <h3 className="text-lg font-semibold text-slate-900">Activités</h3>
                      <div className="mt-2">
                        <EditorialParagraphs text={activitiesText} className="text-base leading-relaxed text-slate-600" />
                      </div>
                    </div>
                  )}
                  {stay.highlights.length > 0 && (
                    <div className="pt-2">
                      <h3 className="text-lg font-semibold text-slate-900">Points forts</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-slate-600">
                        {stay.highlights.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-2">
                    <h3 className="font-display text-2xl font-semibold text-slate-900">Programme</h3>
                    <div className="mt-2 space-y-4 text-slate-600">
                      {programmeBlocks.length > 0 ? (
                        programmeBlocks.map((block, i) => (
                          <div key={i}>
                            {block.title && (
                              <h4 className="mb-1 text-lg font-semibold text-slate-800">{block.title}</h4>
                            )}
                            <EditorialParagraphs text={block.text} className="text-base leading-relaxed text-slate-600" />
                          </div>
                        ))
                      ) : (
                        <p className="text-base leading-relaxed">Informations à venir.</p>
                      )}
                    </div>
                  </div>
                  {videoUrls.length > 0 ? (
                    <div className="pt-2">
                      <h3 className="text-lg font-semibold text-slate-900">Vidéos du séjour</h3>
                      <div className="mt-3 grid gap-4">
                        {videoUrls.map((url, index) => {
                          const config = getVideoEmbedConfig(url);
                          if (!config) return null;

                          return (
                            <div key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                              {config.type === 'native' ? (
                                <video
                                  controls
                                  preload="metadata"
                                  className="aspect-video w-full bg-slate-950"
                                  src={config.src}
                                />
                              ) : config.type === 'iframe' ? (
                                <div className="relative aspect-video w-full">
                                  <iframe
                                    src={config.src}
                                    title={`Vidéo ${index + 1} du séjour ${stay.title}`}
                                    className="absolute inset-0 h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                  />
                                </div>
                              ) : (
                                <div className="p-4">
                                  <a
                                    href={config.src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-base font-semibold text-sky-900 underline-offset-2 hover:underline"
                                  >
                                    Voir la vidéo {index + 1}
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              )}

              {activeTab === 'hebergement' && (
                <section className="space-y-6">
                  <h2 className="font-display text-2xl font-semibold text-slate-900">Hébergement</h2>
                  {stay.accommodations?.length ? (
                    <div className="space-y-6">
                      {stay.accommodations.map((accommodation) => {
                        const metaLine = [
                          accommodation.accommodationType ? formatAccommodationType(accommodation.accommodationType) : '',
                          accommodation.locationLabel ?? ''
                        ]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <article key={accommodation.id} className="py-1">
                            <div className="space-y-1">
                              <h3 className="text-xl font-semibold text-slate-900">{accommodation.name}</h3>
                              {metaLine ? <p className="text-sm font-medium text-slate-500">{metaLine}</p> : null}
                            </div>

                            <div className="mt-5 space-y-4">
                              {accommodation.description ? (
                                <div>
                                  <h4 className="text-lg font-semibold text-slate-900">Description</h4>
                                  <div className="mt-2">
                                    <EditorialParagraphs
                                      text={accommodation.description}
                                      className="text-base leading-relaxed text-slate-600"
                                    />
                                  </div>
                                </div>
                              ) : null}

                              {accommodation.bedInfo ? (
                                <div>
                                  <h4 className="text-lg font-semibold text-slate-900">Couchage</h4>
                                  <div className="mt-2">
                                    <EditorialParagraphs
                                      text={accommodation.bedInfo}
                                      className="text-base leading-relaxed text-slate-600"
                                    />
                                  </div>
                                </div>
                              ) : null}

                              {accommodation.bathroomInfo ? (
                                <div>
                                  <h4 className="text-lg font-semibold text-slate-900">Sanitaires</h4>
                                  <div className="mt-2">
                                    <EditorialParagraphs
                                      text={accommodation.bathroomInfo}
                                      className="text-base leading-relaxed text-slate-600"
                                    />
                                  </div>
                                </div>
                              ) : null}

                              {accommodation.cateringInfo ? (
                                <div>
                                  <h4 className="text-lg font-semibold text-slate-900">Restauration</h4>
                                  <div className="mt-2">
                                    <EditorialParagraphs
                                      text={accommodation.cateringInfo}
                                      className="text-base leading-relaxed text-slate-600"
                                    />
                                  </div>
                                </div>
                              ) : null}

                              {accommodation.accessibilityInfo ? (
                                <div>
                                  <h4 className="text-lg font-semibold text-slate-900">Accessibilité</h4>
                                  <div className="mt-2">
                                    <EditorialParagraphs
                                      text={accommodation.accessibilityInfo}
                                      className="text-base leading-relaxed text-slate-600"
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {accommodation.imageUrls.length > 0 ? (
                              <div className="mt-5">
                                <ScrollablePhotoGallery
                                  title={accommodation.name}
                                  imageUrls={accommodation.imageUrls}
                                />
                              </div>
                            ) : null}
                            {accommodation.mapEmbedSrc ? (
                              <div className="mt-5">
                                <h4 className="text-lg font-semibold text-slate-900">Carte du lieu</h4>
                                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                  <div className="relative aspect-[4/3] w-full">
                                    <iframe
                                      src={accommodation.mapEmbedSrc}
                                      title={`Carte — ${accommodation.name}`}
                                      className="absolute inset-0 h-full w-full"
                                      loading="lazy"
                                      referrerPolicy="no-referrer-when-downgrade"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {accommodation.videoUrls && accommodation.videoUrls.length > 0 ? (
                              <div className="mt-5">
                                <h4 className="text-lg font-semibold text-slate-900">Vidéos du lieu</h4>
                                <div className="mt-3 grid gap-4">
                                  {accommodation.videoUrls.map((url, vIndex) => {
                                    const config = getVideoEmbedConfig(url);
                                    if (!config) return null;
                                    return (
                                      <div
                                        key={`${accommodation.id}-vid-${vIndex}`}
                                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                      >
                                        {config.type === 'native' ? (
                                          <video
                                            controls
                                            preload="metadata"
                                            className="aspect-video w-full bg-slate-950"
                                            src={config.src}
                                          />
                                        ) : config.type === 'iframe' ? (
                                          <div className="relative aspect-video w-full">
                                            <iframe
                                              src={config.src}
                                              title={`Vidéo ${vIndex + 1} — ${accommodation.name}`}
                                              className="absolute inset-0 h-full w-full"
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                              referrerPolicy="strict-origin-when-cross-origin"
                                              allowFullScreen
                                            />
                                          </div>
                                        ) : (
                                          <div className="p-4">
                                            <a
                                              href={config.src}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-base font-semibold text-sky-900 underline-offset-2 hover:underline"
                                            >
                                              Voir la vidéo {vIndex + 1}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EditorialParagraphs text={hebergementText} className="text-base leading-relaxed text-slate-600" />
                  )}
                </section>
              )}

              {activeTab === 'infos' && (
                <section className="space-y-6">
                  <h2 className="font-display text-2xl font-semibold text-slate-900">Infos pratiques</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Documents obligatoires</h3>
                      <div className="mt-2">
                        <EditorialParagraphs
                          text={documentsText}
                          emptyText="Les documents obligatoires vous seront précisés après la réservation."
                          className="text-base leading-relaxed text-slate-600"
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Transport</h3>
                      {displayedTransportText ? (
                        <div className="mt-2">
                          <EditorialParagraphs
                            text={displayedTransportText}
                            className="text-base leading-relaxed text-slate-600"
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-base leading-relaxed text-slate-600">
                          Informations à venir.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Encadrement</h3>
                      <div className="mt-2">
                        <EditorialParagraphs
                          text={
                            encadrementText ||
                            "L'équipe d'encadrement est composée de professionnels qualifiés et diplômés. Pour toute question, contactez l'organisateur du séjour."
                          }
                          className="text-base leading-relaxed text-slate-600"
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Localisation du centre</h3>
                      {!stay.centerLocations?.length && !stay.location ? (
                        <p className="mt-2 text-base leading-relaxed text-slate-600">
                          Aucune donnée de localisation disponible pour ce séjour.
                        </p>
                      ) : null}
                      <div className="mt-4">
                        <StayLocationMap
                          location={stay.displayLocation || stay.location}
                          centerLocations={stay.centerLocations}
                          className="h-[380px] overflow-hidden rounded-xl border border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {seoInternalAnchors.length > 0 ? (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <h2 className="font-display text-lg font-semibold text-slate-900">Découvrir d&apos;autres séjours</h2>
                <ul className="mt-4 flex flex-wrap gap-3 text-sm text-slate-900">
                  {discoveryButtons.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={handleDiscoveryClick(item)}
                        className="inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 font-semibold text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        {capitalizeFirstLetter(item.label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>

          {/* Sidebar */}
          <aside className="min-w-0 xl:sticky xl:top-8 xl:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Informations & Réservation
              </h2>
              <div className="mt-2">
                {partnerDiscountAmount != null && estimatedPublicPrice != null ? (
                  <p className="text-sm font-semibold text-slate-400 line-through">
                    {formatPrice(estimatedPublicPrice)}
                  </p>
                ) : null}
                <p className="text-2xl font-bold text-accent-600">
                  {hasStartedSelection && estimatedPrice != null ? (
                    <span>
                      <span className="inline-block">{formatPrice(estimatedPrice)}</span>
                      <span className="block text-sm font-medium text-accent-500 sm:inline sm:ml-2">
                        (sélection actuelle)
                      </span>
                    </span>
                  ) : (
                    `À partir de ${formatPrice(getStayDisplayedPrice(stay))}`
                  )}
                </p>
                {partnerDiscountAmount != null ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                      -{Math.round(stay.partnerDiscountPercent ?? 0)}%
                    </span>
                    <span className="text-sm font-semibold text-emerald-700">
                      Remise partenaire : -{formatPrice(partnerDiscountAmount)}
                    </span>
                  </div>
                ) : null}
                {normalizedFinanceMode === 'MANUAL' ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                    Le prix affiché n&apos;est pas encore définitif. Votre réservation sera transmise au partenaire comme une demande de devis.
                  </div>
                ) : partnerFinanceDisplay ? (
                  <div className="mt-3 space-y-1 text-sm">
                    {partnerFinanceDisplay.partnerCents != null && partnerFinanceDisplay.partnerCents > 0 ? (
                      <p className="font-semibold text-emerald-700">
                        Prise en charge partenaire : {formatPrice(partnerFinanceDisplay.partnerCents / 100)}
                        {normalizedFinanceMode === 'PERCENT' && typeof stay.partnerFinancePercentValue === 'number'
                          ? ` (${stay.partnerFinancePercentValue.toLocaleString('fr-FR', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2
                            })} %)`
                          : ''}
                      </p>
                    ) : null}
                    {partnerFinanceDisplay.familyCents != null ? (
                      <p className="font-semibold text-slate-700">
                        {partnerFinanceDisplay.familyCents === 0
                          ? 'Aucun règlement demandé au moment de la réservation'
                          : `Reste à régler : ${formatPrice(partnerFinanceDisplay.familyCents / 100)}`}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label htmlFor="session" className="mb-1 block text-sm font-medium text-slate-700">
                    Session
                  </label>
                  <select
                    id="session"
                    value={selectedSessionId}
                    onChange={(event) => setSelectedSessionId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    disabled={!hasSessions}
                  >
                    <option value="">{hasSessions ? 'Sélectionner une session' : 'Aucune session disponible'}</option>
                    {availableSessions.map((sessionItem) => (
                      <option
                        key={sessionItem.id}
                        value={sessionItem.id}
                        disabled={sessionItem.status !== 'OPEN'}
                      >
                        {formatSessionLabel(sessionItem)}
                      </option>
                    ))}
                  </select>
                  {hasSessions && !hasOpenSessions ? (
                    <p className="mt-2 text-sm font-semibold text-rose-600">
                      Séjour complet: aucune place disponible pour le moment.
                    </p>
                  ) : null}
                </div>
                {transportMode === 'Aller/Retour différencié' ? (
                  <>
                    <div>
                      <label htmlFor="transport-outbound" className="mb-1 block text-sm font-medium text-slate-700">
                        Transport Aller
                      </label>
                      <select
                        id="transport-outbound"
                        value={selectedDepartureCity}
                        onChange={(event) => setSelectedDepartureCity(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                        disabled={!selectedSession || !departureCities.length}
                      >
                        <option value="">
                          {!selectedSession
                            ? 'Sélectionnez d’abord une session'
                            : departureCities.length
                              ? 'Sélectionner un transport aller'
                              : 'Aucun transport aller'}
                        </option>
                        {departureCities.map((city) => (
                          <option key={city} value={city}>
                            {normalizeTransportCityDisplay(city)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="transport-return" className="mb-1 block text-sm font-medium text-slate-700">
                        Transport Retour
                      </label>
                      <select
                        id="transport-return"
                        value={selectedReturnCity}
                        onChange={(event) => setSelectedReturnCity(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                        disabled={!selectedSession || !returnCities.length}
                      >
                        <option value="">
                          {!selectedSession
                            ? 'Sélectionnez d’abord une session'
                            : returnCities.length
                              ? 'Sélectionner un transport retour'
                              : 'Aucun transport retour'}
                        </option>
                        {returnCities.map((city) => (
                          <option key={city} value={city}>
                            {normalizeTransportCityDisplay(city)}
                          </option>
                        ))}
                      </select>
                      {(selectedDepartureTransportOption || selectedReturnTransportOption) && (
                        <p className="mt-1 text-xs text-slate-500">
                          Tarif transport : {formatPrice(selectedTransportAmount)}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label htmlFor="transport" className="mb-1 block text-sm font-medium text-slate-700">
                      Transport
                    </label>
                    <select
                      id="transport"
                      value={transportMode === 'Sans transport' ? 'Sans transport' : selectedTransportId}
                      onChange={(event) => setSelectedTransportId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      disabled={transportMode === 'Sans transport' || !selectedSession || !sessionTransportOptions.length}
                    >
                      {transportMode === 'Sans transport' ? (
                        <option value="Sans transport">Sans transport</option>
                      ) : (
                        <>
                          <option value="">
                            {!selectedSession
                              ? 'Sélectionnez d’abord une session'
                              : sessionTransportOptions.length
                                ? 'Sélectionner un transport'
                                : 'Aucune option de transport'}
                          </option>
                          {sessionTransportOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {formatTransportLabel(option)}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                )}
                {insuranceOptions.length > 0 ? (
                  <div>
                    <label htmlFor="insurance" className="mb-1 block text-sm font-medium text-slate-700">
                      Assurance
                    </label>
                    <select
                      id="insurance"
                      value={selectedInsuranceId}
                      onChange={(event) => setSelectedInsuranceId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    >
                      <option value="">Aucune assurance</option>
                      {insuranceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {formatInsuranceLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {extraOptions.length > 0 ? (
                  <div>
                    <label htmlFor="extra-options" className="mb-1 block text-sm font-medium text-slate-700">
                      Options supplémentaires
                    </label>
                    <select
                      id="extra-options"
                      value={selectedExtraOptionId}
                      onChange={(event) => setSelectedExtraOptionId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    >
                      <option value="">Aucune option supplémentaire</option>
                      {extraOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} · {formatPrice(option.amount)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {bookingError && <p className="text-sm text-rose-600">{bookingError}</p>}
                {hasSessions && !hasOpenSessions ? (
                  <p className="mt-4 flex w-full items-center justify-center rounded-xl bg-rose-50 px-6 py-3.5 text-base font-semibold text-rose-700">
                    Séjour complet
                  </p>
                ) : isSelectedSessionUnavailable ? (
                  <p className="mt-4 flex w-full items-center justify-center rounded-xl bg-rose-50 px-6 py-3.5 text-base font-semibold text-rose-700">
                    Complet
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleReserver}
                    disabled={!hasSessions || !hasOpenSessions || isCheckingAvailability}
                    className="cta-orange-sweep mt-4 flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isCheckingAvailability ? 'Vérification...' : 'Réserver maintenant'}
                  </button>
                )}
                <FavoriteToggleButton
                  stayId={stay.id}
                  showLabel
                  inactiveLabel="Ajouter aux favoris"
                  activeLabel="Déjà en favori"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base"
                />
              </form>

            </div>

            {/* Organisateur */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold text-slate-900">
                <User className="h-4 w-4 text-accent-500" />
                Organisateur du séjour
              </h3>
              <div className="mt-3 flex items-center gap-4">
                {stay.organizer.logoUrl ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-full bg-slate-100">
                    <Image
                      src={stay.organizer.logoUrl}
                      alt={`Logo ${stay.organizer.name}`}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-600">
                    {stay.organizer.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">{stay.organizer.name}</p>
                </div>
              </div>
              <Link
                href={organizerHref}
                className="cta-orange-sweep mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white"
              >
                En savoir plus
              </Link>
            </div>
          </aside>
        </div>
      </div>

    </div>
  );
}

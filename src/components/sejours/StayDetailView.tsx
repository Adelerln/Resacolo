'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Palette,
  MapPin,
  Users,
  Clock,
  MapPin as PinIcon,
  User,
  Waves,
  Mountain,
  Trees,
  Flag,
  Languages,
  FlaskConical,
  Dumbbell,
  Route,
  Globe2
} from 'lucide-react';
import type { Stay, StayInsuranceOption, StaySessionOption, StayTransportOption } from '@/types/stay';
import { useCart } from '@/context/CartContext';
import { createCartItemFromStay } from '@/lib/cart/normalizeCartItem';
import { FILTER_LABELS } from '@/lib/constants';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import StayLocationMap from '@/components/sejours/StayLocationMap';

type TabId = 'sejour' | 'programme' | 'hebergement' | 'encadrement' | 'infos';

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
  const price = session.price != null ? ` · ${formatPrice(session.price)}` : '';
  return `${start} - ${end}${status}${price}`;
}

function formatTransportLabel(option: StayTransportOption) {
  const cities = [option.departureCity, option.returnCity].filter(Boolean);
  const route =
    cities.length === 0
      ? 'Transport'
      : cities.length === 1 || option.departureCity === option.returnCity
        ? cities[0]
        : `${option.departureCity} / ${option.returnCity}`;
  return `${route} · ${formatPrice(option.amount)}`;
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

function getCategoryIcon(category: Stay['categories'][number]) {
  switch (category) {
    case 'mer':
      return Waves;
    case 'montagne':
      return Mountain;
    case 'campagne':
      return Trees;
    case 'artistique':
      return Palette;
    case 'equestre':
      return Flag;
    case 'linguistique':
      return Languages;
    case 'scientifique':
      return FlaskConical;
    case 'sportif':
      return Dumbbell;
    case 'itinerant':
      return Route;
    case 'etranger':
      return Globe2;
    default:
      return Palette;
  }
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

function getRawField(raw: Record<string, unknown> | undefined, keys: string[]) {
  if (!raw) return '';
  for (const key of keys) {
    if (key in raw) {
      const value = normalizeRawText(raw[key]);
      if (value) return value;
    }
  }
  return '';
}

const DEFAULT_GALLERY = [
  getMockImageUrl(mockImages.sejours.gallery[0], 600, 80),
  getMockImageUrl(mockImages.sejours.gallery[1], 600, 80),
  getMockImageUrl(mockImages.sejours.gallery[2], 600, 80)
];

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
  const estimatedPrice = useMemo(() => {
    const basePrice = selectedSession?.price ?? stay.priceFrom;
    if (basePrice == null) return stay.priceFrom;
    let total = basePrice;
    total += selectedTransportAmount;
    if (selectedExtraOption) total += selectedExtraOption.amount;
    if (selectedInsuranceOption?.amount != null) {
      total += selectedInsuranceOption.amount;
    } else if (selectedInsuranceOption?.percentValue != null) {
      total += (basePrice * selectedInsuranceOption.percentValue) / 100;
    }
    return Math.round(total * 100) / 100;
  }, [selectedExtraOption, selectedInsuranceOption, selectedSession, selectedTransportAmount, stay.priceFrom]);
  const hasStartedSelection = Boolean(
    selectedSessionId ||
      selectedTransportId ||
      selectedDepartureCity ||
      selectedReturnCity ||
      selectedInsuranceId ||
      selectedExtraOptionId
  );

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
        }
      })
    );
    router.push('/panier');
  };
  const galleryImages = stay.coverImage
    ? [stay.coverImage, DEFAULT_GALLERY[1], DEFAULT_GALLERY[2]]
    : DEFAULT_GALLERY;
  const sejourText = getRawField(stay.rawContext, ['sejour', 'presentation', 'description']) || stay.summary;
  const programmeText =
    getRawField(stay.rawContext, ['programme', 'program', 'programme_details']) || stay.description;
  const activitiesText = getRawField(stay.rawContext, ['activites', 'activities', 'activities_text']);
  const hebergementText = getRawField(stay.rawContext, ['hebergement', 'lodging', 'lodging_details']);
  const encadrementText = getRawField(stay.rawContext, ['encadrement', 'supervision']);
  const documentsText = getRawField(stay.rawContext, [
    'documents_obligatoires',
    'documents',
    'documentsObligatoires'
  ]);
  const transportText = getRawField(stay.rawContext, ['transport', 'transports']);
  const programmeBlocks = useMemo(() => getProgrammeBlocks(programmeText), [programmeText]);
  const firstCategory = stay.filters.categories[0];
  const themeLabel = firstCategory ? formatLabel('categories', firstCategory) : stay.title;
  const ThemeIcon = firstCategory ? getCategoryIcon(firstCategory) : Palette;

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <section className="relative h-[240px] w-full overflow-hidden sm:h-[300px] md:h-[360px]">
        <Image
          src={stay.coverImage || galleryImages[0]}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="px-4 text-center font-display text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl">
            {stay.title}
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
          {/* Main column */}
          <article className="min-w-0">
            {/* Meta line */}
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <ThemeIcon className="h-4 w-4 text-accent-500" aria-hidden />
                {themeLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-accent-500" aria-hidden />
                {stay.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-accent-500" aria-hidden />
                {stay.ageRange}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-accent-500" aria-hidden />
                {stay.duration}
              </span>
            </div>

            <p className="mb-8 max-w-3xl text-base leading-relaxed text-slate-600">{stay.summary}</p>

            {stay.filters.categories.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-3">
                {stay.filters.categories.map((category) => {
                  const Icon = getCategoryIcon(category);
                  return (
                    <span
                      key={category}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      <Icon className="h-4 w-4 text-accent-500" aria-hidden />
                      {formatLabel('categories', category)}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Gallery */}
            <div className="mb-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {galleryImages.slice(0, 3).map((src, i) => (
                <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 280px"
                  />
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {(
                [
                  { id: 'sejour' as TabId, label: 'Séjour' },
                  { id: 'programme' as TabId, label: 'Programme' },
                  { id: 'hebergement' as TabId, label: 'Hébergement' },
                  { id: 'encadrement' as TabId, label: 'Encadrement' },
                  { id: 'infos' as TabId, label: 'Infos pratiques' }
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
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
            <div className="prose prose-slate max-w-none">
              {activeTab === 'sejour' && (
                <section className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-slate-900">Séjour</h2>
                  <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {sejourText || 'Informations à venir.'}
                  </p>
                  {activitiesText && (
                    <div className="pt-2">
                      <h3 className="text-sm font-semibold text-slate-900">Activités</h3>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                        {activitiesText}
                      </p>
                    </div>
                  )}
                  {stay.highlights.length > 0 && (
                    <div className="pt-2">
                      <h3 className="text-sm font-semibold text-slate-900">Points forts</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {stay.highlights.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'programme' && (
                <section className="space-y-6">
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    Programme
                  </h2>
                  <div className="space-y-4 text-slate-600">
                    {programmeBlocks.length > 0 ? (
                      programmeBlocks.map((block, i) => (
                        <div key={i}>
                          {block.title && (
                            <h3 className="mb-1 font-semibold text-slate-800">{block.title}</h3>
                          )}
                          <p className="whitespace-pre-line text-sm leading-relaxed">{block.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-relaxed">Informations à venir.</p>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'hebergement' && (
                <section className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-slate-900">Hébergement</h2>
                  <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {hebergementText || 'Informations à venir.'}
                  </p>
                </section>
              )}

              {activeTab === 'encadrement' && (
                <section className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-slate-900">Encadrement</h2>
                  <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {encadrementText ||
                      "L'équipe d'encadrement est composée de professionnels qualifiés et diplômés. Pour toute question, contactez l'organisateur du séjour."}
                  </p>
                </section>
              )}

              {activeTab === 'infos' && (
                <section className="space-y-6">
                  <h2 className="font-display text-xl font-semibold text-slate-900">Infos pratiques</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Documents obligatoires</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                        {documentsText || 'Informations à venir.'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Transport</h3>
                      {transportText ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                          {transportText}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          Informations à venir.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Video placeholder */}
            <div className="mt-12 flex aspect-video items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <span className="text-sm font-medium">Ici, votre vidéo.</span>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="min-w-0 xl:sticky xl:top-8 xl:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Informations & Réservation
              </h2>
              <p className="mt-2 text-2xl font-bold text-accent-600">
                {hasStartedSelection && estimatedPrice != null ? (
                  <span>
                    <span className="inline-block">{formatPrice(estimatedPrice)}</span>
                    <span className="block text-sm font-medium text-accent-500 sm:inline sm:ml-2">
                      (sélection actuelle)
                    </span>
                  </span>
                ) : (
                  `À partir de ${formatPrice(stay.priceFrom)}`
                )}
              </p>

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
                            {city}
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
                            {city}
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
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isCheckingAvailability ? 'Vérification...' : 'Réserver maintenant'}
                  </button>
                )}
              </form>

            </div>

            {/* Lieux de séjour */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold text-slate-900">
                <PinIcon className="h-4 w-4 text-accent-500" />
                Ville du séjour
              </h3>
              <p className="mt-3 text-sm text-slate-600">{stay.location || 'Ville à préciser'}</p>
              <div className="mt-4">
                <StayLocationMap location={stay.location} />
              </div>
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
                      alt=""
                      fill
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
                href="/organisateurs"
                className="mt-4 inline-block rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
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

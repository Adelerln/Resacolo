import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import SavedToast from '@/components/common/SavedToast';
import RemainingPlacesEditor from '@/components/organisme/RemainingPlacesEditor';
import StayInsuranceForm from '@/components/organisme/StayInsuranceForm';
import StayEditorialTabs from '@/components/organisme/StayEditorialTabs';
import StayFloatingSaveButton from '@/components/organisme/StayFloatingSaveButton';
import StaySeoEditor from '@/components/organisme/StaySeoEditor';
import StayTransportCardEffects from '@/components/organisme/StayTransportCardEffects';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getStayCanonicalPath, getStays } from '@/lib/stays';
import { normalizeStayCategories, STAY_CATEGORY_OPTIONS } from '@/lib/stay-categories';
import { sanitizeSeoTags, sanitizeSeoText } from '@/lib/stay-seo';
import { formatStayAgeRange, getStayAgeBounds, normalizeStayAges, parseStayAges, STAY_AGE_OPTIONS } from '@/lib/stay-ages';
import { isMissingRegionTextColumnError, normalizeStayRegion, STAY_REGION_OPTIONS } from '@/lib/stay-regions';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';
import { slugify } from '@/lib/utils';
import type { Database } from '@/types/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
    transportSaved?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SEASON_ORDER = ['Hiver', 'Printemps', 'Été', 'Automne', "Fin d'année"];

function parseOptionalEuros(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function getSessionPriceAmountCents(
  sessionItem: {
    session_prices?:
      | {
          amount_cents: number;
          currency: string;
        }
      | {
          amount_cents: number;
          currency: string;
        }[]
      | null;
  }
) {
  if (!sessionItem.session_prices) return null;
  if (Array.isArray(sessionItem.session_prices)) {
    return sessionItem.session_prices[0]?.amount_cents ?? null;
  }
  return sessionItem.session_prices.amount_cents ?? null;
}

function formatInsuranceOptionLabel(option: {
  label: string;
  pricing_mode: string;
  amount_cents: number | null;
  percent_value: number | null;
}) {
  if (option.pricing_mode === 'PERCENT' && option.percent_value != null) {
    return `${option.label} (${option.percent_value}%)`;
  }
  if (option.amount_cents != null) {
    return `${option.label} (${(option.amount_cents / 100).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    })})`;
  }
  return option.label;
}

function formatReservedPlacesLabel(count: number, total: number) {
  const reservedWord = count > 1 ? 'places réservées' : 'place réservée';
  return `${count} ${reservedWord} /${total}`;
}

function formatRemainingPlacesLabel(count: number) {
  const remainingWord = count > 1 ? 'places restantes' : 'place restante';
  return `${count} ${remainingWord}`;
}

function getNextAvailablePosition(positions: number[]) {
  const taken = new Set(
    positions.filter((position) => Number.isInteger(position) && position > 0)
  );
  let nextPosition = 1;
  while (taken.has(nextPosition)) {
    nextPosition += 1;
  }
  return nextPosition;
}

function isMissingSeoColumnsError(message: string | null | undefined) {
  const normalizedMessage = (message ?? '').toLowerCase();
  return (
    normalizedMessage.includes('seo_primary_keyword') ||
    normalizedMessage.includes('seo_secondary_keywords') ||
    normalizedMessage.includes('seo_target_city') ||
    normalizedMessage.includes('seo_target_region') ||
    normalizedMessage.includes('seo_search_intents') ||
    normalizedMessage.includes('seo_title') ||
    normalizedMessage.includes('seo_meta_description')
  );
}

export default async function OrganizerStayDetailPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(resolvedSearchParams?.saved)
    ? resolvedSearchParams?.saved[0]
    : resolvedSearchParams?.saved;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const transportSavedParam = Array.isArray(resolvedSearchParams?.transportSaved)
    ? resolvedSearchParams?.transportSaved[0]
    : resolvedSearchParams?.transportSaved;
  const showSavedBanner = savedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: stay } = await supabase
    .from('stays')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!stay || stay.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/sejours', selectedOrganizerId));
  }
  const currentStay = stay;
  const selectedAges = normalizeStayAges(currentStay.ages, currentStay.age_min, currentStay.age_max);

  const [
    { data: seasonsRaw },
    { data: sessionsRaw },
    { data: mediaRaw },
    { data: accommodationsRaw },
    { data: stayAccommodationLinksRaw },
    { data: extraOptionsRaw },
    { data: insuranceOptionsRaw },
    { data: transportOptionsRaw }
  ] = await Promise.all([
    supabase.from('seasons').select('id,name').order('name', { ascending: true }),
    supabase
      .from('sessions')
      .select('id,start_date,end_date,capacity_total,capacity_reserved,status,session_prices(amount_cents,currency)')
      .eq('stay_id', currentStay.id)
      .order('start_date', { ascending: true }),
    supabase
      .from('stay_media')
      .select('id,url,position,media_type')
      .eq('stay_id', currentStay.id)
      .order('position', { ascending: true }),
    supabase
      .from('accommodations')
      .select(
        'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status'
      )
      .eq('organizer_id', selectedOrganizerId)
      .order('name', { ascending: true }),
    supabase
      .from('stay_accommodations')
      .select('accommodation_id')
      .eq('stay_id', currentStay.id),
    supabase
      .from('stay_extra_options')
      .select('id,label,amount_cents,position')
      .eq('stay_id', currentStay.id)
      .order('position', { ascending: true }),
    supabase
      .from('insurance_options')
      .select('id,label,amount_cents,percent_value,pricing_mode')
      .eq('stay_id', currentStay.id),
    supabase
      .from('transport_options')
      .select('id,departure_city,return_city,amount_cents,stay_id')
      .eq('stay_id', currentStay.id)
  ]);

  const seasons = [...(seasonsRaw ?? [])].sort((a, b) => {
    const indexA = SEASON_ORDER.indexOf(a.name);
    const indexB = SEASON_ORDER.indexOf(b.name);
    if (indexA === -1 && indexB === -1) {
      return a.name.localeCompare(b.name, 'fr');
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  const seasonNameById = Object.fromEntries(seasons.map((season) => [season.id, season.name]));
  const stayAgeRange = formatStayAgeRange(selectedAges);
  const allPublishedStays = await getStays();
  const stayCanonicalPathPreview = getStayCanonicalPath(
    allPublishedStays.find((item) => item.id === currentStay.id)?.canonicalSlug ??
      (slugify(currentStay.title) || currentStay.id)
  );
  const sessions = sessionsRaw ?? [];
  const reservedSessionCounts = await getReservedSessionCounts(
    supabase,
    sessions.map((sessionItem) => sessionItem.id)
  );
  const media = mediaRaw ?? [];
  const accommodations = (accommodationsRaw ?? []).map((accommodation) => {
    const locationMeta = extractAccommodationLocationMeta(accommodation.description);
    return {
      ...accommodation,
      description: locationMeta.description,
      locationLabel: locationMeta.locationLabel
    };
  });
  const stayAccommodationLinks = stayAccommodationLinksRaw ?? [];
  const extraOptions = extraOptionsRaw ?? [];
  const insuranceOptions = insuranceOptionsRaw ?? [];
  const transportOptions = transportOptionsRaw ?? [];
  const hasTransportOptions = transportOptions.length > 0;
  const linkedAccommodations = stayAccommodationLinks
    .map((link) => accommodations.find((item) => item.id === link.accommodation_id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const linkedAccommodation = linkedAccommodations[0] ?? null;

  async function updateStay(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const title = String(formData.get('title') ?? '').trim();
    const summary = String(formData.get('summary') ?? '').trim();
    const seasonId = String(formData.get('season_id') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const activitiesText = String(formData.get('activities_text') ?? '').trim();
    const programText = String(formData.get('program_text') ?? '').trim();
    const supervisionText = String(formData.get('supervision_text') ?? '').trim();
    const requiredDocumentsText = String(formData.get('required_documents_text') ?? '').trim();
    const categories = normalizeStayCategories(
      formData
        .getAll('categories')
        .map((value) => String(value).trim())
        .filter(Boolean)
    );
    const selectedAges = parseStayAges(formData);
    const { ages, ageMin, ageMax } = getStayAgeBounds(selectedAges);
    const location = String(formData.get('location') ?? '').trim();
    const region = normalizeStayRegion(formData.get('region_text'));
    const transportMode = String(formData.get('transport_mode') ?? '').trim();
    const transportText = String(formData.get('transport_text') ?? '').trim();
    const seoPrimaryKeyword = sanitizeSeoText(formData.get('seo_primary_keyword')) || null;
    const seoSecondaryKeywords = sanitizeSeoTags(
      formData.getAll('seo_secondary_keywords').map((value) => String(value))
    );
    const seoTargetCity = sanitizeSeoText(formData.get('seo_target_city')) || null;
    const seoTargetRegion = sanitizeSeoText(formData.get('seo_target_region')) || null;
    const seoSearchIntents = sanitizeSeoTags(
      formData.getAll('seo_search_intents').map((value) => String(value))
    );
    const seoTitle = sanitizeSeoText(formData.get('seo_title')) || null;
    const seoMetaDescription = sanitizeSeoText(formData.get('seo_meta_description')) || null;
    const partnerDiscountRaw = String(formData.get('partner_discount_percent') ?? '').trim().replace(',', '.');
    let partnerDiscountPercent: number | null = null;
    if (partnerDiscountRaw !== '') {
      const parsed = Number(partnerDiscountRaw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        redirect(
          withOrganizerQuery(
            `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(
              'Réduction partenaires : indique un pourcentage entre 0 et 100, ou laisse vide.'
            )}`,
            selectedOrganizerId
          )
        );
      }
      partnerDiscountPercent = parsed;
    }
    const requestedTransportMode = transportMode || currentStay.transport_mode || 'Sans transport';
    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const previousSlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;
    const nextSlug = slugify(`${organizerName}-${title}`) || currentStay.id;
    const { data: existingTransportOptions } = await supabase
      .from('transport_options')
      .select('id')
      .eq('stay_id', currentStay.id);
    const hasExistingTransportOptions = (existingTransportOptions ?? []).length > 0;

    if (
      hasExistingTransportOptions &&
      requestedTransportMode !== (currentStay.transport_mode || 'Sans transport')
    ) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(
            'Impossible de modifier le type de transport tant que des villes de transport existent.'
          )}`,
          selectedOrganizerId
        )
      );
    }

    const basePayload: Database['public']['Tables']['stays']['Update'] = {
      title,
      summary: summary || null,
      season_id: seasonId || currentStay.season_id,
      description: description || null,
      activities_text: activitiesText || null,
      program_text: programText || null,
      supervision_text: supervisionText || null,
      required_documents_text: requiredDocumentsText || null,
      categories,
      ages,
      age_min: ageMin,
      age_max: ageMax,
      location_text: location || null,
      transport_mode: requestedTransportMode,
      transport_text: transportText || null,
      partner_discount_percent: partnerDiscountPercent
    };

    const seoPayload: Database['public']['Tables']['stays']['Update'] = {
      seo_primary_keyword: seoPrimaryKeyword,
      seo_secondary_keywords: seoSecondaryKeywords,
      seo_target_city: seoTargetCity,
      seo_target_region: seoTargetRegion,
      seo_search_intents: seoSearchIntents,
      seo_title: seoTitle,
      seo_meta_description: seoMetaDescription
    };
    const payloadWithRegionAndSeo = { ...basePayload, region_text: region, ...seoPayload };
    const payloadWithSeo = { ...basePayload, ...seoPayload };
    const payloadWithRegion = { ...basePayload, region_text: region };
    let updateError: { message: string } | null = null;

    const firstAttempt = await supabase
      .from('stays')
      .update(payloadWithRegionAndSeo)
      .eq('id', currentStay.id);
    updateError = firstAttempt.error;

    if (updateError) {
      const missingRegion = isMissingRegionTextColumnError(updateError.message);
      const missingSeo = isMissingSeoColumnsError(updateError.message);

      if (missingRegion && missingSeo) {
        const fallbackWithoutRegion = await supabase
          .from('stays')
          .update(payloadWithSeo)
          .eq('id', currentStay.id);
        updateError = fallbackWithoutRegion.error;

        if (updateError && isMissingSeoColumnsError(updateError.message)) {
          const fallbackBase = await supabase.from('stays').update(basePayload).eq('id', currentStay.id);
          updateError = fallbackBase.error;
        }
      } else if (missingRegion) {
        const fallbackWithoutRegion = await supabase
          .from('stays')
          .update(payloadWithSeo)
          .eq('id', currentStay.id);
        updateError = fallbackWithoutRegion.error;
      } else if (missingSeo) {
        const fallbackWithoutSeo = await supabase
          .from('stays')
          .update(payloadWithRegion)
          .eq('id', currentStay.id);
        updateError = fallbackWithoutSeo.error;

        if (updateError && isMissingRegionTextColumnError(updateError.message)) {
          const fallbackBase = await supabase.from('stays').update(basePayload).eq('id', currentStay.id);
          updateError = fallbackBase.error;
        }
      }
    }

    if (updateError) {
      console.error('Erreur Supabase (update stay)', updateError.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(updateError.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${previousSlug}`);
    revalidatePath(`/sejours/${nextSlug}`);
    redirect(
      withOrganizerQuery(
        `/organisme/sejours/${currentStay.id}?saved=1&transportSaved=${Date.now()}`,
        selectedOrganizerId
      )
    );
  }

  async function addSession(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const startDate = String(formData.get('startDate') ?? '').trim();
    const endDate = String(formData.get('endDate') ?? '').trim();
    const capacityTotal = Number(formData.get('capacityTotal') ?? 0);
    const amountEuros = parseOptionalEuros(formData.get('amount_euros'));
    const rawAmount = String(formData.get('amount_euros') ?? '').trim();

    if (
      !startDate ||
      !endDate ||
      Number.isNaN(capacityTotal) ||
      capacityTotal < 0 ||
      (rawAmount && amountEuros === null)
    ) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-session`,
          selectedOrganizerId
        )
      );
    }

    const { data: createdSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        stay_id: currentStay.id,
        start_date: startDate,
        end_date: endDate,
        capacity_total: capacityTotal,
        capacity_reserved: 0,
        status: 'OPEN'
      })
      .select('id')
      .single();

    if (sessionError || !createdSession) {
      const message = sessionError?.message ?? 'Impossible de creer la session.';
      console.error('Erreur Supabase (add session)', message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(message)}`,
          selectedOrganizerId
        )
      );
    }

    if (amountEuros !== null) {
      const { error: priceError } = await supabase.from('session_prices').insert({
        session_id: createdSession.id,
        amount_cents: Math.round(amountEuros * 100),
        currency: 'EUR'
      });

      if (priceError) {
        await supabase.from('sessions').delete().eq('id', createdSession.id).eq('stay_id', currentStay.id);
        console.error('Erreur Supabase (add session price)', priceError.message);
        redirect(
          withOrganizerQuery(
            `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(priceError.message)}`,
            selectedOrganizerId
          )
        );
      }
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
  }

  async function deleteSession(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const sessionId = String(formData.get('session_id') ?? '').trim();

    if (!sessionId) {
      redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
    }

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('stay_id', currentStay.id);

    if (error) {
      console.error('Erreur Supabase (delete session)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function updateSessionRemainingPlaces(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const sessionId = String(formData.get('session_id') ?? '').trim();
    const remainingPlaces = Number(formData.get('remaining_places') ?? NaN);

    if (!sessionId || Number.isNaN(remainingPlaces) || remainingPlaces < 0) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-session-capacity`,
          selectedOrganizerId
        )
      );
    }

    const { data: sessionItem } = await supabase
      .from('sessions')
      .select('id,stay_id,capacity_total,status')
      .eq('id', sessionId)
      .eq('stay_id', currentStay.id)
      .maybeSingle();

    if (!sessionItem) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-session-capacity`,
          selectedOrganizerId
        )
      );
    }

    const reservedCount = (await getReservedSessionCounts(supabase, [sessionId])).get(sessionId) ?? 0;
    const capacityTotal = reservedCount + remainingPlaces;
    const nextStatus =
      sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED'
        ? sessionItem.status
        : reservedCount >= capacityTotal
          ? 'FULL'
          : 'OPEN';

    const { error } = await supabase
      .from('sessions')
      .update({
        capacity_total: capacityTotal,
        capacity_reserved: reservedCount,
        status: nextStatus
      })
      .eq('id', sessionId)
      .eq('stay_id', currentStay.id);

    if (error) {
      console.error('Erreur Supabase (update remaining places)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function addInsuranceOption(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const label = String(formData.get('label') ?? '').trim();
    const pricingMode = String(formData.get('pricing_mode') ?? 'FIXED').trim().toUpperCase();
    const amountEuros = parseOptionalEuros(formData.get('amount_euros'));
    const percentRaw = String(formData.get('percent_value') ?? '').trim().replace(',', '.');
    const percentValue = percentRaw ? Number(percentRaw) : null;

    const normalizedPricingMode = pricingMode === 'PERCENT' ? 'PERCENT' : 'FIXED';
    const invalidPercent =
      normalizedPricingMode === 'PERCENT' &&
      (percentValue === null || Number.isNaN(percentValue) || percentValue < 0);
    const invalidFixedAmount = normalizedPricingMode === 'FIXED' && amountEuros === null;

    if (!label || invalidPercent || invalidFixedAmount) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-insurance-option`,
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase.from('insurance_options').insert({
      stay_id: currentStay.id,
      session_id: null,
      label,
      pricing_mode: normalizedPricingMode,
      amount_cents: normalizedPricingMode === 'FIXED' ? Math.round((amountEuros ?? 0) * 100) : null,
      percent_value: normalizedPricingMode === 'PERCENT' ? percentValue : null,
      rules_json: {}
    });

    if (error) {
      console.error('Erreur Supabase (add insurance option)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const staySlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${staySlug}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function addTransportOption(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const city = String(formData.get('city') ?? formData.get('departure_city') ?? '').trim();
    const amountEuros = parseOptionalEuros(formData.get('amount_euros'));
    const transportMode = currentStay.transport_mode ?? 'Sans transport';
    const availableOutbound = formData.get('available_outbound') === 'on';
    const availableReturn = formData.get('available_return') === 'on';

    const isDifferentiated = transportMode === 'Aller/Retour différencié';
    const departureCity = isDifferentiated ? (availableOutbound ? city : '') : city;
    const returnCity = isDifferentiated ? (availableReturn ? city : '') : city;

    if (
      transportMode === 'Sans transport' ||
      !city ||
      (isDifferentiated && !availableOutbound && !availableReturn) ||
      (!isDifferentiated && (!departureCity || !returnCity)) ||
      amountEuros === null
    ) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-transport-option`,
          selectedOrganizerId
        )
      );
    }

    const normalizedDepartureCity = departureCity.trim().toLocaleLowerCase('fr');
    const normalizedReturnCity = returnCity.trim().toLocaleLowerCase('fr');
    const { data: existingTransportOptions } = await supabase
      .from('transport_options')
      .select('id,departure_city,return_city')
      .eq('stay_id', currentStay.id);

    const duplicateTransportOption = (existingTransportOptions ?? []).find(
      (option) =>
        option.departure_city.trim().toLocaleLowerCase('fr') === normalizedDepartureCity &&
        option.return_city.trim().toLocaleLowerCase('fr') === normalizedReturnCity
    );

    if (duplicateTransportOption) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(
            'Cette ville de transport existe déjà.'
          )}`,
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase.from('transport_options').insert({
      stay_id: currentStay.id,
      session_id: null,
      departure_city: departureCity,
      return_city: returnCity,
      amount_cents: Math.round(amountEuros * 100)
    });

    if (error) {
      console.error('Erreur Supabase (add transport option)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const staySlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${staySlug}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function deleteTransportOption(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const optionId = String(formData.get('transport_option_id') ?? '').trim();

    if (!optionId) {
      redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
    }

    const { data: option } = await supabase
      .from('transport_options')
      .select('id,stay_id')
      .eq('id', optionId)
      .maybeSingle();

    if (!option || option.stay_id !== currentStay.id) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-transport-option`,
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase.from('transport_options').delete().eq('id', optionId);

    if (error) {
      console.error('Erreur Supabase (delete transport option)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const staySlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${staySlug}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function deleteInsuranceOption(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const optionId = String(formData.get('insurance_option_id') ?? '').trim();

    if (!optionId) {
      redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
    }

    const { data: option } = await supabase
      .from('insurance_options')
      .select('id,stay_id')
      .eq('id', optionId)
      .maybeSingle();

    if (!option || option.stay_id !== currentStay.id) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-insurance-option`,
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase.from('insurance_options').delete().eq('id', optionId);

    if (error) {
      console.error('Erreur Supabase (delete insurance option)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const staySlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${staySlug}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function addExtraOption(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const label = String(formData.get('label') ?? '').trim();
    const amountEuros = Number(String(formData.get('amount_euros') ?? '').trim().replace(',', '.'));
    const amountCents = Math.round(amountEuros * 100);

    if (!label || Number.isNaN(amountEuros) || amountEuros < 0) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=invalid-extra-option`,
          selectedOrganizerId
        )
      );
    }

    const { data: existingOption } = await supabase
      .from('stay_extra_options')
      .select('id')
      .eq('stay_id', currentStay.id)
      .eq('label', label)
      .eq('amount_cents', amountCents)
      .limit(1)
      .maybeSingle();

    if (existingOption) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent('Cette option existe déjà')}`,
          selectedOrganizerId
        )
      );
    }

    const { data: optionPositions } = await supabase
      .from('stay_extra_options')
      .select('position')
      .eq('stay_id', currentStay.id)
      .order('position', { ascending: true });

    const nextPosition = getNextAvailablePosition(
      (optionPositions ?? []).map((option) => option.position)
    );

    const { error } = await supabase.from('stay_extra_options').insert({
      stay_id: currentStay.id,
      label,
      amount_cents: amountCents,
      position: nextPosition,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Erreur Supabase (add stay extra option)', error.message);
      const message =
        error.message.includes('stay_extra_options_position_check')
          ? "Impossible d'ajouter l'option pour le moment."
          : error.message;
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function deleteExtraOption(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const optionId = String(formData.get('option_id') ?? '').trim();

    if (!optionId) {
      redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}`, selectedOrganizerId));
    }

    const { error } = await supabase
      .from('stay_extra_options')
      .delete()
      .eq('id', optionId)
      .eq('stay_id', currentStay.id);

    if (error) {
      console.error('Erreur Supabase (delete stay extra option)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    const { data: remainingOptions } = await supabase
      .from('stay_extra_options')
      .select('id,position')
      .eq('stay_id', currentStay.id)
      .order('position', { ascending: true });

    await Promise.all(
      (remainingOptions ?? []).map((option, index) =>
        supabase
          .from('stay_extra_options')
          .update({ position: index + 1 })
          .eq('id', option.id)
          .eq('stay_id', currentStay.id)
      )
    );

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function syncAccommodations(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const selectedId = String(formData.get('accommodation_id') ?? '').trim();

    const { data: validRows } = await supabase
      .from('accommodations')
      .select('id')
      .eq('organizer_id', selectedOrganizerId);
    const validIds = new Set((validRows ?? []).map((row) => row.id));
    const nextAccommodationId = validIds.has(selectedId) ? selectedId : null;
    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const staySlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;

    const { error: deleteError } = await supabase
      .from('stay_accommodations')
      .delete()
      .eq('stay_id', currentStay.id);

    if (deleteError) {
      console.error('Erreur Supabase (delete stay accommodations)', deleteError.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(deleteError.message)}`,
          selectedOrganizerId
        )
      );
    }

    if (nextAccommodationId) {
      const { error: insertError } = await supabase.from('stay_accommodations').insert(
        {
          stay_id: currentStay.id,
          accommodation_id: nextAccommodationId
        }
      );

      if (insertError) {
        console.error('Erreur Supabase (insert stay accommodations)', insertError.message);
        redirect(
          withOrganizerQuery(
            `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(insertError.message)}`,
            selectedOrganizerId
          )
        );
      }
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${staySlug}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  async function unlinkAccommodation() {
    'use server';
    const supabase = getServerSupabaseClient();
    const { data: organizer } = await supabase
      .from('organizers')
      .select('name')
      .eq('id', currentStay.organizer_id)
      .maybeSingle();
    const organizerName = organizer?.name ?? '';
    const staySlug = slugify(`${organizerName}-${currentStay.title}`) || currentStay.id;

    const { error } = await supabase
      .from('stay_accommodations')
      .delete()
      .eq('stay_id', currentStay.id);

    if (error) {
      console.error('Erreur Supabase (unlink stay accommodation)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/${currentStay.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath(`/organisme/sejours/${currentStay.id}`);
    revalidatePath(`/organisme/stays/${currentStay.id}`);
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath(`/sejours/${staySlug}`);
    redirect(withOrganizerQuery(`/organisme/sejours/${currentStay.id}?saved=1`, selectedOrganizerId));
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche séjour a bien été enregistrée." />}
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{currentStay.title}</h1>
          <p className="text-sm text-slate-600">
            Saison: {seasons.find((season) => season.id === currentStay.season_id)?.name ?? '-'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {stayStatusLabel(currentStay.status)}
        </span>
      </div>

      <form
        id="stay-form"
        action={updateStay}
        className="space-y-4"
      >
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Infos séjour</h2>
          <label className="block text-sm font-medium text-slate-700">
            Titre
            <input
              name="title"
              defaultValue={currentStay.title}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Résumé commercial{' '}
            <span className="text-xs font-normal text-slate-400">(max 100 caractères)</span>
            <textarea
              name="summary"
              defaultValue={currentStay.summary ?? ''}
              rows={3}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Ce texte apparaît en sous-titre gras sur la carte du séjour (max 2 lignes).
            </span>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Saison
            <select
              name="season_id"
              defaultValue={currentStay.season_id}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Sélectionner</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <StaySeoEditor
          canonicalPath={stayCanonicalPathPreview}
          seasonNameById={seasonNameById}
          initialContext={{
            title: currentStay.title,
            summary: currentStay.summary ?? '',
            description: currentStay.description ?? '',
            activitiesText: currentStay.activities_text ?? '',
            programText: currentStay.program_text ?? '',
            location: currentStay.location_text ?? '',
            region: currentStay.region_text ?? '',
            seasonName: seasonNameById[currentStay.season_id] ?? '',
            ageRange: stayAgeRange,
            categories: currentStay.categories ?? []
          }}
          initialSeo={{
            primaryKeyword: currentStay.seo_primary_keyword ?? undefined,
            secondaryKeywords: currentStay.seo_secondary_keywords ?? [],
            targetCity: currentStay.seo_target_city ?? undefined,
            targetRegion: currentStay.seo_target_region ?? undefined,
            searchIntents: currentStay.seo_search_intents ?? [],
            title: currentStay.seo_title ?? undefined,
            metaDescription: currentStay.seo_meta_description ?? undefined
          }}
          generation={{
            endpoint: `/api/organizer/stays/${currentStay.id}/seo`,
            organizerId: selectedOrganizerId,
            initialGeneratedAt: currentStay.seo_generated_at,
            initialGenerationSource: currentStay.seo_generation_source
          }}
        />

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Tarifs et conditions commerciales</h2>
          <label className="block">
            <span className="mb-3 block text-sm font-medium text-slate-700">
              Réduction accordée aux partenaires (%)
            </span>
            <input
              name="partner_discount_percent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Ex. 5"
              defaultValue={
                currentStay.partner_discount_percent != null
                  ? String(currentStay.partner_discount_percent)
                  : ''
              }
              className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
            />
            <span className="mt-2 block text-xs text-slate-500">
              Laisse vide si aucune réduction n’est prévue pour les collectivités partenaires.
            </span>
          </label>
        </section>

        <StayEditorialTabs
          description={currentStay.description ?? ''}
          activitiesText={currentStay.activities_text ?? ''}
          programText={currentStay.program_text ?? ''}
          linkedAccommodation={
            linkedAccommodation
              ? {
                  id: linkedAccommodation.id,
                  name: linkedAccommodation.name,
                  accommodationType: linkedAccommodation.accommodation_type,
                  description: linkedAccommodation.description,
                  locationLabel: linkedAccommodation.locationLabel
                }
              : null
          }
          accommodations={accommodations.map((accommodation) => ({
            id: accommodation.id,
            name: accommodation.name,
            accommodationType: accommodation.accommodation_type,
            description: accommodation.description,
            locationLabel: accommodation.locationLabel
          }))}
          syncAccommodationAction={syncAccommodations}
          unlinkAccommodationAction={unlinkAccommodation}
          supervisionText={currentStay.supervision_text ?? ''}
          requiredDocumentsText={currentStay.required_documents_text ?? ''}
          transportMode={currentStay.transport_mode ?? 'Sans transport'}
          transportText={currentStay.transport_text ?? ''}
          transportModeLocked={hasTransportOptions}
        />

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Paramètres du séjour</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-slate-700">Catégories du séjour</div>
              <p className="mt-1 text-xs text-slate-500">Tu peux en sélectionner plusieurs.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {STAY_CATEGORY_OPTIONS.map((category) => (
                <label
                  key={category.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={category.value}
                    defaultChecked={(currentStay.categories ?? []).includes(category.value)}
                    className="cursor-pointer"
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-slate-700">Âges</div>
              <p className="mt-1 text-xs text-slate-500">Coche les âges proposés.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {STAY_AGE_OPTIONS.map((age) => (
                <label
                  key={age}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="ages"
                    value={age}
                    defaultChecked={selectedAges.includes(age)}
                    className="cursor-pointer"
                  />
                  <span>{age} ans</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Sélection actuelle : {formatStayAgeRange(selectedAges)}
            </p>
          </div>
          <GoogleMapsCityInput
            name="location"
            label="Ville ou pays du séjour"
            defaultValue={currentStay.location_text ?? ''}
          />
          <label className="block text-sm font-medium text-slate-700">
            Région du séjour
            <select
              name="region_text"
              defaultValue={currentStay.region_text ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Sélectionner</option>
              {STAY_REGION_OPTIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Choisir “Étranger” si le séjour se déroule hors de France.
            </span>
          </label>
        </section>
      </form>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <StayTransportCardEffects
          formId="stay-transport-form"
          scrollContainerId="stay-transport-table-scroll"
          trigger={transportSavedParam}
        />
        <h2 className="text-lg font-semibold text-slate-900">Transport</h2>
        <p className="text-sm text-slate-600">{currentStay.transport_mode || 'Non renseigné'}</p>
        <p className="whitespace-pre-line text-sm text-slate-600">
          {currentStay.transport_text || 'Aucun texte transport saisi.'}
        </p>

        {currentStay.transport_mode === 'Sans transport' ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            Aucune option de transport à ajouter tant que le séjour est en `Sans transport`.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-slate-100">
              {transportOptions.length > 0 ? (
                <div id="stay-transport-table-scroll" className="max-h-48 overflow-y-auto overflow-x-auto">
                  <table className="min-w-[640px] w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Ville</th>
                        <th className="px-3 py-2">Aller</th>
                        <th className="px-3 py-2">Retour</th>
                        <th className="px-3 py-2">Prix</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transportOptions.map((option) => {
                        const displayCity =
                          option.departure_city || option.return_city || 'Non renseignée';
                        const hasOutbound = Boolean(option.departure_city?.trim());
                        const hasReturn = Boolean(option.return_city?.trim());

                        return (
                          <tr key={option.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-700">{displayCity}</td>
                            <td className="px-3 py-2 text-slate-700">{hasOutbound ? 'Oui' : 'Non'}</td>
                            <td className="px-3 py-2 text-slate-700">{hasReturn ? 'Oui' : 'Non'}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {(option.amount_cents / 100).toLocaleString('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <form action={deleteTransportOption}>
                                <input type="hidden" name="transport_option_id" value={option.id} />
                                <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                                  Supprimer
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-3 py-3 text-sm text-slate-500">
                  Aucune ville de transport définie pour ce séjour.
                </p>
              )}
            </div>

            <form
              id="stay-transport-form"
              key={transportSavedParam ?? 'idle'}
              action={addTransportOption}
              className="space-y-3 border-t border-slate-100 pt-4"
              autoComplete="off"
            >
              {currentStay.transport_mode === 'Aller/Retour différencié' ? (
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_minmax(180px,220px)] xl:items-end">
                  <label className="text-sm font-medium text-slate-700">
                    Ville
                    <input
                      name="city"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      placeholder="Ex. Paris"
                      required
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="available_outbound"
                      className="cursor-pointer"
                      defaultChecked
                    />
                    <span>Disponible à l&apos;aller</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="available_return"
                      className="cursor-pointer"
                      defaultChecked
                    />
                    <span>Disponible au retour</span>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Prix A/R en euros
                    <input
                      name="amount_euros"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      placeholder="0,00"
                      required
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Ville
                    <input
                      name="city"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      placeholder="Ex. Paris"
                      required
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Prix A/R en euros
                    <input
                      name="amount_euros"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      placeholder="0,00"
                      required
                    />
                  </label>
                </div>
              )}
              <div className="flex justify-end">
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Ajouter le transport
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Médias</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {media.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-100 px-3 py-2">
                {item.media_type || 'media'} : {item.url}
              </li>
            ))}
            {media.length === 0 && <li>Aucun média.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Options payantes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ajoute des options facturables en supplément pour ce séjour.
          </p>

          <div className="mt-4 rounded-lg border border-slate-100">
            {extraOptions.length > 0 ? (
              <div className="max-h-56 overflow-y-auto overflow-x-auto">
                <table className="min-w-[560px] w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Libellé</th>
                      <th className="px-3 py-2">Prix</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraOptions.map((option) => (
                      <tr key={option.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{option.label}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {(option.amount_cents / 100).toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'EUR'
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <form action={deleteExtraOption}>
                            <input type="hidden" name="option_id" value={option.id} />
                            <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                              Supprimer
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-3 py-3 text-sm text-slate-500">Aucune option payante pour le moment.</p>
            )}
          </div>

          <form action={addExtraOption} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Libellé
                <input
                  name="label"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Ex. Navette depuis Paris"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Montant TTC en euro
                <input
                  name="amount_euros"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="0,00"
                  required
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Ajouter l&apos;option
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {sessions.map((sessionItem) => {
              const reservedCount = reservedSessionCounts.get(sessionItem.id) ?? 0;
              const remainingPlaces = Math.max(
                0,
                sessionItem.capacity_total - reservedCount
              );
              const displayStatus =
                sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED'
                  ? sessionItem.status
                  : remainingPlaces === 0
                    ? 'FULL'
                    : 'OPEN';

              return (
                <li
                  key={sessionItem.id}
                  className="flex flex-col gap-4 rounded-lg border border-slate-100 px-3 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div>
                      {new Date(sessionItem.start_date).toLocaleDateString('fr-FR')} -{' '}
                      {new Date(sessionItem.end_date).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatReservedPlacesLabel(
                        reservedCount,
                        sessionItem.capacity_total
                      )}{' '}
                      ({sessionStatusLabel(displayStatus)})
                    </div>
                    {getSessionPriceAmountCents(sessionItem) !== null && (
                      <div className="text-xs text-slate-500">
                        Prix: {(getSessionPriceAmountCents(sessionItem)! / 100).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 md:items-end">
                    <div className="text-sm font-medium text-slate-700">
                      {formatRemainingPlacesLabel(remainingPlaces)}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <RemainingPlacesEditor
                        action={updateSessionRemainingPlaces}
                        initialValue={remainingPlaces}
                        hiddenFields={{ session_id: sessionItem.id }}
                      />
                      <form action={deleteSession}>
                        <input type="hidden" name="session_id" value={sessionItem.id} />
                        <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
            {sessions.length === 0 && <li>Aucune session.</li>}
          </ul>
          <form action={addSession} className="space-y-3 border-t border-slate-100 pt-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs font-medium text-slate-600">
                Début
                <input
                  name="startDate"
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Fin
                <input
                  name="endDate"
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Capacité
                <input
                  name="capacityTotal"
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Prix en euro
                <input
                  name="amount_euros"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                  placeholder="0,00"
                />
              </label>
            </div>
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              Ajouter session
            </button>
          </form>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Assurances du séjour</h2>

        <div className="space-y-3">
          {insuranceOptions.length > 0 ? (
            insuranceOptions.map((option) => (
              <div
                key={option.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-100 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-slate-700">{formatInsuranceOptionLabel(option)}</span>
                <form action={deleteInsuranceOption}>
                  <input type="hidden" name="insurance_option_id" value={option.id} />
                  <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                    Supprimer
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucune assurance définie pour ce séjour.</p>
          )}
        </div>

        <StayInsuranceForm action={addInsuranceOption} />
      </section>

      <StayFloatingSaveButton formId="stay-form" />
    </div>
  );
}

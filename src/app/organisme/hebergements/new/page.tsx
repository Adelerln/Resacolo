import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields from '@/components/organisme/AccommodationFormFields';
import { buildAccommodationTypeValue, parseAccommodationType } from '@/components/organisme/accommodation-type';
import { withOrganizerQuery } from '@/lib/organizers.server';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { parseAccommodationMediaUrls, replaceAccommodationMedia } from '@/lib/accommodations';
import {
  buildAccessibilityInfoFromForm,
  normalizeAccommodationAddress,
  readAccommodationLocationFromFormData,
  validateAccommodationFormLocation,
  validateAndParseAccommodationCenterCoordinates,
} from '@/lib/accommodation-location';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import type { Json } from '@/types/supabase';
import {
  buildGoogleMapsEmbedIframeHtml,
  extractGoogleMapsEmbedSrcFromInput,
  mergeMapIframeHtmlIntoAiExtractedData
} from '@/lib/google-maps-iframe';
import {
  consumeAccommodationFormDraft,
  INVALID_MAP_IFRAME_WARNING,
  stashAccommodationFormDraft
} from '@/lib/accommodation-form-draft.server';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
    iframe_warning?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewAccommodationPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'accommodations'
  });
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const iframeWarningParam = Array.isArray(resolvedSearchParams?.iframe_warning)
    ? resolvedSearchParams?.iframe_warning[0]
    : resolvedSearchParams?.iframe_warning;
  const formDraft = await consumeAccommodationFormDraft();

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  async function createAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const name = String(formData.get('name') ?? '').trim();
    const locationForm = readAccommodationLocationFromFormData(formData);
    const accommodationType = buildAccommodationTypeValue(locationForm.accommodationType);
    const parsedAccommodationType = parseAccommodationType(accommodationType);
    const description = String(formData.get('description') ?? '').trim();
    const addressInput = normalizeAccommodationAddress(locationForm.address);

    if (!name || !parsedAccommodationType.baseType) {
      await stashAccommodationFormDraft(formData);
      redirect(withOrganizerQuery('/organisme/hebergements/new?error=missing-required-fields', selectedOrganizerId));
    }

    const addressError = validateAccommodationFormLocation({
      accommodationType,
      locationMode: locationForm.locationMode,
      itinerantZone: locationForm.itinerantZone,
      address: addressInput
    });
    if (addressError) {
      await stashAccommodationFormDraft(formData);
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent(addressError)}`,
          selectedOrganizerId
        )
      );
    }

    const centerCoordinatesResult = validateAndParseAccommodationCenterCoordinates({
      centerLatitude: String(formData.get('center_latitude') ?? '').trim(),
      centerLongitude: String(formData.get('center_longitude') ?? '').trim()
    });
    if (centerCoordinatesResult.error) {
      await stashAccommodationFormDraft(formData);
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent(centerCoordinatesResult.error)}`,
          selectedOrganizerId
        )
      );
    }

    const now = new Date().toISOString();
    const mediaUrls = parseAccommodationMediaUrls(formData.get('media_urls'));
    const mapIframeRaw = String(formData.get('map_iframe_html') ?? '').trim();
    const mapEmbedSrc = extractGoogleMapsEmbedSrcFromInput(mapIframeRaw);
    const mapIframeInvalid = mapIframeRaw.length > 0 && !mapEmbedSrc;
    const normalizedMapIframeHtml =
      mapIframeRaw.length === 0 || mapIframeInvalid
        ? null
        : mapEmbedSrc
          ? buildGoogleMapsEmbedIframeHtml(mapEmbedSrc)
          : null;

    const insertPayload = {
      organizer_id: selectedOrganizerId,
      name,
      accommodation_type: accommodationType,
      address_text: addressInput.addressText || null,
      postal_code: addressInput.postalCode || null,
      city: addressInput.city || null,
      department_code: addressInput.departmentCode || null,
      region_text: addressInput.regionText || null,
      country: addressInput.country || null,
      location_mode: locationForm.locationMode,
      itinerant_zone: locationForm.itinerantZone || null,
      description: description || null,
      bed_info: String(formData.get('bed_info') ?? '').trim() || null,
      bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
      catering_info: String(formData.get('catering_info') ?? '').trim() || null,
      accessibility_info: buildAccessibilityInfoFromForm(formData),
      slug: slugify(name),
      ai_extracted_data: null,
      status: 'DRAFT',
      validated_at: null,
      validated_by_user_id: null,
      center_latitude: centerCoordinatesResult.value.centerLatitude,
      center_longitude: centerCoordinatesResult.value.centerLongitude,
      map_iframe_html: normalizedMapIframeHtml,
      created_at: now,
      updated_at: now
    };

    let insertResult = await supabase.from('accommodations').insert(insertPayload).select('id').single();
    if (
      insertResult.error &&
      String(insertResult.error.message ?? '').toLowerCase().includes('map_iframe_html')
    ) {
      const { map_iframe_html: _mapIframeHtml, ...legacyInsertPayload } = insertPayload;
      insertResult = await supabase
        .from('accommodations')
        .insert({
          ...legacyInsertPayload,
          ai_extracted_data: mergeMapIframeHtmlIntoAiExtractedData(
            legacyInsertPayload.ai_extracted_data,
            normalizedMapIframeHtml
          ) as Json
        })
        .select('id')
        .single();
    }

    const insertedAccommodation = insertResult.data;
    const error = insertResult.error;

    if (error || !insertedAccommodation) {
      console.error('Erreur Supabase (create accommodation)', error?.message);
      await stashAccommodationFormDraft(formData);
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent(error?.message ?? "Insertion de l'hébergement impossible")}`,
          selectedOrganizerId
        )
      );
    }

    const mediaResult = await replaceAccommodationMedia({
      accommodationId: insertedAccommodation.id,
      urls: mediaUrls
    });

    if (mediaResult.error) {
      if (mapIframeInvalid) {
        await stashAccommodationFormDraft(formData);
      }
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${insertedAccommodation.id}?error=${encodeURIComponent(mediaResult.error)}${
            mapIframeInvalid ? '&iframe_warning=1' : ''
          }`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath('/sejours/[slug]', 'page');
    if (mapIframeInvalid) {
      await stashAccommodationFormDraft(formData);
    }
    redirect(
      withOrganizerQuery(
        `/organisme/hebergements/${insertedAccommodation.id}?saved=1${
          mapIframeInvalid ? '&iframe_warning=1' : ''
        }`,
        selectedOrganizerId
      )
    );
  }

  return (
    <div className="space-y-6">
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible d&apos;enregistrer l&apos;hébergement :{' '}
          {errorParam === 'missing-required-fields'
            ? 'renseignez au minimum le nom et le type.'
            : decodeURIComponent(errorParam)}
          {formDraft ? ' Vos saisies ont été conservées.' : null}
        </div>
      )}
      {iframeWarningParam === '1' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {INVALID_MAP_IFRAME_WARNING}
        </div>
      ) : null}

      <OrganizerPageHeader
        title="Nouvel hébergement"
        subtitle="Créez une fiche propre et réutilisable pour vos prochains séjours."
        actions={(
          <Link
            href={withOrganizerQuery('/organisme/hebergements', selectedOrganizerId)}
            className="organizer-btn-secondary"
          >
            Retour à la liste
          </Link>
        )}
      />

      <form action={createAccommodation} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <AccommodationFormFields
          key={formDraft ? `draft-${formDraft.name ?? 'empty'}-${formDraft.city ?? ''}` : 'blank'}
          values={formDraft ?? undefined}
          submitLabel="Créer l'hébergement"
        />
      </form>
    </div>
  );
}

import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields from '@/components/organisme/AccommodationFormFields';
import {
  buildAccommodationTypeValue,
  formatAccommodationType,
  parseAccommodationType
} from '@/components/organisme/accommodation-type';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import SavedToast from '@/components/common/SavedToast';
import {
  buildAccessibilityInfoFromForm,
  extractAccommodationLocationMeta,
  normalizeAccommodationAddress,
  readAccommodationLocationFromFormData,
  validateAccommodationFormLocation,
  validateAndParseAccommodationCenterCoordinates,
} from '@/lib/accommodation-location';
import { deleteAccommodationForOrganizer, parseAccommodationMediaUrls, replaceAccommodationMedia } from '@/lib/accommodations';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { accommodationStatusBadgeClassName, accommodationStatusLabel } from '@/lib/ui/labels';
import { slugify } from '@/lib/utils';
import type { Json } from '@/types/supabase';
import {
  buildGoogleMapsEmbedIframeHtml,
  extractGoogleMapsEmbedSrcFromInput,
  mergeMapIframeHtmlIntoAiExtractedData,
  readMapIframeHtmlFromAiExtractedData
} from '@/lib/google-maps-iframe';
import {
  consumeAccommodationFormDraft,
  INVALID_MAP_IFRAME_WARNING,
  stashAccommodationFormDraft
} from '@/lib/accommodation-form-draft.server';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    archived?: string | string[];
    unarchived?: string | string[];
    published?: string | string[];
    error?: string | string[];
    iframe_warning?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAccommodationImportedFromStayDraft(ai: unknown): boolean {
  if (!ai || typeof ai !== 'object' || Array.isArray(ai)) return false;
  const src = (ai as Record<string, unknown>).source;
  return src === 'stay_draft_publication' || src === 'stay_draft_save_preview';
}

export default async function AccommodationDetailPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { session, selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'accommodations'
  });
  const supabase = getServerSupabaseClient();
  const savedParam = Array.isArray(resolvedSearchParams?.saved)
    ? resolvedSearchParams?.saved[0]
    : resolvedSearchParams?.saved;
  const archivedParam = Array.isArray(resolvedSearchParams?.archived)
    ? resolvedSearchParams?.archived[0]
    : resolvedSearchParams?.archived;
  const unarchivedParam = Array.isArray(resolvedSearchParams?.unarchived)
    ? resolvedSearchParams?.unarchived[0]
    : resolvedSearchParams?.unarchived;
  const publishedParam = Array.isArray(resolvedSearchParams?.published)
    ? resolvedSearchParams?.published[0]
    : resolvedSearchParams?.published;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const iframeWarningParam = Array.isArray(resolvedSearchParams?.iframe_warning)
    ? resolvedSearchParams?.iframe_warning[0]
    : resolvedSearchParams?.iframe_warning;
  const showSavedBanner = savedParam === '1';
  const showArchivedBanner = archivedParam === '1';
  const showUnarchivedBanner = unarchivedParam === '1';
  const showPublishedBanner = publishedParam === '1';
  const formDraft = await consumeAccommodationFormDraft();

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const accommodationSelectWithMapIframe =
    'id,name,accommodation_type,location_mode,itinerant_zone,address_text,postal_code,city,department_code,region_text,country,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at,validated_by_user_id,organizer_id,ai_extracted_data,center_latitude,center_longitude,map_iframe_html';
  const accommodationSelectLegacy =
    'id,name,accommodation_type,location_mode,itinerant_zone,address_text,postal_code,city,department_code,region_text,country,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at,validated_by_user_id,organizer_id,ai_extracted_data,center_latitude,center_longitude';

  const primaryAccommodationResult = await supabase
    .from('accommodations')
    .select(accommodationSelectWithMapIframe)
    .eq('id', params.id)
    .maybeSingle();

  const fallbackToLegacy =
    primaryAccommodationResult.error &&
    String(primaryAccommodationResult.error.message ?? '').toLowerCase().includes('map_iframe_html');

  const legacyAccommodationResult = fallbackToLegacy
    ? await supabase.from('accommodations').select(accommodationSelectLegacy).eq('id', params.id).maybeSingle()
    : null;

  const accommodation = fallbackToLegacy
    ? legacyAccommodationResult?.data
      ? { ...legacyAccommodationResult.data, map_iframe_html: null }
      : null
    : primaryAccommodationResult.data;
  const { data: accommodationMedia } = await supabase
    .from('accommodation_media')
    .select('url,position')
    .eq('accommodation_id', params.id)
    .order('position', { ascending: true });

  if (!accommodation || accommodation.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/hebergements', selectedOrganizerId));
  }
  const currentAccommodationLocation = extractAccommodationLocationMeta(accommodation.description, {
    accommodationType: accommodation.accommodation_type,
    locationMode: accommodation.location_mode,
    itinerantZone: accommodation.itinerant_zone,
    addressText: accommodation.address_text,
    postalCode: accommodation.postal_code,
    city: accommodation.city,
    departmentCode: accommodation.department_code,
    regionText: accommodation.region_text,
    country: accommodation.country
  });
  const currentAccommodation = {
    ...accommodation,
    description: currentAccommodationLocation.description,
    location_mode: currentAccommodationLocation.locationMode,
    itinerant_zone: currentAccommodationLocation.itinerantZone,
    address_text: currentAccommodationLocation.addressText,
    postal_code: currentAccommodationLocation.postalCode,
    city: currentAccommodationLocation.city,
    department_code: currentAccommodationLocation.departmentCode,
    region_text: currentAccommodationLocation.regionText,
    country: currentAccommodationLocation.country,
    center_latitude: accommodation.center_latitude,
    center_longitude: accommodation.center_longitude,
    map_iframe_html:
      accommodation.map_iframe_html ?? readMapIframeHtmlFromAiExtractedData(accommodation.ai_extracted_data),
    media_urls: (accommodationMedia ?? []).map((item) => item.url)
  };

  const showImportRelectureBanner =
    currentAccommodation.status === 'TO_VALIDATE' ||
    (currentAccommodation.status === 'DRAFT' &&
      isAccommodationImportedFromStayDraft(currentAccommodation.ai_extracted_data));

  async function updateAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const { data: rowBeforeSave } = await supabase
      .from('accommodations')
      .select('status,ai_extracted_data,validated_at,validated_by_user_id')
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId)
      .maybeSingle();

    if (!rowBeforeSave) {
      redirect(withOrganizerQuery('/organisme/hebergements', selectedOrganizerId));
    }

    const name = String(formData.get('name') ?? '').trim();
    const locationForm = readAccommodationLocationFromFormData(formData);
    const accommodationType = buildAccommodationTypeValue(locationForm.accommodationType);
    const parsedAccommodationType = parseAccommodationType(accommodationType);

    if (!name || !parsedAccommodationType.baseType) {
      await stashAccommodationFormDraft(formData);
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=missing-fields`,
          selectedOrganizerId
        )
      );
    }

    const description = String(formData.get('description') ?? '').trim();
    const addressInput = normalizeAccommodationAddress(locationForm.address);
    const now = new Date().toISOString();
    const mapIframeRaw = String(formData.get('map_iframe_html') ?? '').trim();
    const mapEmbedSrc = extractGoogleMapsEmbedSrcFromInput(mapIframeRaw);
    const mapIframeInvalid = mapIframeRaw.length > 0 && !mapEmbedSrc;
    const normalizedMapIframeHtml =
      mapIframeRaw.length === 0 || mapIframeInvalid
        ? null
        : mapEmbedSrc
          ? buildGoogleMapsEmbedIframeHtml(mapEmbedSrc)
          : null;
    const importedFromDraft = isAccommodationImportedFromStayDraft(rowBeforeSave.ai_extracted_data);
    const nextStatus =
      rowBeforeSave.status === 'TO_VALIDATE' || (rowBeforeSave.status === 'DRAFT' && importedFromDraft)
        ? 'VALIDATED'
        : rowBeforeSave.status;
    const validatedByUserId = isUuid(session.userId) ? session.userId : null;
    const mediaUrls = parseAccommodationMediaUrls(formData.get('media_urls'));

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
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(addressError)}`,
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
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(centerCoordinatesResult.error)}`,
          selectedOrganizerId
        )
      );
    }

    const updatePayload = {
      name,
      accommodation_type: accommodationType,
      description: description || null,
      address_text: addressInput.addressText || null,
      postal_code: addressInput.postalCode || null,
      city: addressInput.city || null,
      department_code: addressInput.departmentCode || null,
      region_text: addressInput.regionText || null,
      country: addressInput.country || null,
      location_mode: locationForm.locationMode,
      itinerant_zone: locationForm.itinerantZone || null,
      bed_info: String(formData.get('bed_info') ?? '').trim() || null,
      bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
      catering_info: String(formData.get('catering_info') ?? '').trim() || null,
      accessibility_info: buildAccessibilityInfoFromForm(formData),
      slug: slugify(name),
      status: nextStatus,
      validated_at: nextStatus === 'VALIDATED' ? now : rowBeforeSave.validated_at,
      validated_by_user_id:
        nextStatus === 'VALIDATED' ? validatedByUserId : rowBeforeSave.validated_by_user_id,
      center_latitude: centerCoordinatesResult.value.centerLatitude,
      center_longitude: centerCoordinatesResult.value.centerLongitude,
      map_iframe_html: normalizedMapIframeHtml,
      updated_at: now
    };

    let updateResult = await supabase
      .from('accommodations')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId);
    if (
      updateResult.error &&
      String(updateResult.error.message ?? '').toLowerCase().includes('map_iframe_html')
    ) {
      const { map_iframe_html: _mapIframeHtml, ...legacyUpdatePayload } = updatePayload;
      const legacyUpdateWithMap = {
        ...legacyUpdatePayload,
        ai_extracted_data: mergeMapIframeHtmlIntoAiExtractedData(
          rowBeforeSave.ai_extracted_data,
          normalizedMapIframeHtml
        ) as Json
      };
      updateResult = await supabase
        .from('accommodations')
        .update(legacyUpdateWithMap)
        .eq('id', params.id)
        .eq('organizer_id', selectedOrganizerId);
    }
    const error = updateResult.error;

    if (error) {
      console.error('Erreur Supabase (update accommodation)', error.message);
      await stashAccommodationFormDraft(formData);
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    const mediaResult = await replaceAccommodationMedia({
      accommodationId: params.id,
      urls: mediaUrls
    });

    if (mediaResult.error) {
      if (mapIframeInvalid) {
        await stashAccommodationFormDraft(formData);
      }
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(mediaResult.error)}${
            mapIframeInvalid ? '&iframe_warning=1' : ''
          }`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath(`/organisme/hebergements/${params.id}`);
    revalidatePath('/sejours');
    revalidatePath('/sejours/[slug]', 'page');
    if (mapIframeInvalid) {
      await stashAccommodationFormDraft(formData);
    }
    redirect(
      withOrganizerQuery(
        `/organisme/hebergements/${params.id}?saved=1${mapIframeInvalid ? '&iframe_warning=1' : ''}`,
        selectedOrganizerId
      )
    );
  }

  async function publishAccommodation() {
    'use server';
    const supabase = getServerSupabaseClient();
    const { data: row } = await supabase
      .from('accommodations')
      .select('id,name,accommodation_type,status')
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId)
      .maybeSingle();

    if (!row) {
      redirect(withOrganizerQuery('/organisme/hebergements', selectedOrganizerId));
    }

    if (row.status === 'VALIDATED') {
      redirect(
        withOrganizerQuery(`/organisme/hebergements/${params.id}?published=1`, selectedOrganizerId)
      );
    }

    if (row.status === 'ARCHIVED') {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(
            'Désarchivez la fiche avant de la publier.'
          )}`,
          selectedOrganizerId
        )
      );
    }

    const name = String(row.name ?? '').trim();
    const parsedType = parseAccommodationType(String(row.accommodation_type ?? ''));
    if (!name || !parsedType.baseType) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(
            'Renseignez au minimum le nom et le type avant de publier.'
          )}`,
          selectedOrganizerId
        )
      );
    }

    const now = new Date().toISOString();
    const validatedByUserId = isUuid(session.userId) ? session.userId : null;
    const { error } = await supabase
      .from('accommodations')
      .update({
        status: 'VALIDATED',
        validated_at: now,
        validated_by_user_id: validatedByUserId,
        updated_at: now
      })
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId);

    if (error) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath(`/organisme/hebergements/${params.id}`);
    revalidatePath('/sejours');
    revalidatePath('/sejours/[slug]', 'page');
    redirect(
      withOrganizerQuery(`/organisme/hebergements/${params.id}?published=1`, selectedOrganizerId)
    );
  }

  async function deleteAccommodation() {
    'use server';
    const { error } = await deleteAccommodationForOrganizer({
      accommodationId: params.id,
      organizerId: selectedOrganizerId
    });

    if (error) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(error)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath('/sejours/[slug]', 'page');
    redirect(withOrganizerQuery('/organisme/hebergements?deleted=1', selectedOrganizerId));
  }

  async function toggleAccommodationArchive() {
    'use server';
    const supabase = getServerSupabaseClient();
    const nextStatus =
      currentAccommodation.status === 'ARCHIVED'
        ? currentAccommodation.validated_at
          ? 'VALIDATED'
          : 'DRAFT'
        : 'ARCHIVED';

    const { error } = await supabase
      .from('accommodations')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId);

    if (error) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath(`/organisme/hebergements/${params.id}`);
    revalidatePath('/sejours');
    revalidatePath('/sejours/[slug]', 'page');
    redirect(
      withOrganizerQuery(
        `/organisme/hebergements/${params.id}?${
          nextStatus === 'ARCHIVED' ? 'archived=1' : 'unarchived=1'
        }`,
        selectedOrganizerId
      )
    );
  }

  const formValues = formDraft
    ? {
        ...currentAccommodation,
        ...formDraft,
        center_latitude:
          formDraft.center_latitude !== undefined && formDraft.center_latitude !== null
            ? formDraft.center_latitude
            : currentAccommodation.center_latitude,
        center_longitude:
          formDraft.center_longitude !== undefined && formDraft.center_longitude !== null
            ? formDraft.center_longitude
            : currentAccommodation.center_longitude,
        media_urls: formDraft.media_urls ?? currentAccommodation.media_urls
      }
    : currentAccommodation;

  const accommodationStatus = String(currentAccommodation.status ?? '').trim().toUpperCase();
  const canPublishAccommodation =
    accommodationStatus === 'DRAFT' || accommodationStatus === 'TO_VALIDATE';

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche hébergement a bien été enregistrée." />}
      {showPublishedBanner && (
        <SavedToast message="L&apos;hébergement a bien été publié." clearParams={['published']} />
      )}
      {showArchivedBanner && <SavedToast message="La fiche hébergement a bien été archivée." />}
      {showUnarchivedBanner && <SavedToast message="La fiche hébergement a bien été désarchivée." />}
      {iframeWarningParam === '1' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {INVALID_MAP_IFRAME_WARNING}
        </div>
      ) : null}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorParam === 'missing-fields'
            ? 'Renseignez au minimum le nom et le type.'
            : decodeURIComponent(errorParam)}
          {formDraft ? ' Vos saisies ont été conservées.' : null}
        </div>
      )}

      <OrganizerPageHeader
        title={currentAccommodation.name}
        subtitle={`Type : ${formatAccommodationType(currentAccommodation.accommodation_type)}`}
        actions={(
          <>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accommodationStatusBadgeClassName(currentAccommodation.status)}`}
            >
              {accommodationStatusLabel(currentAccommodation.status)}
            </span>
            {canPublishAccommodation ? (
              <form action={publishAccommodation}>
                <button type="submit" className="organizer-btn-primary">
                  Publier l&apos;hébergement
                </button>
              </form>
            ) : null}
            <Link
              href={withOrganizerQuery('/organisme/hebergements', selectedOrganizerId)}
              className="organizer-btn-secondary"
            >
              Retour à la liste
            </Link>
          </>
        )}
      />

      {canPublishAccommodation ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Cette fiche est encore en brouillon. Une fois les informations complètes, cliquez sur{' '}
          <strong>Publier l&apos;hébergement</strong> pour la valider.
        </div>
      ) : null}

      {showImportRelectureBanner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cet hébergement a été créé automatiquement à partir d&apos;un séjour. Enregistre la fiche après relecture
          pour le marquer comme validé.
        </div>
      )}

      <form action={updateAccommodation} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <AccommodationFormFields
          key={formDraft ? `draft-${Date.now()}` : `saved-${currentAccommodation.updated_at}`}
          values={formValues}
          submitLabel="Enregistrer l'hébergement"
        />
      </form>

      <div className="flex flex-wrap justify-start gap-3 sm:justify-end">
        {canPublishAccommodation ? (
          <form action={publishAccommodation}>
            <button type="submit" className="organizer-btn-primary">
              Publier l&apos;hébergement
            </button>
          </form>
        ) : null}
        <form action={toggleAccommodationArchive}>
          <button
            className={`organizer-btn ${
              currentAccommodation.status === 'ARCHIVED'
                ? 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                : 'border border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            {currentAccommodation.status === 'ARCHIVED' ? 'Désarchiver la fiche' : 'Archiver la fiche'}
          </button>
        </form>
        <form action={deleteAccommodation}>
          <button className="organizer-btn-danger">
            Supprimer la fiche
          </button>
        </form>
      </div>
    </div>
  );
}

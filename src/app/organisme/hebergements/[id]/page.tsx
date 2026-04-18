import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields from '@/components/organisme/AccommodationFormFields';
import { formatAccommodationType } from '@/lib/accommodation-types';
import SavedToast from '@/components/common/SavedToast';
import {
  buildAccessibilityInfoFromForm,
  embedAccommodationLocationMeta,
  extractAccommodationLocationMeta,
  validateAndParseAccommodationCenterCoordinates,
  validateAccommodationLocation
} from '@/lib/accommodation-location';
import { deleteAccommodationForOrganizer } from '@/lib/accommodations';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { accommodationStatusBadgeClassName, accommodationStatusLabel } from '@/lib/ui/labels';
import { slugify } from '@/lib/utils';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    archived?: string | string[];
    unarchived?: string | string[];
    error?: string | string[];
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
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(resolvedSearchParams?.saved)
    ? resolvedSearchParams?.saved[0]
    : resolvedSearchParams?.saved;
  const archivedParam = Array.isArray(resolvedSearchParams?.archived)
    ? resolvedSearchParams?.archived[0]
    : resolvedSearchParams?.archived;
  const unarchivedParam = Array.isArray(resolvedSearchParams?.unarchived)
    ? resolvedSearchParams?.unarchived[0]
    : resolvedSearchParams?.unarchived;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const showSavedBanner = savedParam === '1';
  const showArchivedBanner = archivedParam === '1';
  const showUnarchivedBanner = unarchivedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: accommodation } = await supabase
    .from('accommodations')
    .select(
      'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,validated_at,validated_by_user_id,organizer_id,ai_extracted_data,center_latitude,center_longitude'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!accommodation || accommodation.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/hebergements', selectedOrganizerId));
  }
  const currentAccommodationLocation = extractAccommodationLocationMeta(accommodation.description);
  const currentAccommodation = {
    ...accommodation,
    description: currentAccommodationLocation.description,
    location_mode: currentAccommodationLocation.locationMode,
    location_city: currentAccommodationLocation.locationCity,
    location_department_code: currentAccommodationLocation.locationDepartmentCode,
    location_country: currentAccommodationLocation.locationCountry,
    itinerant_zone: currentAccommodationLocation.itinerantZone,
    center_latitude: accommodation.center_latitude,
    center_longitude: accommodation.center_longitude
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
    const accommodationType = String(formData.get('accommodation_type') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const locationInput = {
      locationMode: String(formData.get('location_mode') ?? '').trim(),
      locationCity: String(formData.get('location_city') ?? '').trim(),
      locationDepartmentCode: String(formData.get('location_department_code') ?? '').trim().slice(0, 2),
      locationCountry: String(formData.get('location_country') ?? '').trim(),
      itinerantZone: String(formData.get('itinerant_zone') ?? '').trim()
    };
    const now = new Date().toISOString();
    const importedFromDraft = isAccommodationImportedFromStayDraft(rowBeforeSave.ai_extracted_data);
    const nextStatus =
      rowBeforeSave.status === 'TO_VALIDATE' || (rowBeforeSave.status === 'DRAFT' && importedFromDraft)
        ? 'VALIDATED'
        : rowBeforeSave.status;
    const validatedByUserId = isUuid(session.userId) ? session.userId : null;

    if (!name || !accommodationType) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=missing-fields`,
          selectedOrganizerId
        )
      );
    }

    const locationError = validateAccommodationLocation(locationInput);
    if (locationError) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(locationError)}`,
          selectedOrganizerId
        )
      );
    }

    const centerCoordinatesResult = validateAndParseAccommodationCenterCoordinates({
      centerLatitude: String(formData.get('center_latitude') ?? '').trim(),
      centerLongitude: String(formData.get('center_longitude') ?? '').trim()
    });
    if (centerCoordinatesResult.error) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=${encodeURIComponent(centerCoordinatesResult.error)}`,
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase
      .from('accommodations')
      .update({
        name,
        accommodation_type: accommodationType,
        description: embedAccommodationLocationMeta(description, locationInput),
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
        updated_at: now
      })
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId);

    if (error) {
      console.error('Erreur Supabase (update accommodation)', error.message);
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
    redirect(withOrganizerQuery(`/organisme/hebergements/${params.id}?saved=1`, selectedOrganizerId));
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
    redirect(
      withOrganizerQuery(
        `/organisme/hebergements/${params.id}?${
          nextStatus === 'ARCHIVED' ? 'archived=1' : 'unarchived=1'
        }`,
        selectedOrganizerId
      )
    );
  }

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche hébergement a bien été enregistrée." />}
      {showArchivedBanner && <SavedToast message="La fiche hébergement a bien été archivée." />}
      {showUnarchivedBanner && <SavedToast message="La fiche hébergement a bien été désarchivée." />}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{currentAccommodation.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Type : {formatAccommodationType(currentAccommodation.accommodation_type)}</span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accommodationStatusBadgeClassName(currentAccommodation.status)}`}
            >
              {accommodationStatusLabel(currentAccommodation.status)}
            </span>
          </div>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/hebergements', selectedOrganizerId)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la liste
        </Link>
      </div>

      {showImportRelectureBanner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cet hébergement a été créé automatiquement à partir d&apos;un séjour. Enregistre la fiche après relecture
          pour le marquer comme validé.
        </div>
      )}

      <form action={updateAccommodation} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <AccommodationFormFields values={currentAccommodation} submitLabel="Enregistrer l'hébergement" />
      </form>

      <div className="flex flex-wrap justify-start gap-3 sm:justify-end">
        <form action={toggleAccommodationArchive}>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              currentAccommodation.status === 'ARCHIVED'
                ? 'border border-emerald-200 text-emerald-700'
                : 'border border-amber-200 text-amber-700'
            }`}
          >
            {currentAccommodation.status === 'ARCHIVED' ? 'Désarchiver la fiche' : 'Archiver la fiche'}
          </button>
        </form>
        <form action={deleteAccommodation}>
          <button className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">
            Supprimer la fiche
          </button>
        </form>
      </div>
    </div>
  );
}

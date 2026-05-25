import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields from '@/components/organisme/AccommodationFormFields';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { parseAccommodationMediaUrls, replaceAccommodationMedia } from '@/lib/accommodations';
import {
  buildAccessibilityInfoFromForm,
  normalizeAccommodationAddress,
  validateAccommodationAddress,
  validateAndParseAccommodationCenterCoordinates,
} from '@/lib/accommodation-location';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import type { Json } from '@/types/supabase';
import {
  buildGoogleMapsEmbedIframeHtml,
  extractGoogleMapsEmbedSrcFromInput,
  mergeMapIframeHtmlIntoAiExtractedData
} from '@/lib/google-maps-iframe';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
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

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  async function createAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const name = String(formData.get('name') ?? '').trim();
    const accommodationType = String(formData.get('accommodation_type') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const addressInput = normalizeAccommodationAddress({
      addressText: String(formData.get('address_text') ?? '').trim(),
      postalCode: String(formData.get('postal_code') ?? '').trim(),
      city: String(formData.get('city') ?? '').trim(),
      departmentCode: String(formData.get('department_code') ?? '').trim(),
      regionText: String(formData.get('region_text') ?? '').trim(),
      country: String(formData.get('country') ?? '').trim()
    });

    if (!name || !accommodationType) {
      redirect(withOrganizerQuery('/organisme/hebergements/new?error=missing-required-fields', selectedOrganizerId));
    }

    const addressError = validateAccommodationAddress(addressInput);
    if (addressError) {
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
    const normalizedMapIframeHtml =
      mapIframeRaw.length === 0 ? null : mapEmbedSrc ? buildGoogleMapsEmbedIframeHtml(mapEmbedSrc) : null;

    if (mapIframeRaw.length > 0 && !mapEmbedSrc) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent('Code iframe Google Maps invalide. Utilisez un embed https://www.google.com/maps/.../embed.')}`,
          selectedOrganizerId
        )
      );
    }

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
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent(mediaResult.error)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    revalidatePath('/sejours');
    revalidatePath('/sejours/[slug]', 'page');
    redirect(withOrganizerQuery('/organisme/hebergements?saved=1', selectedOrganizerId));
  }

  return (
    <div className="space-y-6">
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible d&apos;enregistrer l&apos;hébergement : {decodeURIComponent(errorParam)}
        </div>
      )}

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
        <AccommodationFormFields submitLabel="Créer l'hébergement" />
      </form>
    </div>
  );
}

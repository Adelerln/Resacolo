import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields from '@/components/organisme/AccommodationFormFields';
import {
  buildAccessibilityInfoFromForm,
  embedAccommodationLocationMeta,
  validateAccommodationLocation
} from '@/lib/accommodation-location';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

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
  const session = await requireRole('ORGANISATEUR');
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
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
    const locationInput = {
      locationMode: String(formData.get('location_mode') ?? '').trim(),
      locationCity: String(formData.get('location_city') ?? '').trim(),
      locationDepartmentCode: String(formData.get('location_department_code') ?? '').trim().slice(0, 2),
      locationCountry: String(formData.get('location_country') ?? '').trim(),
      itinerantZone: String(formData.get('itinerant_zone') ?? '').trim()
    };

    if (!name || !accommodationType) {
      redirect(withOrganizerQuery('/organisme/hebergements/new?error=missing-required-fields', selectedOrganizerId));
    }

    const locationError = validateAccommodationLocation(locationInput);
    if (locationError) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent(locationError)}`,
          selectedOrganizerId
        )
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('accommodations').insert({
      organizer_id: selectedOrganizerId,
      name,
      accommodation_type: accommodationType,
      description: embedAccommodationLocationMeta(description, locationInput),
      bed_info: String(formData.get('bed_info') ?? '').trim() || null,
      bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
      catering_info: String(formData.get('catering_info') ?? '').trim() || null,
      accessibility_info: buildAccessibilityInfoFromForm(formData),
      slug: slugify(name),
      ai_extracted_data: null,
      status: 'DRAFT',
      validated_at: null,
      validated_by_user_id: null,
      created_at: now,
      updated_at: now
    });

    if (error) {
      console.error('Erreur Supabase (create accommodation)', error.message);
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/new?error=${encodeURIComponent(error.message)}`,
          selectedOrganizerId
        )
      );
    }

    revalidatePath('/organisme/hebergements');
    revalidatePath('/organisme/sejours');
    revalidatePath('/organisme/stays');
    redirect(withOrganizerQuery('/organisme/hebergements?saved=1', selectedOrganizerId));
  }

  return (
    <div className="space-y-6">
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible d&apos;enregistrer l&apos;hébergement : {decodeURIComponent(errorParam)}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nouvel hébergement</h1>
          <p className="text-sm text-slate-600">
            {selectedOrganizer
              ? `Création d'un hébergement pour ${selectedOrganizer.name}.`
              : 'Création d’un hébergement.'}
          </p>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/hebergements', selectedOrganizerId)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la liste
        </Link>
      </div>

      <form action={createAccommodation} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <AccommodationFormFields submitLabel="Créer l'hébergement" />
      </form>
    </div>
  );
}

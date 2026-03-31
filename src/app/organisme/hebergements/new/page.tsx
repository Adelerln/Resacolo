import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields from '@/components/organisme/AccommodationFormFields';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = {
  searchParams?: {
    organizerId?: string | string[];
    error?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewAccommodationPage({ searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const errorParam = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  async function createAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const name = String(formData.get('name') ?? '').trim();
    const accommodationType = String(formData.get('accommodation_type') ?? '').trim();

    if (!name || !accommodationType) {
      redirect(withOrganizerQuery('/organisme/hebergements/new?error=missing-required-fields', selectedOrganizerId));
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('accommodations').insert({
      organizer_id: selectedOrganizerId,
      name,
      accommodation_type: accommodationType,
      description: String(formData.get('description') ?? '').trim() || null,
      bed_info: String(formData.get('bed_info') ?? '').trim() || null,
      bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
      catering_info: String(formData.get('catering_info') ?? '').trim() || null,
      accessibility_info: String(formData.get('accessibility_info') ?? '').trim() || null,
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

      <div className="flex items-center justify-between gap-4">
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
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la liste
        </Link>
      </div>

      <form action={createAccommodation} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <AccommodationFormFields submitLabel="Créer l'hébergement" />
      </form>
    </div>
  );
}

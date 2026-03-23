import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AccommodationFormFields, { formatAccommodationType } from '@/components/organisme/AccommodationFormFields';
import SavedToast from '@/components/common/SavedToast';
import { deleteAccommodationForOrganizer } from '@/lib/accommodations';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccommodationDetailPage({ params, searchParams }: PageProps) {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    searchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : searchParams?.saved;
  const errorParam = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const showSavedBanner = savedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: accommodation } = await supabase
    .from('accommodations')
    .select(
      'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at,organizer_id'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!accommodation || accommodation.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/hebergements', selectedOrganizerId));
  }

  async function updateAccommodation(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const name = String(formData.get('name') ?? '').trim();
    const accommodationType = String(formData.get('accommodation_type') ?? '').trim();

    if (!name || !accommodationType) {
      redirect(
        withOrganizerQuery(
          `/organisme/hebergements/${params.id}?error=missing-fields`,
          selectedOrganizerId
        )
      );
    }

    const { error } = await supabase
      .from('accommodations')
      .update({
        name,
        accommodation_type: accommodationType,
        description: String(formData.get('description') ?? '').trim() || null,
        bed_info: String(formData.get('bed_info') ?? '').trim() || null,
        bathroom_info: String(formData.get('bathroom_info') ?? '').trim() || null,
        catering_info: String(formData.get('catering_info') ?? '').trim() || null,
        accessibility_info: String(formData.get('accessibility_info') ?? '').trim() || null,
        slug: slugify(name),
        updated_at: new Date().toISOString()
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

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche hébergement a bien été enregistrée." />}
      {errorParam && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{accommodation.name}</h1>
          <p className="text-sm text-slate-600">
            Type : {formatAccommodationType(accommodation.accommodation_type)} · Statut : {accommodation.status}
          </p>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/hebergements', selectedOrganizerId)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la liste
        </Link>
      </div>

      <form action={updateAccommodation} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <AccommodationFormFields values={accommodation} submitLabel="Enregistrer l'hébergement" />
      </form>

      <div className="flex justify-end">
        <form action={deleteAccommodation}>
          <button className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">
            Supprimer la fiche
          </button>
        </form>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/require';
import PartnerContactsSection from '@/components/partner/PartnerContactsSection';
import PartnerOfferHelp from '@/components/partner/PartnerOfferHelp';
import PartnerProfileFormEnhancer from '@/components/partner/PartnerProfileFormEnhancer';
import {
  isPartnerContactsTableAvailable,
  listPartnerContacts,
  readPartnerCollectivity
} from '@/lib/partner.server';
import { normalizePartnerOffer, PARTNER_OFFER_LABELS } from '@/lib/partner-offers';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
  }>;
};

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 transition-colors';
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function sanitizeRedirectQueryValue(value: string | undefined) {
  return value ? decodeURIComponent(value) : null;
}

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

async function syncLegacyCollectivityContactFields(collectivityId: string) {
  const supabase = getServerSupabaseClient();
  const { data: contacts, error: contactsError } = await supabase
    .from('collectivity_contacts')
    .select('full_name,email,phone')
    .eq('collectivity_id', collectivityId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (contactsError) {
    if (isCollectivityContactsTableMissingError(contactsError)) {
      return;
    }
    throw new Error(contactsError.message);
  }

  const primaryContact = contacts?.[0] ?? null;
  const { error: updateError } = await supabase
    .from('collectivities')
    .update({
      contact_name: primaryContact?.full_name ?? null,
      contact_email: primaryContact?.email ?? null,
      contact_phone: primaryContact?.phone ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', collectivityId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default async function PartnerProfilePage({ searchParams }: PageProps) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const params = searchParams ? await searchParams : undefined;

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Fiche partenaire</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  async function updatePartnerProfile(formData: FormData) {
    'use server';

    const session = await requirePartner();
    const collectivityId = session.tenantId;
    if (!collectivityId) {
      redirect('/partenaire/fiche?error=Aucune%20collectivite%20liee');
    }

    const name = String(formData.get('name') ?? '').trim();
    const code = String(formData.get('code') ?? '').trim();

    if (!name || !code) {
      redirect('/partenaire/fiche?error=Le%20nom%20et%20le%20code%20de%20rattachement%20sont%20obligatoires');
    }

    const supabase = getServerSupabaseClient();

    const { error } = await supabase
      .from('collectivities')
      .update({
        name,
        code,
        offer_mode: String(formData.get('offer_mode') ?? '').trim() || 'MANUAL',
        address_line1: normalizeOptionalString(formData.get('address_line1')),
        address_line2: normalizeOptionalString(formData.get('address_line2')),
        postal_code: normalizeOptionalString(formData.get('postal_code')),
        city: normalizeOptionalString(formData.get('city')),
        country: normalizeOptionalString(formData.get('country')) ?? 'France',
        website_url: normalizeOptionalString(formData.get('website_url')),
        description: normalizeOptionalString(formData.get('description')),
        attachment_instructions: normalizeOptionalString(formData.get('attachment_instructions')),
        updated_at: new Date().toISOString()
      })
      .eq('id', collectivityId);

    if (error) {
      redirect(`/partenaire/fiche?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath('/partenaire/fiche');
    revalidatePath('/partenaire/beneficiaires');
    revalidatePath('/partenaire/reservations');
    redirect('/partenaire/fiche?saved=1');
  }

  async function addPartnerContact(formData: FormData) {
    'use server';

    const session = await requirePartner();
    const collectivityId = session.tenantId;
    if (!collectivityId) {
      redirect('/partenaire/fiche?error=Aucune%20collectivite%20liee');
    }

    const fullName = String(formData.get('full_name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const roleLabel = normalizeOptionalString(formData.get('role_label'));
    const phone = normalizeOptionalString(formData.get('phone'));
    const wantsPrimary = formData.get('is_primary') === 'on';

    if (!fullName || !email) {
      redirect('/partenaire/fiche?error=Le%20nom%20et%20l%27email%20du%20contact%20sont%20obligatoires');
    }

    const supabase = getServerSupabaseClient();
    const { data: existingContacts, error: existingContactsError } = await supabase
      .from('collectivity_contacts')
      .select('id')
      .eq('collectivity_id', collectivityId)
      .limit(1);

    if (existingContactsError) {
      if (isCollectivityContactsTableMissingError(existingContactsError)) {
        redirect('/partenaire/fiche?error=La%20table%20des%20contacts%20n%27est%20pas%20encore%20visible%20par%20Supabase.%20Rechargez%20la%20page%20dans%20un%20instant.');
      }
      redirect(`/partenaire/fiche?error=${encodeURIComponent(existingContactsError.message)}`);
    }

    const shouldBePrimary = wantsPrimary || (existingContacts?.length ?? 0) === 0;

    if (shouldBePrimary) {
      const { error: resetPrimaryError } = await supabase
        .from('collectivity_contacts')
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('collectivity_id', collectivityId)
        .eq('is_primary', true);

      if (resetPrimaryError) {
        redirect(`/partenaire/fiche?error=${encodeURIComponent(resetPrimaryError.message)}`);
      }
    }

    const { error } = await supabase.from('collectivity_contacts').insert({
      collectivity_id: collectivityId,
      full_name: fullName,
      role_label: roleLabel,
      email,
      phone,
      is_primary: shouldBePrimary
    });

    if (error) {
      redirect(`/partenaire/fiche?error=${encodeURIComponent(error.message)}`);
    }

    try {
      await syncLegacyCollectivityContactFields(collectivityId);
    } catch (error) {
      redirect(
        `/partenaire/fiche?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Impossible de synchroniser le contact principal'
        )}`
      );
    }

    revalidatePath('/partenaire/fiche');
    redirect('/partenaire/fiche?saved=1');
  }

  async function deletePartnerContact(formData: FormData) {
    'use server';

    const session = await requirePartner();
    const collectivityId = session.tenantId;
    if (!collectivityId) {
      redirect('/partenaire/fiche?error=Aucune%20collectivite%20liee');
    }

    const contactId = String(formData.get('contact_id') ?? '').trim();
    if (!contactId) {
      redirect('/partenaire/fiche?error=Contact%20introuvable');
    }

    const supabase = getServerSupabaseClient();
    const { data: targetContact, error: targetContactError } = await supabase
      .from('collectivity_contacts')
      .select('id,is_primary')
      .eq('id', contactId)
      .eq('collectivity_id', collectivityId)
      .maybeSingle();

    if (targetContactError) {
      if (isCollectivityContactsTableMissingError(targetContactError)) {
        redirect('/partenaire/fiche?error=La%20table%20des%20contacts%20n%27est%20pas%20encore%20visible%20par%20Supabase.%20Rechargez%20la%20page%20dans%20un%20instant.');
      }
      redirect(`/partenaire/fiche?error=${encodeURIComponent(targetContactError.message)}`);
    }
    if (!targetContact) {
      redirect('/partenaire/fiche?error=Contact%20introuvable');
    }

    const { error: deleteError } = await supabase
      .from('collectivity_contacts')
      .delete()
      .eq('id', contactId)
      .eq('collectivity_id', collectivityId);

    if (deleteError) {
      redirect(`/partenaire/fiche?error=${encodeURIComponent(deleteError.message)}`);
    }

    if (targetContact.is_primary) {
      const { data: nextContact, error: nextContactError } = await supabase
        .from('collectivity_contacts')
        .select('id')
        .eq('collectivity_id', collectivityId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextContactError) {
        redirect(`/partenaire/fiche?error=${encodeURIComponent(nextContactError.message)}`);
      }

      if (nextContact) {
        const { error: promoteError } = await supabase
          .from('collectivity_contacts')
          .update({ is_primary: true, updated_at: new Date().toISOString() })
          .eq('id', nextContact.id);

        if (promoteError) {
          redirect(`/partenaire/fiche?error=${encodeURIComponent(promoteError.message)}`);
        }
      }
    }

    try {
      await syncLegacyCollectivityContactFields(collectivityId);
    } catch (error) {
      redirect(
        `/partenaire/fiche?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Impossible de synchroniser le contact principal'
        )}`
      );
    }

    revalidatePath('/partenaire/fiche');
    redirect('/partenaire/fiche?saved=1');
  }

  const collectivity = await readPartnerCollectivity(collectivityId);
  const contacts = await listPartnerContacts(collectivityId);
  const contactsTableAvailable = await isPartnerContactsTableAvailable(collectivityId);
  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';
  const normalizedOffer = normalizePartnerOffer(collectivity.offer_mode);
  const formResetToken = `${params?.saved ?? ''}:${params?.error ?? ''}:${collectivity.updated_at}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Fiche partenaire</h1>
        <p className="admin-page-subtitle mt-1">
          Renseignez les informations visibles et le code de rattachement destiné à vos ayants-droit.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}
      {isSaved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Fiche partenaire enregistrée.
        </p>
      ) : null}

      <form id="partner-profile-form" action={updatePartnerProfile} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Identité</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Nom du partenaire *
              <input name="name" defaultValue={collectivity.name} className={fieldClassName()} required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Code de rattachement *
              <input name="code" defaultValue={collectivity.code} className={fieldClassName()} required />
              <span className="mt-1 block text-xs text-slate-500">
                Code à saisir par les ayants-droit dans leur compte ou pendant la commande.
              </span>
            </label>
            <div className="text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span>Mode d&apos;offre</span>
                <PartnerOfferHelp offer={normalizedOffer} />
              </div>
              <select disabled value={normalizedOffer} className={fieldClassName()}>
                {Object.entries(PARTNER_OFFER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input type="hidden" name="offer_mode" value={normalizedOffer} />
            </div>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Description
              <textarea
                name="description"
                defaultValue={collectivity.description ?? ''}
                rows={4}
                className={fieldClassName()}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Adresse postale</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              N° et voie
              <input name="address_line1" defaultValue={collectivity.address_line1 ?? ''} className={fieldClassName()} />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Complément d&apos;adresse
              <input name="address_line2" defaultValue={collectivity.address_line2 ?? ''} className={fieldClassName()} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Code postal
              <input name="postal_code" defaultValue={collectivity.postal_code ?? ''} className={fieldClassName()} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Ville
              <input name="city" defaultValue={collectivity.city ?? ''} className={fieldClassName()} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Pays
              <input name="country" defaultValue={collectivity.country ?? 'France'} className={fieldClassName()} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Contacts</h2>
          <p className="admin-page-subtitle mt-1">
            Gérez les interlocuteurs du partenaire. Le contact principal alimente les champs de compatibilité existants.
          </p>
          <div className="mt-4">
            <PartnerContactsSection
              contacts={contacts}
              contactsTableAvailable={contactsTableAvailable}
              addContactAction={addPartnerContact}
              deleteContactAction={deletePartnerContact}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Rattachement et liens</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Site web
              <input name="website_url" defaultValue={collectivity.website_url ?? ''} className={fieldClassName()} />
            </label>
            <div />
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Instructions de rattachement
              <textarea
                name="attachment_instructions"
                defaultValue={collectivity.attachment_instructions ?? ''}
                rows={4}
                className={fieldClassName()}
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white lg:hidden">
            Enregistrer la fiche partenaire
          </button>
        </div>
      </form>
      <PartnerProfileFormEnhancer formId="partner-profile-form" resetToken={formResetToken} />
    </div>
  );
}

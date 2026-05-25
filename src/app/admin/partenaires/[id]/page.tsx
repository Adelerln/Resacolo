import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { AdminPartnerMembersSection } from '@/components/admin/AdminPartnerMembersSection';
import {
  normalizePartnerOffer,
  PARTNER_OFFER_LABELS,
  PARTNER_OFFER_VALUES
} from '@/lib/partner-offers';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string | string[];
    success?: string | string[];
    openMemberModal?: string | string[];
    memberId?: string | string[];
  }>;
};

function sanitizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function splitFullName(value: string | null | undefined) {
  const clean = (value ?? '').trim();
  if (!clean) return { firstName: null, lastName: null };
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2';
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default async function AdminPartnerEditPage({ params, searchParams }: PageProps) {
  await requireRole('ADMIN');
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorParam = sanitizeQueryValue(resolvedSearchParams?.error);
  const successParam = sanitizeQueryValue(resolvedSearchParams?.success);
  const openMemberModalParam = sanitizeQueryValue(resolvedSearchParams?.openMemberModal);
  const selectedMemberIdParam = sanitizeQueryValue(resolvedSearchParams?.memberId);
  const partnerId = id;
  const supabase = getServerSupabaseClient();

  const { data: collectivity, error } = await supabase
    .from('collectivities')
    .select(
      'id,name,code,offer_mode,contact_name,contact_email,created_at,updated_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-rose-700">Impossible de charger le partenaire: {error.message}</p>;
  }
  if (!collectivity) {
    redirect('/admin/partenaires');
  }

  const [{ data: membersRaw }, contactsResponse] = await Promise.all([
    supabase
      .from('collectivity_members')
      .select('id,role,user_id,created_at')
      .eq('collectivity_id', collectivity.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('collectivity_contacts')
      .select('id,full_name,email,is_primary,role_label')
      .eq('collectivity_id', collectivity.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
  ]);

  const contacts =
    contactsResponse.error && isCollectivityContactsTableMissingError(contactsResponse.error)
      ? []
      : (contactsResponse.data ?? []);
  const contactsByEmail = new Map(
    contacts.map((contact) => [contact.email.trim().toLowerCase(), contact])
  );

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      const user = userData?.user ?? null;
      const email = user?.email?.trim().toLowerCase() ?? null;
      const metadataFullName =
        user?.user_metadata?.full_name?.trim() || user?.user_metadata?.name?.trim() || null;
      const contact = email ? contactsByEmail.get(email) ?? null : null;
      const { firstName, lastName } = splitFullName(contact?.full_name ?? metadataFullName);
      return {
        ...member,
        email,
        first_name: firstName,
        last_name: lastName
      };
    })
  );

  const successMessage =
    successParam === 'general-saved'
      ? 'Informations partenaire enregistrées.'
      : successParam === 'member-added'
          ? 'Utilisateur partenaire ajouté.'
          : successParam === 'member-updated'
            ? 'Utilisateur partenaire mis à jour.'
            : successParam === 'member-deleted'
              ? 'Utilisateur partenaire supprimé.'
              : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/partenaires" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            ← Liste des partenaires
          </Link>
          <h1 className="admin-page-title mt-1">{collectivity.name}</h1>
          <p className="admin-page-subtitle">
            {collectivity.contact_email ?? '—'} · Offre {PARTNER_OFFER_LABELS[normalizePartnerOffer(collectivity.offer_mode)]}
          </p>
        </div>
      </div>

      {errorParam ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorParam}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <form action={`/api/admin/partners/${partnerId}`} method="post" className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <input type="hidden" name="_intent" value="general" />
        <div>
          <h2 className="admin-section-title">Informations générales</h2>
          <p className="admin-page-subtitle mt-1 text-xs">Nom, code, offre et email principal visibles côté back-office.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-400">Créé le</div>
            <div className="font-medium text-slate-900">
              {new Date(collectivity.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nom du partenaire
            <input name="name" required defaultValue={collectivity.name} className={fieldClassName()} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Code de rattachement
            <input
              name="code"
              required
              defaultValue={collectivity.code}
              className={`${fieldClassName()} uppercase`}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Offre
            <select name="offer_mode" defaultValue={normalizePartnerOffer(collectivity.offer_mode)} className={fieldClassName()}>
              {PARTNER_OFFER_VALUES.map((offer) => (
                <option key={offer} value={offer}>
                  {PARTNER_OFFER_LABELS[offer]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email principal
            <input
              name="contact_email"
              type="email"
              required
              defaultValue={collectivity.contact_email ?? ''}
              className={fieldClassName()}
            />
          </label>
        </div>
        <div className="flex items-center justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div>
          <h2 className="admin-section-title">Utilisateurs partenaires</h2>
          <p className="admin-page-subtitle mt-1 text-xs">
            Admin : accès à toutes les pages. Gestion bénéficiaires et réservations : dashboard,
            bénéficiaires et réservations uniquement.
          </p>
        </div>
        <AdminPartnerMembersSection
          partnerId={partnerId}
          members={members}
          initialMode={
            openMemberModalParam === 'add' || openMemberModalParam === 'edit'
              ? openMemberModalParam
              : null
          }
          initialMemberId={selectedMemberIdParam}
        />
      </section>
    </div>
  );
}

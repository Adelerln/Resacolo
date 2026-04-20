import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { ORGANIZER_ACCESS_ROLE_VALUES } from '@/lib/organizer-access';
import { extractOrganizerDurationMeta } from '@/lib/organizer-rich-text';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const organizerSelect =
  'id,name,contact_email,created_at,description,hero_intro_text,founded_year,age_min,age_max,logo_path,logo_url,website_url,education_project_path,slug,is_founding_member,is_resacolo_member,profile_completeness_percent' as const;

type OrganizerDetail = Database['public']['Tables']['organizers']['Row'];
type OverviewRow = Database['public']['Views']['organizer_admin_overview']['Row'];
type BillingRow = Database['public']['Tables']['organizer_billing_settings']['Row'];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string; billingSuccess?: string }>;
};

function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function AdminOrganizerDetailPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  let { data: organizer } = await supabase
    .from('organizers')
    .select(organizerSelect)
    .eq('slug', params.id)
    .maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select(organizerSelect)
      .eq('id', params.id)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    notFound();
  }

  const row = organizer as OrganizerDetail;
  const organizerDescriptionMeta = extractOrganizerDurationMeta(row.description);

  const organizerSlug = row.slug ?? row.id;

  const [{ data: overview }, { data: billing }] = await Promise.all([
    supabase.from('organizer_admin_overview').select('*').eq('id', row.id).maybeSingle(),
    supabase.from('organizer_billing_settings').select('*').eq('organizer_id', row.id).maybeSingle()
  ]);

  const metrics = overview as OverviewRow | null;
  const billingRow = billing as BillingRow | null;

  const { data: membersRaw } = await supabase
    .from('organizer_members')
    .select('id,role,user_id,created_at,first_name,last_name')
    .eq('organizer_id', row.id)
    .order('created_at', { ascending: true });

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return { ...member, email: userData?.user?.email ?? null };
    })
  );

  const signedLogoUrl = row.logo_path
    ? (await supabase.storage
        .from('organizer-logo')
        .createSignedUrl(row.logo_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const displayLogoSrc = row.logo_url?.trim() ? row.logo_url.trim() : signedLogoUrl;
  const projectUrl = row.education_project_path
    ? (await supabase.storage
        .from('organizer-docs')
        .createSignedUrl(row.education_project_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const hasProject = Boolean(row.education_project_path);

  const defaultCommission =
    billingRow?.commission_percent ?? num(metrics?.commission_percent);
  const defaultFeeEuros =
    (billingRow?.publication_fee_cents ?? num(metrics?.publication_fee_cents)) / 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/organizers"
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            ← Liste des organismes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{row.name}</h1>
          <p className="text-sm text-slate-600">{row.contact_email ?? '—'}</p>
        </div>
      </div>

      {resolvedSearchParams?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolvedSearchParams.error}
        </div>
      )}
      {resolvedSearchParams?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Fiche organisme enregistrée.
        </div>
      )}
      {resolvedSearchParams?.billingSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Paramètres de facturation enregistrés.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Indicateurs</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <dt className="text-xs font-medium uppercase text-slate-500">Complétude profil</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {num(row.profile_completeness_percent ?? metrics?.profile_completeness_percent).toFixed(0)} %
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <dt className="text-xs font-medium uppercase text-slate-500">Séjours</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {num(metrics?.stays_count)}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <dt className="text-xs font-medium uppercase text-slate-500">Séjours publiés</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {num(metrics?.published_stays_count)}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <dt className="text-xs font-medium uppercase text-slate-500">Ventes (lignes)</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {num(metrics?.sales_count)}
            </dd>
          </div>
        </dl>
      </section>

      <form
        action={`/api/admin/organizers/${organizerSlug}`}
        method="post"
        encType="multipart/form-data"
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:p-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Informations générales</h2>
          <p className="mt-1 text-xs text-slate-500">
            Données visibles côté ResaColo ; le logo fichier reste dans le stockage si téléversé.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-400">Créé le</div>
            <div className="font-medium text-slate-900">
              {new Date(row.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nom
            <input
              name="name"
              defaultValue={row.name}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email de contact
            <input
              name="contact_email"
              type="email"
              defaultValue={row.contact_email ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Site web (URL)
          <input
            name="website_url"
            type="url"
            placeholder="https://"
            defaultValue={row.website_url ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          URL logo public (optionnel)
          <input
            name="logo_url"
            type="url"
            placeholder="https://…"
            defaultValue={row.logo_url ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Si renseignée, cette URL est utilisée en priorité pour l’aperçu ci-dessous.
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            name="description"
            rows={4}
            defaultValue={organizerDescriptionMeta.description ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">Statut organisme</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-8">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="is_founding_member"
                defaultChecked={row.is_founding_member}
                className="h-4 w-4 rounded border-slate-300"
              />
              Fondateur ResaColo
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="is_resacolo_member"
                defaultChecked={row.is_resacolo_member}
                className="h-4 w-4 rounded border-slate-300"
              />
              Membre ResoColo
            </label>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h2 className="text-base font-semibold text-slate-900">Complément catalogue</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Année de création
              <input
                name="founded_year"
                type="number"
                min="1900"
                max="2100"
                defaultValue={row.founded_year ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge min
              <input
                name="age_min"
                type="number"
                min="0"
                defaultValue={row.age_min ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge max
              <input
                name="age_max"
                type="number"
                min="0"
                defaultValue={row.age_max ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Texte sous le titre
            <textarea
              name="hero_intro_text"
              rows={3}
              defaultValue={row.hero_intro_text ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="block text-sm font-medium text-slate-700">
            <span>Logo fichier (PNG/JPG)</span>
            {displayLogoSrc ? (
              <div className="mt-2 space-y-1" suppressHydrationWarning>
                <div className="text-xs text-slate-500">Aperçu</div>
                {row.logo_url?.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayLogoSrc}
                    alt={row.name}
                    className="h-16 w-auto max-w-full rounded-lg border object-contain"
                  />
                ) : (
                  <Image
                    src={displayLogoSrc}
                    alt={row.name}
                    width={160}
                    height={64}
                    unoptimized
                    className="h-16 w-auto max-w-full rounded-lg border object-contain"
                  />
                )}
                {signedLogoUrl ? (
                  <button
                    type="submit"
                    form="delete-logo-form"
                    className="inline-flex items-center text-xs font-semibold text-red-600"
                  >
                    Supprimer le logo fichier
                  </button>
                ) : null}
              </div>
            ) : (
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            )}
          </div>
          <div className="block text-sm font-medium text-slate-700">
            <span>Projet éducatif (PDF)</span>
            {hasProject ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-100 text-red-600">
                  <span className="text-xs font-bold">PDF</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="truncate text-sm font-medium text-slate-800">Projet éducatif</div>
                  {projectUrl && (
                    <a
                      className="inline-flex text-xs font-medium text-brand-600"
                      href={projectUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Télécharger le PDF actuel
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  formAction={`/api/admin/organizers/${organizerSlug}/project/delete`}
                  formMethod="post"
                  className="ml-2 text-xs font-semibold text-red-600"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <div className="mt-1">
                <input
                  name="education_project"
                  type="file"
                  accept="application/pdf"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer la fiche
          </button>
        </div>
      </form>

      <form
        action={`/api/admin/organizers/${organizerSlug}/billing`}
        method="post"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">Paramètres de facturation (admin)</h2>
        <p className="text-xs text-slate-500">
          Commission sur les ventes et forfait de publication par séjour, pilotés par ResaColo.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Commission (%)
            <input
              name="commission_percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={String(defaultCommission)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Forfait publication (€ TTC)
            <input
              name="publication_fee_euros"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={String(defaultFeeEuros)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Notes internes
          <textarea
            name="notes"
            rows={3}
            defaultValue={billingRow?.notes ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Contexte tarifaire, accords particuliers…"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Enregistrer la facturation
          </button>
        </div>
      </form>

      <form
        id="delete-logo-form"
        action={`/api/admin/organizers/${organizerSlug}/logo/delete`}
        method="post"
      />

      <div className="flex justify-start sm:justify-end">
        <Link
          href={`/admin/organizers/${organizerSlug}/members/new`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Ajouter un membre
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      form={`member-${member.id}`}
                      name="email"
                      defaultValue={member.email ?? ''}
                      className="min-h-[42px] w-full min-w-[20rem] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      form={`member-${member.id}`}
                      name="first_name"
                      defaultValue={member.first_name ?? ''}
                      className="min-h-[42px] w-full min-w-[9rem] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      form={`member-${member.id}`}
                      name="last_name"
                      defaultValue={member.last_name ?? ''}
                      className="min-h-[42px] w-full min-w-[9rem] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <select
                      form={`member-${member.id}`}
                      name="role"
                      defaultValue={member.role}
                      className="min-h-[42px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {ORGANIZER_ACCESS_ROLE_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(member.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      id={`member-${member.id}`}
                      action={`/api/admin/organizers/${organizerSlug}/members/${member.id}`}
                      method="post"
                    >
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                        OK
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(members ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Aucun membre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import Image from 'next/image';
import ErrorToast from '@/components/common/ErrorToast';
import SavedToast from '@/components/common/SavedToast';
import OrganizerCatalogTabs from '@/components/organisme/OrganizerCatalogTabs';
import OrganizerProfileFormEnhancer from '@/components/organisme/OrganizerProfileFormEnhancer';
import OrganizerRichTextEditor from '@/components/organisme/OrganizerRichTextEditor';
import { requireRole } from '@/lib/auth/require';
import {
  ORGANIZER_ACTIVITY_OPTIONS,
  ORGANIZER_SEASON_OPTIONS,
  ORGANIZER_STAY_TYPE_OPTIONS,
  sanitizeOrganizerOptionValues
} from '@/lib/organizer-profile-options';
import {
  embedOrganizerDurationMeta,
  extractOrganizerDurationMeta,
  sanitizeOrganizerRichText
} from '@/lib/organizer-rich-text';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  }>;
};

export default async function OrganizerProfilePage({ searchParams }: PageProps) {
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
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const showSavedBanner = savedParam === '1';
  const organizerId = selectedOrganizerId;

  if (!organizerId) {
    redirect('/organisme');
  }

  const organizerSelectWithCatalog =
    'id,name,contact_email,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path,slug,season_keys,stay_type_keys,activity_keys';
  const organizerSelectFallback =
    'id,name,contact_email,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path,slug';

  const organizerQueryWithCatalog = await supabase
    .from('organizers')
    .select(organizerSelectWithCatalog)
    .eq('id', organizerId)
    .maybeSingle();
  const organizerFallbackQuery = organizerQueryWithCatalog.data
    ? null
    : await supabase
        .from('organizers')
        .select(organizerSelectFallback)
        .eq('id', organizerId)
        .maybeSingle();

  const organizer = organizerQueryWithCatalog.data
    ? organizerQueryWithCatalog.data
    : organizerFallbackQuery?.data
      ? {
          ...organizerFallbackQuery.data,
          season_keys: [],
          stay_type_keys: [],
          activity_keys: []
        }
      : null;

  if (!organizer) {
    redirect('/organisme');
  }

  const organizerDescriptionMeta = extractOrganizerDurationMeta(organizer.description);

  let stayDurationMinLoaded: number | null = null;
  let stayDurationMaxLoaded: number | null = null;
  const { data: durationRow, error: durationLoadError } = await supabase
    .from('organizers')
    .select('stay_duration_min_days,stay_duration_max_days')
    .eq('id', organizer.id)
    .maybeSingle();
  if (!durationLoadError && durationRow) {
    stayDurationMinLoaded = durationRow.stay_duration_min_days ?? null;
    stayDurationMaxLoaded = durationRow.stay_duration_max_days ?? null;
  }
  if (stayDurationMinLoaded == null) {
    stayDurationMinLoaded = organizerDescriptionMeta.stayDurationMinDays;
  }
  if (stayDurationMaxLoaded == null) {
    stayDurationMaxLoaded = organizerDescriptionMeta.stayDurationMaxDays;
  }

  const organizerForForm = {
    ...organizer,
    stay_duration_min_days: stayDurationMinLoaded,
    stay_duration_max_days: stayDurationMaxLoaded
  };

  const logoUrl = organizer.logo_path
    ? (await supabase.storage
        .from('organizer-logo')
        .createSignedUrl(organizer.logo_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const projectUrl = organizer.education_project_path
    ? (await supabase.storage
        .from('organizer-docs')
        .createSignedUrl(organizer.education_project_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const hasProject = Boolean(organizer.education_project_path);
  const organizerSlug = organizer.slug ?? organizer.id;
  const currentOrganizerId = organizer.id;
  const currentOrganizerSlug = organizer.slug;

  async function updateProfile(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const name = String(formData.get('name') ?? '').trim();
    const contactEmail = String(formData.get('contact_email') ?? '').trim();
    const heroIntroText = String(formData.get('hero_intro_text') ?? '').trim();
    const description = sanitizeOrganizerRichText(String(formData.get('description') ?? ''));
    const foundedYearRaw = String(formData.get('founded_year') ?? '').trim();
    const ageMinRaw = String(formData.get('age_min') ?? '').trim();
    const ageMaxRaw = String(formData.get('age_max') ?? '').trim();
    const stayDurationMinRaw = String(formData.get('stay_duration_min_days') ?? '').trim();
    const stayDurationMaxRaw = String(formData.get('stay_duration_max_days') ?? '').trim();
    const seasonKeys = sanitizeOrganizerOptionValues(
      formData.getAll('season_keys'),
      ORGANIZER_SEASON_OPTIONS
    );
    const stayTypeKeys = sanitizeOrganizerOptionValues(
      formData.getAll('stay_type_keys'),
      ORGANIZER_STAY_TYPE_OPTIONS
    );
    const activityKeys = sanitizeOrganizerOptionValues(
      formData.getAll('activity_keys'),
      ORGANIZER_ACTIVITY_OPTIONS
    );
    const logoFile = formData.get('logo');
    const projectFile = formData.get('education_project');

    const foundedYear = foundedYearRaw ? Number(foundedYearRaw) : null;
    const ageMin = ageMinRaw ? Number(ageMinRaw) : null;
    const ageMax = ageMaxRaw ? Number(ageMaxRaw) : null;
    const parsePositiveInt = (raw: string) => {
      if (!raw) return null;
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n) || n < 1) return null;
      return n;
    };
    let stayDurationMinDays = parsePositiveInt(stayDurationMinRaw);
    let stayDurationMaxDays = parsePositiveInt(stayDurationMaxRaw);
    if (stayDurationMinDays != null && stayDurationMaxDays != null && stayDurationMinDays > stayDurationMaxDays) {
      const tmp = stayDurationMinDays;
      stayDurationMinDays = stayDurationMaxDays;
      stayDurationMaxDays = tmp;
    }
    const slug = name ? slugify(name) : currentOrganizerSlug;
    const descriptionWithDurationMeta = embedOrganizerDurationMeta(
      description,
      stayDurationMinDays,
      stayDurationMaxDays
    );
    const basePayload = {
      name,
      contact_email: contactEmail,
      hero_intro_text: heroIntroText || null,
      description: descriptionWithDurationMeta,
      founded_year: foundedYear,
      age_min: ageMin,
      age_max: ageMax,
      season_keys: seasonKeys,
      stay_type_keys: stayTypeKeys,
      activity_keys: activityKeys,
      slug
    };

    const updateWithCatalog = await supabase
      .from('organizers')
      .update({
        ...basePayload,
        stay_duration_min_days: stayDurationMinDays,
        stay_duration_max_days: stayDurationMaxDays
      })
      .eq('id', currentOrganizerId);

    if (updateWithCatalog.error) {
      const fallbackUpdate = await supabase
        .from('organizers')
        .update(basePayload)
        .eq('id', currentOrganizerId);

      if (fallbackUpdate.error) {
        redirect(
          withOrganizerQuery(
            `/organisme/organisateur?error=${encodeURIComponent(
              fallbackUpdate.error.message || "Impossible d'enregistrer la fiche organisateur."
            )}`,
            currentOrganizerId
          )
        );
      }
    }

    if (logoFile instanceof File && logoFile.size > 0) {
      const extension = logoFile.name.split('.').pop()?.toLowerCase() || 'bin';
      const logoPath = `organizers/${currentOrganizerId}/logo.${extension}`;
      const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
      await supabase.storage
        .from('organizer-logo')
        .upload(logoPath, logoBuffer, { upsert: true, contentType: logoFile.type });
      await supabase.from('organizers').update({ logo_path: logoPath }).eq('id', currentOrganizerId);
    }

    if (projectFile instanceof File && projectFile.size > 0) {
      const extension = projectFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const projectPath = `organizers/${currentOrganizerId}/education-project.${extension}`;
      const projectBuffer = Buffer.from(await projectFile.arrayBuffer());
      await supabase.storage
        .from('organizer-docs')
        .upload(projectPath, projectBuffer, { upsert: true, contentType: projectFile.type });
      await supabase
        .from('organizers')
        .update({ education_project_path: projectPath })
        .eq('id', currentOrganizerId);
    }

    redirect(withOrganizerQuery('/organisme/organisateur?saved=1', currentOrganizerId));
  }

  return (
    <div className="space-y-6">
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      {showSavedBanner && <SavedToast message="La fiche organisme a bien été enregistrée." />}
      {showSavedBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          La fiche organisme a bien été enregistrée.
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Fiche organisateur</h1>
        <p className="text-sm text-slate-600">Mets à jour les informations publiques de ton organisme.</p>
      </div>

      <form
        key={organizer.id}
        id="organizer-profile-form"
        action={updateProfile}
        className="space-y-4"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">{organizer.name}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Nom
              <input
                name="name"
                defaultValue={organizer.name}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email de contact
              <input
                name="contact_email"
                type="email"
                defaultValue={organizer.contact_email ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Année de création
              <input
                name="founded_year"
                type="number"
                min="1900"
                max="2100"
                defaultValue={organizer.founded_year ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge min
              <input
                name="age_min"
                type="number"
                min="0"
                defaultValue={organizer.age_min ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge max
              <input
                name="age_max"
                type="number"
                min="0"
                defaultValue={organizer.age_max ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Texte sous le titre
            <textarea
              name="hero_intro_text"
              rows={3}
              defaultValue={organizer.hero_intro_text ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
            />
          </label>
          <div className="mt-4">
            <OrganizerRichTextEditor
              name="description"
              label="Texte de présentation"
              initialValue={organizer.description ?? ''}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Logo (PNG/JPG)
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
              />
              {logoUrl ? (
                <div className="mt-2 space-y-1" suppressHydrationWarning>
                  <div className="text-xs text-slate-500">Logo déjà chargé</div>
                  <Image
                    src={logoUrl}
                    alt={organizer.name}
                    width={160}
                    height={64}
                    unoptimized
                    className="h-16 w-auto max-w-full rounded-lg border object-contain"
                  />
                </div>
              ) : null}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Projet éducatif (PDF)
              {hasProject ? (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-slate-500">Projet déjà chargé</div>
                  {projectUrl ? (
                    <a className="block text-sm font-medium text-brand-600" href={projectUrl}>
                      Télécharger le PDF actuel
                    </a>
                  ) : null}
                  <button
                    formAction={`/api/organizers/${organizerSlug}/project/delete`}
                    formMethod="post"
                    className="block text-left text-xs font-semibold text-red-600"
                  >
                    Supprimer le PDF
                  </button>
                </div>
              ) : (
                <input
                  name="education_project"
                  type="file"
                  accept="application/pdf"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
                />
              )}
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Catalogue organisateur</h2>
          <OrganizerCatalogTabs
            seasonChecklist={{
              name: 'season_keys',
              title: 'Saisons',
              description: 'Ces saisons seront utilisées dans la carte de présentation publique.',
              options: ORGANIZER_SEASON_OPTIONS,
              selectedValues: organizer.season_keys ?? [],
              columnsClassName: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
            }}
            activityChecklist={{
              name: 'activity_keys',
              title: 'Activités proposées',
              options: ORGANIZER_ACTIVITY_OPTIONS,
              selectedValues: organizer.activity_keys ?? []
            }}
            stayTypeChecklist={{
              name: 'stay_type_keys',
              title: 'Types de séjours proposés',
              options: ORGANIZER_STAY_TYPE_OPTIONS,
              selectedValues: organizer.stay_type_keys ?? []
            }}
            durationMinDefault={
              organizerForForm.stay_duration_min_days != null
                ? String(organizerForForm.stay_duration_min_days)
                : ''
            }
            durationMaxDefault={
              organizerForForm.stay_duration_max_days != null
                ? String(organizerForForm.stay_duration_max_days)
                : ''
            }
          />
        </div>
      </form>
      <OrganizerProfileFormEnhancer
        formId="organizer-profile-form"
        resetToken={`${savedParam ?? ''}:${errorParam ?? ''}`}
      />
    </div>
  );
}

import { redirect } from 'next/navigation';
import Image from 'next/image';
import ErrorToast from '@/components/common/ErrorToast';
import SavedToast from '@/components/common/SavedToast';
import OrganizerCatalogTabs from '@/components/organisme/OrganizerCatalogTabs';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import OrganizerProfileFormEnhancer from '@/components/organisme/OrganizerProfileFormEnhancer';
import OrganizerRichTextEditor from '@/components/organisme/OrganizerRichTextEditor';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import {
  ORGANIZER_ACTIVITY_OPTIONS,
  ORGANIZER_SEASON_OPTIONS,
  ORGANIZER_STAY_TYPE_OPTIONS,
  sanitizeOrganizerOptionValues
} from '@/lib/organizer-profile-options';
import {
  embedOrganizerDurationMeta,
  extractOrganizerDurationMeta,
  extractOrganizerPresentationHtmlForEditor,
  sanitizeOrganizerRichText
} from '@/lib/organizer-rich-text';
import { syncOrganizerProfileCompletenessPercent } from '@/lib/organizer-profile-completeness';
import { createOrganizerCgvSignedUrl, findOrganizerCgvPath } from '@/lib/organizer-cgv';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ORGANIZER_PAYMENT_AIDS_META_PATTERN = /<!--\s*resacolo:payment-aids:([a-z_,\s-]*)\s*-->/i;

function extractOrganizerPaymentAidsMeta(value?: string | null) {
  const raw = value ?? '';
  const match = raw.match(ORGANIZER_PAYMENT_AIDS_META_PATTERN);
  const tokens = (match?.[1] ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const set = new Set(tokens);

  return {
    description: raw.replace(ORGANIZER_PAYMENT_AIDS_META_PATTERN, '').trim() || null,
    acceptsAncvPaper: set.has('ancv_paper'),
    acceptsAncvConnect: set.has('ancv_connect'),
    isVacafApproved: set.has('caf_vouchers')
  };
}

function embedOrganizerPaymentAidsMeta(
  description: string | null | undefined,
  input: {
    acceptsAncvPaper: boolean;
    acceptsAncvConnect: boolean;
    isVacafApproved: boolean;
  }
) {
  const cleanedDescription = (description ?? '').replace(ORGANIZER_PAYMENT_AIDS_META_PATTERN, '').trim();
  const values: string[] = [];
  if (input.acceptsAncvConnect) values.push('ancv_connect');
  if (input.acceptsAncvPaper) values.push('ancv_paper');
  if (input.isVacafApproved) values.push('caf_vouchers');

  if (values.length === 0) {
    return cleanedDescription || null;
  }

  const meta = `<!-- resacolo:payment-aids:${values.join(',')} -->`;
  return cleanedDescription ? `${cleanedDescription}\n${meta}` : meta;
}

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  }>;
};

export default async function OrganizerProfilePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId: organizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'organizer-profile'
  });
  const supabase = getServerSupabaseClient();
  const savedParam = Array.isArray(resolvedSearchParams?.saved)
    ? resolvedSearchParams?.saved[0]
    : resolvedSearchParams?.saved;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const showSavedBanner = savedParam === '1';

  if (!organizerId) {
    redirect('/organisme');
  }

  const organizerSelectWithCatalog =
    'id,name,contact_email,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path,slug,season_keys,stay_type_keys,activity_keys,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved';
  const organizerSelectFallback =
    'id,name,contact_email,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path,slug,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved';
  const organizerSelectLegacy =
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
  const organizerLegacyQuery = organizerQueryWithCatalog.data || organizerFallbackQuery?.data
    ? null
    : await supabase
        .from('organizers')
        .select(organizerSelectLegacy)
        .eq('id', organizerId)
        .maybeSingle();

  const legacyPaymentMeta = organizerLegacyQuery?.data
    ? extractOrganizerPaymentAidsMeta(organizerLegacyQuery.data.description)
    : null;

  const organizer = organizerQueryWithCatalog.data
    ? organizerQueryWithCatalog.data
    : organizerFallbackQuery?.data
      ? {
          ...organizerFallbackQuery.data,
          season_keys: [],
          stay_type_keys: [],
          activity_keys: []
        }
      : organizerLegacyQuery?.data
        ? {
            ...organizerLegacyQuery.data,
            description: legacyPaymentMeta?.description ?? organizerLegacyQuery.data.description,
            season_keys: [],
            stay_type_keys: [],
            activity_keys: [],
            accepts_ancv_paper: legacyPaymentMeta?.acceptsAncvPaper ?? false,
            accepts_ancv_connect: legacyPaymentMeta?.acceptsAncvConnect ?? false,
            is_vacaf_approved: legacyPaymentMeta?.isVacafApproved ?? false
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
  const cgvPath = await findOrganizerCgvPath(supabase, organizer.id);
  const cgvUrl = await createOrganizerCgvSignedUrl(supabase, organizer.id);
  const hasCgv = Boolean(cgvPath);
  const organizerSlug = organizer.slug ?? organizer.id;
  const currentOrganizerId = organizer.id;
  const currentOrganizerSlug = organizer.slug;

  async function updateProfile(formData: FormData) {
    'use server';
    await requireOrganizerPageAccess({
      requestedOrganizerId: currentOrganizerId,
      requiredSection: 'organizer-profile'
    });
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
    const acceptsAncvPaper = formData.get('accepts_ancv_paper') === 'on';
    const acceptsAncvConnect = formData.get('accepts_ancv_connect') === 'on';
    const isVacafApproved = formData.get('is_vacaf_approved') === 'on';
    const logoFile = formData.get('logo');
    const projectFile = formData.get('education_project');
    const cgvFile = formData.get('cgv_file');

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
      accepts_ancv_paper: acceptsAncvPaper,
      accepts_ancv_connect: acceptsAncvConnect,
      is_vacaf_approved: isVacafApproved,
      slug
    };
    const basePayloadLegacy = {
      name,
      contact_email: contactEmail,
      hero_intro_text: heroIntroText || null,
      description: embedOrganizerPaymentAidsMeta(descriptionWithDurationMeta, {
        acceptsAncvPaper,
        acceptsAncvConnect,
        isVacafApproved
      }),
      founded_year: foundedYear,
      age_min: ageMin,
      age_max: ageMax,
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
        const legacyUpdate = await supabase
          .from('organizers')
          .update(basePayloadLegacy)
          .eq('id', currentOrganizerId);

        if (legacyUpdate.error) {
          redirect(
            withOrganizerQuery(
              `/organisme/organisateur?error=${encodeURIComponent(
                legacyUpdate.error.message || "Impossible d'enregistrer la fiche organisateur."
              )}`,
              currentOrganizerId
            )
          );
        }
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

    if (cgvFile instanceof File && cgvFile.size > 0) {
      const extension = cgvFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const folder = `organizers/${currentOrganizerId}`;
      const { data: existingDocs } = await supabase.storage.from('organizer-docs').list(folder, {
        limit: 100
      });
      const existingCgvPaths = (existingDocs ?? [])
        .filter((doc) => /^cgv\./i.test(doc.name))
        .map((doc) => `${folder}/${doc.name}`);
      if (existingCgvPaths.length > 0) {
        await supabase.storage.from('organizer-docs').remove(existingCgvPaths);
      }

      const cgvPath = `${folder}/cgv.${extension}`;
      const cgvBuffer = Buffer.from(await cgvFile.arrayBuffer());
      await supabase.storage
        .from('organizer-docs')
        .upload(cgvPath, cgvBuffer, { upsert: true, contentType: cgvFile.type || 'application/pdf' });
    }

    await syncOrganizerProfileCompletenessPercent(supabase, currentOrganizerId);

    redirect(withOrganizerQuery('/organisme/organisateur?saved=1', currentOrganizerId));
  }

  return (
    <div className="space-y-6">
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      {showSavedBanner && <SavedToast message="La fiche organisme a bien été enregistrée." />}
      <OrganizerPageHeader
        title="Fiche organisateur"
      />

      <form
        key={organizer.id}
        id="organizer-profile-form"
        action={updateProfile}
        encType="multipart/form-data"
        className="space-y-4"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="organizer-section-title">{organizer.name}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Nom
              <input
                name="name"
                defaultValue={organizer.name}
                className="organizer-input bg-slate-50"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email de contact
              <input
                name="contact_email"
                type="email"
                defaultValue={organizer.contact_email ?? ''}
                className="organizer-input bg-slate-50"
              />
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Modes de règlement et aides acceptés</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  name="accepts_ancv_paper"
                  type="checkbox"
                  defaultChecked={Boolean(organizer.accepts_ancv_paper)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>J&apos;accepte les chèques-vacances papier</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  name="accepts_ancv_connect"
                  type="checkbox"
                  defaultChecked={Boolean(organizer.accepts_ancv_connect)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>J&apos;accepte ANCV Connect</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  name="is_vacaf_approved"
                  type="checkbox"
                  defaultChecked={Boolean(organizer.is_vacaf_approved)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>Je suis agréé VACAF National / CAF AVE</span>
              </label>
            </div>
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
                className="organizer-input bg-slate-50"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge min
              <input
                name="age_min"
                type="number"
                min="0"
                defaultValue={organizer.age_min ?? ''}
                className="organizer-input bg-slate-50"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge max
              <input
                name="age_max"
                type="number"
                min="0"
                defaultValue={organizer.age_max ?? ''}
                className="organizer-input bg-slate-50"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Texte sous le titre
            <textarea
              name="hero_intro_text"
              rows={3}
              defaultValue={organizer.hero_intro_text ?? ''}
              className="organizer-input min-h-[7rem] bg-slate-50"
            />
          </label>
          <div className="mt-4">
            <OrganizerRichTextEditor
              name="description"
              label="Texte de présentation"
              initialValue={extractOrganizerPresentationHtmlForEditor(organizer.description)}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Logo (PNG/JPG)
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="organizer-input bg-slate-50"
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
                    className="block text-left text-xs font-semibold text-rose-700"
                  >
                    Supprimer le PDF
                  </button>
                </div>
              ) : (
                <input
                  name="education_project"
                  type="file"
                  accept="application/pdf"
                  className="organizer-input bg-slate-50"
                />
              )}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              CGV organisateur (PDF)
              <p className="mt-1 text-xs font-normal leading-relaxed text-slate-500">
                Téléversez ici les conditions générales de vente propres à votre organisme. Ce document sera
                téléchargeable par les familles au moment du récapitulatif de commande. Il deviendra obligatoire
                avant la mise en ligne finale sur la plateforme, mais il n&apos;est pas bloquant à ce stade.
              </p>
              <input
                name="cgv_file"
                type="file"
                accept="application/pdf"
                className="organizer-input bg-slate-50"
              />
              {hasCgv ? (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-slate-500">CGV déjà chargées</div>
                  {cgvUrl ? (
                    <a className="block text-sm font-medium text-brand-600" href={cgvUrl}>
                      Télécharger les CGV actuelles
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Aucun fichier CGV chargé pour le moment.</p>
              )}
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Catalogue organisateur (à compléter selon l'offre) :
          </h2>
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

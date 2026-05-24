import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import PartnerHeroFieldsSection from '@/components/partner/PartnerHeroFieldsSection';
import PartnerLogoFieldset from '@/components/partner/PartnerLogoFieldset';
import PartnerProfileFormEnhancer from '@/components/partner/PartnerProfileFormEnhancer';
import {
  isPartnerLogoFileAccepted,
  PARTNER_LOGO_MAX_SIZE_BYTES,
  uploadPartnerLogoFile
} from '@/lib/partner-logo-storage';
import { partnerHasMarqueBlancheAccess } from '@/lib/partner-offers';
import { parsePartnerHeroInput } from '@/lib/partner-hero';
import { readPartnerCollectivity } from '@/lib/partner.server';
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

function parseBoundedNumber(
  value: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default async function MarqueBlanchePage({ searchParams }: PageProps) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const params = searchParams ? await searchParams : undefined;

  if (!canAccessPartnerSection(accessRole, 'white-label')) {
    redirect('/partenaire');
  }

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Marque blanche</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  const collectivity = await readPartnerCollectivity(collectivityId);
  if (!partnerHasMarqueBlancheAccess(collectivity.offer_mode)) {
    redirect('/partenaire');
  }

  async function updateWhiteLabel(formData: FormData) {
    'use server';

    const session = await requirePartner();
    const collectivityId = session.tenantId;
    const accessRole = getPartnerAccessRoleFromSession(session);
    if (!collectivityId) {
      redirect('/partenaire/marque-blanche?error=Aucune%20collectivite%20liee');
    }
    if (!canAccessPartnerSection(accessRole, 'white-label')) {
      redirect('/partenaire');
    }

    const collectivityGate = await readPartnerCollectivity(collectivityId);
    if (!partnerHasMarqueBlancheAccess(collectivityGate.offer_mode)) {
      redirect('/partenaire');
    }

    const supabase = getServerSupabaseClient();
    let heroInput;
    try {
      heroInput = parsePartnerHeroInput(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Paramètres Hero invalides';
      redirect(`/partenaire/marque-blanche?error=${encodeURIComponent(message)}`);
    }
    const logoFile = formData.get('logo');
    let logoUrl = normalizeOptionalString(formData.get('logo_url'));

    if (logoFile instanceof File && logoFile.size > 0) {
      if (logoFile.size > PARTNER_LOGO_MAX_SIZE_BYTES) {
        redirect('/partenaire/marque-blanche?error=Le%20logo%20depasse%20la%20taille%20maximale%20de%205%20Mo');
      }
      if (!isPartnerLogoFileAccepted(logoFile)) {
        redirect('/partenaire/marque-blanche?error=Format%20de%20logo%20non%20pris%20en%20charge');
      }

      try {
        logoUrl = await uploadPartnerLogoFile(supabase, collectivityId, logoFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de téléverser le logo';
        redirect(`/partenaire/marque-blanche?error=${encodeURIComponent(message)}`);
      }
    }

    const { error } = await supabase
      .from('collectivities')
      .update({
        logo_url: logoUrl,
        logo_scale: parseBoundedNumber(formData.get('logo_scale'), 1, 0.6, 2.4),
        logo_offset_x: parseBoundedNumber(formData.get('logo_offset_x'), 0, -100, 100),
        logo_offset_y: parseBoundedNumber(formData.get('logo_offset_y'), 0, -100, 100),
        brand_primary_color: normalizeOptionalString(formData.get('brand_primary_color')) ?? '#ea580c',
        brand_welcome_text: normalizeOptionalString(formData.get('brand_welcome_text')),
        brand_redirect_url: normalizeOptionalString(formData.get('brand_redirect_url')),
        hero_enabled: heroInput.heroEnabled,
        hero_title: heroInput.heroTitle,
        hero_body: heroInput.heroBody,
        hero_cta_label: heroInput.heroCtaLabel,
        hero_cta_url: heroInput.heroCtaUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', collectivityId);

    if (error) {
      redirect(`/partenaire/marque-blanche?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath('/partenaire');
    revalidatePath('/partenaire/fiche');
    revalidatePath('/partenaire/marque-blanche');
    revalidatePath('/', 'layout');
    redirect('/partenaire/marque-blanche?saved=1');
  }

  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';
  const formResetToken = `${params?.saved ?? ''}:${params?.error ?? ''}:${collectivity.updated_at}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Marque blanche</h1>
        <p className="admin-page-subtitle mt-1">
          Personnalisez votre espace partenaire avec votre logo, votre couleur principale et votre message d&apos;accueil.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}
      {isSaved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Marque blanche enregistrée.
        </p>
      ) : null}

      <form id="partner-white-label-form" action={updateWhiteLabel} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Identité visuelle</h2>
          <div className="mt-4">
            <PartnerLogoFieldset
              initialLogoUrl={collectivity.logo_url}
              initialScale={collectivity.logo_scale}
              initialOffsetX={collectivity.logo_offset_x}
              initialOffsetY={collectivity.logo_offset_y}
              partnerName={collectivity.name}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Paramètres de marque</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-700">
              <span className="shrink-0">Couleur principale :</span>
              <input
                type="color"
                name="brand_primary_color"
                defaultValue={collectivity.brand_primary_color ?? '#ea580c'}
                className="h-12 w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              URL de redirection
              <input
                type="url"
                name="brand_redirect_url"
                defaultValue={collectivity.brand_redirect_url ?? ''}
                className={fieldClassName()}
                placeholder="https://votre-site.fr"
              />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Texte d&apos;accueil
              <textarea
                name="brand_welcome_text"
                rows={4}
                defaultValue={collectivity.brand_welcome_text ?? ''}
                className={fieldClassName()}
                placeholder="Ex: Bienvenue sur l'espace CSE Horizon."
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="admin-section-title">Hero public</h2>
          <p className="mt-2 text-sm text-slate-600">
            Ce bandeau s&apos;affiche sur les pages publiques pour les familles rattachées à votre CSE. Le bouton
            n&apos;apparaît que si son texte et son lien sont tous les deux renseignés.
          </p>
          <PartnerHeroFieldsSection
            initialHeroEnabled={Boolean(collectivity.hero_enabled)}
            initialHeroTitle={collectivity.hero_title}
            initialHeroBody={collectivity.hero_body}
            initialHeroCtaLabel={collectivity.hero_cta_label}
            initialHeroCtaUrl={collectivity.hero_cta_url}
            resetToken={formResetToken}
          />
        </section>
      </form>
      <PartnerProfileFormEnhancer formId="partner-white-label-form" resetToken={formResetToken} />
    </div>
  );
}

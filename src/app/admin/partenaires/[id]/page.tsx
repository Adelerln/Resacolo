import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { parsePartnerHeroInput } from '@/lib/partner-hero';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 transition-colors';
}

function sanitizeRedirectQueryValue(value: string | undefined) {
  return value ? decodeURIComponent(value) : null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default async function AdminPartnerEditPage({ params, searchParams }: PageProps) {
  await requireRole('ADMIN');
  const { id } = await params;
  const partnerId = id;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = getServerSupabaseClient();

  const { data: collectivity, error } = await supabase
    .from('collectivities')
    .select('id,name,hero_enabled,hero_title,hero_body,hero_cta_label,hero_cta_url,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-rose-700">Impossible de charger le partenaire: {error.message}</p>;
  }
  if (!collectivity) {
    redirect('/admin/partenaires');
  }

  async function updatePartnerHero(formData: FormData) {
    'use server';

    await requireRole('ADMIN');
    let heroInput;
    try {
      heroInput = parsePartnerHeroInput(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Paramètres Hero invalides';
      redirect(`/admin/partenaires/${partnerId}?error=${encodeURIComponent(message)}`);
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from('collectivities')
      .update({
        hero_enabled: heroInput.heroEnabled,
        hero_title: heroInput.heroTitle,
        hero_body: heroInput.heroBody,
        hero_cta_label: heroInput.heroCtaLabel,
        hero_cta_url: heroInput.heroCtaUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', partnerId);

    if (error) {
      redirect(`/admin/partenaires/${partnerId}?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath('/admin/partenaires');
    revalidatePath(`/admin/partenaires/${partnerId}`);
    revalidatePath('/partenaire/marque-blanche');
    revalidatePath('/', 'layout');
    redirect(`/admin/partenaires/${partnerId}?saved=1`);
  }

  const errorMessage = sanitizeRedirectQueryValue(resolvedSearchParams?.error);
  const isSaved = resolvedSearchParams?.saved === '1';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Hero partenaire</h1>
        <p className="admin-page-subtitle mt-1">{collectivity.name}</p>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}
      {isSaved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Hero enregistré.
        </p>
      ) : null}

      <form action={updatePartnerHero} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="hero_enabled"
            defaultChecked={Boolean(collectivity.hero_enabled)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
          />
          Activer le hero CSE sous le header (pages publiques)
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Titre
            <input
              type="text"
              name="hero_title"
              maxLength={80}
              defaultValue={collectivity.hero_title ?? ''}
              className={fieldClassName()}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Libellé du bouton
            <input
              type="text"
              name="hero_cta_label"
              maxLength={40}
              defaultValue={collectivity.hero_cta_label ?? ''}
              className={fieldClassName()}
            />
          </label>
          <label className="md:col-span-2 text-sm font-medium text-slate-700">
            Texte
            <textarea
              name="hero_body"
              rows={4}
              maxLength={280}
              defaultValue={collectivity.hero_body ?? ''}
              className={fieldClassName()}
            />
          </label>
          <label className="md:col-span-2 text-sm font-medium text-slate-700">
            URL du bouton (https://... ou /...)
            <input
              type="text"
              name="hero_cta_url"
              maxLength={500}
              defaultValue={collectivity.hero_cta_url ?? ''}
              className={fieldClassName()}
            />
          </label>
        </div>

        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Enregistrer le hero
        </button>
      </form>
    </div>
  );
}

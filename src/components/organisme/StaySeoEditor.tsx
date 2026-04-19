'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildStaySeoGooglePreview,
  buildStaySeoWarnings,
  SEO_META_RECOMMENDED_MAX,
  SEO_META_RECOMMENDED_MIN,
  SEO_TITLE_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MIN,
  sanitizeSeoPrimaryKeyword,
  sanitizeSeoTags,
  sanitizeSeoText
} from '@/lib/stay-seo';

type StaySeoEditorContext = {
  title: string;
  summary: string;
  description: string;
  activitiesText: string;
  programText: string;
  location: string;
  region: string;
  seasonName: string;
  ageRange: string;
  categories: string[];
};

type SeoActionState = {
  level: 'info' | 'success' | 'error';
  message: string;
};

type StaySeoGenerationConfig = {
  endpoint: string;
  organizerId?: string | null;
  initialGeneratedAt?: string | null;
  initialGenerationSource?: string | null;
};

type StaySeoEditorProps = {
  canonicalPath: string;
  seasonNameById: Record<string, string>;
  initialContext: StaySeoEditorContext;
  initialSeo: {
    primaryKeyword?: string;
    secondaryKeywords: string[];
    targetCity?: string;
    targetRegion?: string;
    searchIntents: string[];
    title?: string;
    metaDescription?: string;
  };
  generation?: StaySeoGenerationConfig;
};

function formatAgeRange(ages: number[]) {
  if (ages.length === 0) return 'Tous âges';
  if (ages.length === 1) return `${ages[0]} ans`;
  return `${ages[0]}-${ages[ages.length - 1]} ans`;
}

function readContextFromForm(
  form: HTMLFormElement,
  seasonNameById: Record<string, string>,
  fallback: StaySeoEditorContext
): StaySeoEditorContext {
  const formData = new FormData(form);
  const ages = formData
    .getAll('ages')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 3 && value <= 25)
    .sort((left, right) => left - right);
  const seasonId = sanitizeSeoText(formData.get('season_id'));
  const seasonName = seasonNameById[seasonId] ?? fallback.seasonName;
  const categories = formData.getAll('categories').map((value) => sanitizeSeoText(value)).filter(Boolean);

  return {
    title: sanitizeSeoText(formData.get('title')) || fallback.title,
    summary: sanitizeSeoText(formData.get('summary')) || '',
    description: sanitizeSeoText(formData.get('description')) || '',
    activitiesText: sanitizeSeoText(formData.get('activities_text')) || '',
    programText: sanitizeSeoText(formData.get('program_text')) || '',
    location: sanitizeSeoText(formData.get('location')) || '',
    region: sanitizeSeoText(formData.get('region_text')) || '',
    seasonName,
    ageRange: formatAgeRange(ages),
    categories
  };
}

export default function StaySeoEditor({
  canonicalPath,
  seasonNameById,
  initialContext,
  initialSeo,
  generation
}: StaySeoEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [context, setContext] = useState<StaySeoEditorContext>(initialContext);

  const [primaryKeyword, setPrimaryKeyword] = useState(
    sanitizeSeoPrimaryKeyword(initialSeo.primaryKeyword ?? '')
  );
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>(
    sanitizeSeoTags(initialSeo.secondaryKeywords)
  );
  const [targetCity, setTargetCity] = useState(initialSeo.targetCity ?? '');
  const [targetRegion, setTargetRegion] = useState(initialSeo.targetRegion ?? '');
  const [searchIntents, setSearchIntents] = useState<string[]>(
    sanitizeSeoTags(initialSeo.searchIntents)
  );
  const [seoTitle, setSeoTitle] = useState(initialSeo.title ?? '');
  const [seoMetaDescription, setSeoMetaDescription] = useState(initialSeo.metaDescription ?? '');
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [seoGeneratedAt, setSeoGeneratedAt] = useState<string | null>(
    generation?.initialGeneratedAt ?? null
  );
  const [seoGenerationSource, setSeoGenerationSource] = useState<string | null>(
    typeof generation?.initialGenerationSource === 'string' &&
      generation.initialGenerationSource.trim().length > 0
      ? generation.initialGenerationSource
      : null
  );
  const [seoActionState, setSeoActionState] = useState<SeoActionState | null>(null);

  const seoInput = useMemo(
    () => ({
      ...context,
      seo: {
        primaryKeyword,
        secondaryKeywords,
        targetCity,
        targetRegion,
        searchIntents,
        title: seoTitle,
        metaDescription: seoMetaDescription
      }
    }),
    [
      context,
      primaryKeyword,
      secondaryKeywords,
      targetCity,
      targetRegion,
      searchIntents,
      seoTitle,
      seoMetaDescription
    ]
  );

  const googlePreview = useMemo(
    () => buildStaySeoGooglePreview(seoInput, canonicalPath),
    [seoInput, canonicalPath]
  );
  const warnings = useMemo(() => buildStaySeoWarnings(seoInput), [seoInput]);
  const hasGeneratedSeo = useMemo(
    () =>
      Boolean(
        primaryKeyword ||
          seoTitle ||
          seoMetaDescription ||
          targetCity ||
          targetRegion ||
          secondaryKeywords.length > 0 ||
          searchIntents.length > 0
      ),
    [
      primaryKeyword,
      seoTitle,
      seoMetaDescription,
      targetCity,
      targetRegion,
      secondaryKeywords,
      searchIntents
    ]
  );

  useEffect(() => {
    const form = containerRef.current?.closest('form');
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => {
      setContext((previous) => readContextFromForm(form, seasonNameById, previous));
    };

    sync();
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);

    return () => {
      form.removeEventListener('input', sync);
      form.removeEventListener('change', sync);
    };
  }, [seasonNameById]);

  function applyGeneratedSeo(seo: {
    seo_primary_keyword?: string | null;
    seo_secondary_keywords?: string[];
    seo_target_city?: string | null;
    seo_target_region?: string | null;
    seo_search_intents?: string[];
    seo_title?: string | null;
    seo_meta_description?: string | null;
    seo_generated_at?: string | null;
    seo_generation_source?: string | null;
  }) {
    setPrimaryKeyword(sanitizeSeoPrimaryKeyword(seo.seo_primary_keyword));
    setSecondaryKeywords(sanitizeSeoTags(seo.seo_secondary_keywords ?? []));
    setTargetCity(sanitizeSeoText(seo.seo_target_city));
    setTargetRegion(sanitizeSeoText(seo.seo_target_region));
    setSearchIntents(sanitizeSeoTags(seo.seo_search_intents ?? []));
    setSeoTitle(sanitizeSeoText(seo.seo_title));
    setSeoMetaDescription(sanitizeSeoText(seo.seo_meta_description));
    setSeoGeneratedAt(typeof seo.seo_generated_at === 'string' ? seo.seo_generated_at : null);
    setSeoGenerationSource(
      typeof seo.seo_generation_source === 'string' && seo.seo_generation_source.trim().length > 0
        ? seo.seo_generation_source
        : null
    );
  }

  async function generateSeo(force: boolean) {
    if (!generation) return;
    setIsGeneratingSeo(true);
    setSeoActionState({
      level: 'info',
      message: force ? 'Regénération SEO en cours…' : 'Génération SEO en cours…'
    });

    try {
      const response = await fetch(generation.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          organizerId: generation.organizerId,
          force
        })
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            alreadyGenerated?: boolean;
            seo?: {
              seo_primary_keyword?: string | null;
              seo_secondary_keywords?: string[];
              seo_target_city?: string | null;
              seo_target_region?: string | null;
              seo_search_intents?: string[];
              seo_title?: string | null;
              seo_meta_description?: string | null;
              seo_generated_at?: string | null;
              seo_generation_source?: string | null;
            };
          }
        | null;

      if (!response.ok) {
        setSeoActionState({
          level: 'error',
          message: data?.error ?? 'Impossible de générer le SEO.'
        });
        return;
      }

      if (data?.seo) {
        applyGeneratedSeo(data.seo);
      }

      if (data?.alreadyGenerated && !force) {
        setSeoActionState({
          level: 'info',
          message: 'Un SEO existe déjà. Clique sur "Regénérer le SEO" pour le remplacer.'
        });
        return;
      }

      setSeoActionState({
        level: 'success',
        message: force ? 'SEO regénéré avec succès.' : 'SEO généré avec succès.'
      });
    } catch {
      setSeoActionState({
        level: 'error',
        message: 'Une erreur réseau est survenue pendant la génération SEO.'
      });
    } finally {
      setIsGeneratingSeo(false);
    }
  }

  return (
    <section ref={containerRef} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">SEO du séjour</h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure les expressions clés à mettre en avant, puis vérifie l&apos;aperçu Google.
          </p>
          {seoGeneratedAt && (
            <p className="mt-1 text-xs text-slate-500">
              Dernière génération: {new Date(seoGeneratedAt).toLocaleString('fr-FR')}
              {seoGenerationSource ? ` (${seoGenerationSource})` : ''}
            </p>
          )}
        </div>
        {generation && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generateSeo(false)}
              disabled={isGeneratingSeo}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isGeneratingSeo ? 'Génération en cours…' : 'Générer le SEO'}
            </button>
            {hasGeneratedSeo && (
              <button
                type="button"
                onClick={() => void generateSeo(true)}
                disabled={isGeneratingSeo}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Regénérer le SEO
              </button>
            )}
          </div>
        )}
      </div>

      {seoActionState && (
        <div
          aria-live="polite"
          className={`rounded-lg px-3 py-2 text-sm ${
            seoActionState.level === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : seoActionState.level === 'error'
                ? 'border border-rose-200 bg-rose-50 text-rose-800'
                : 'border border-slate-200 bg-white text-slate-700'
          }`}
        >
          {seoActionState.message}
        </div>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Mot-clé principal
        <input
          name="seo_primary_keyword"
          value={primaryKeyword}
          onChange={(event) => setPrimaryKeyword(event.target.value)}
          onBlur={() => setPrimaryKeyword((current) => sanitizeSeoPrimaryKeyword(current))}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          placeholder="Ex. colonie de vacances surf à Biarritz"
        />
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Les champs avancés (mots-clés secondaires, intentions, ciblage ville/région) sont gérés automatiquement
        par la génération SEO.
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Aperçu du titre SEO
          <input
            name="seo_title"
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Laisse vide pour génération automatique"
          />
          <span className="mt-1 block text-xs text-slate-500">
            {googlePreview.title.length} caractères recommandés ({SEO_TITLE_RECOMMENDED_MIN} à{' '}
            {SEO_TITLE_RECOMMENDED_MAX})
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Aperçu de la meta description
          <textarea
            name="seo_meta_description"
            value={seoMetaDescription}
            onChange={(event) => setSeoMetaDescription(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Laisse vide pour génération automatique"
          />
          <span className="mt-1 block text-xs text-slate-500">
            {googlePreview.description.length} caractères recommandés ({SEO_META_RECOMMENDED_MIN} à{' '}
            {SEO_META_RECOMMENDED_MAX})
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Aperçu de l&apos;URL canonique / slug
          <input
            value={googlePreview.canonicalPath}
            disabled
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Aperçu Google</p>
        <p className="mt-2 text-lg font-medium text-blue-700">{googlePreview.title}</p>
        <p className="text-sm text-emerald-700">{googlePreview.canonicalPath}</p>
        <p className="mt-2 text-sm text-slate-700">{googlePreview.description}</p>
      </div>

      <input type="hidden" name="seo_target_city" value={targetCity} />
      <input type="hidden" name="seo_target_region" value={targetRegion} />
      {secondaryKeywords.map((keyword) => (
        <input key={`secondary-hidden-${keyword}`} type="hidden" name="seo_secondary_keywords" value={keyword} />
      ))}
      {searchIntents.map((intent) => (
        <input key={`intent-hidden-${intent}`} type="hidden" name="seo_search_intents" value={intent} />
      ))}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Points à corriger</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {warnings.map((warning) => (
              <li key={warning.code}>• {warning.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

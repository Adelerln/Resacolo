'use client';

import { useEffect, useState } from 'react';

type PartnerHeroFieldsSectionProps = {
  initialHeroEnabled: boolean;
  initialHeroTitle: string | null;
  initialHeroBody: string | null;
  initialHeroCtaLabel: string | null;
  initialHeroCtaUrl: string | null;
  resetToken?: string;
};

function fieldClassName() {
  return 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 transition-colors';
}

export default function PartnerHeroFieldsSection({
  initialHeroEnabled,
  initialHeroTitle,
  initialHeroBody,
  initialHeroCtaLabel,
  initialHeroCtaUrl,
  resetToken
}: PartnerHeroFieldsSectionProps) {
  const [heroEnabled, setHeroEnabled] = useState(initialHeroEnabled);

  useEffect(() => {
    setHeroEnabled(initialHeroEnabled);
  }, [initialHeroEnabled, resetToken]);

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2 inline-flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="hero_enabled"
          checked={heroEnabled}
          onChange={(event) => setHeroEnabled(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
        />
        Activer le hero CSE sous le header (pages publiques)
      </label>

      <div className={heroEnabled ? 'contents' : 'hidden'}>
        <label className="text-sm font-medium text-slate-700">
          Titre
          <input
            type="text"
            name="hero_title"
            maxLength={80}
            defaultValue={initialHeroTitle ?? ''}
            className={fieldClassName()}
            placeholder="Ex: Bienvenue aux familles du CSE Horizon"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Texte du bouton
          <input
            type="text"
            name="hero_cta_label"
            maxLength={40}
            defaultValue={initialHeroCtaLabel ?? ''}
            className={fieldClassName()}
            placeholder="Ex: Voir notre sélection"
          />
        </label>
        <label className="md:col-span-2 text-sm font-medium text-slate-700">
          Texte
          <textarea
            name="hero_body"
            rows={4}
            maxLength={280}
            defaultValue={initialHeroBody ?? ''}
            className={fieldClassName()}
            placeholder="Ex: Profitez de tarifs négociés et d'une sélection pensée pour vos enfants."
          />
        </label>
        <label className="md:col-span-2 text-sm font-medium text-slate-700">
          Lien du bouton (https://... ou /...)
          <input
            type="text"
            name="hero_cta_url"
            maxLength={500}
            defaultValue={initialHeroCtaUrl ?? ''}
            className={fieldClassName()}
            placeholder="Ex: /sejours"
          />
        </label>
      </div>
    </div>
  );
}

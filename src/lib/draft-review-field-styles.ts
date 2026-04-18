import { cn } from '@/lib/utils';

export type DraftReviewControlVariant = {
  /** Champ obligatoire côté validation (ex. titre, nom d'hébergement) */
  required: boolean;
  /** Valeur considérée comme renseignée (ex. trim().length > 0) */
  filled: boolean;
  /** Erreur serveur / validation affichée sur ce champ */
  hasError?: boolean;
};

function draftReviewToneClasses(v: DraftReviewControlVariant): string {
  if (v.hasError) {
    return 'border-2 border-rose-500 bg-rose-50/50 ring-1 ring-rose-200/60';
  }
  if (v.required) {
    return v.filled
      ? 'border-2 border-emerald-500 bg-emerald-50/35 ring-1 ring-emerald-200/50'
      : 'border-2 border-rose-400 bg-rose-50/35 ring-1 ring-rose-200/50';
  }
  return v.filled
    ? 'border border-slate-200 bg-white'
    : 'border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400';
}

/**
 * Bordure des champs dans le tunnel de review du brouillon :
 * - obligatoire rempli → vert
 * - obligatoire vide → rouge
 * - facultatif vide → gris
 * - facultatif rempli → bordure neutre
 */
type ControlOpts = DraftReviewControlVariant & { omitOuterMargin?: boolean };

export function draftReviewControlClass(v: ControlOpts): string {
  const margin = v.omitOuterMargin ? '' : 'mt-1 ';
  const base = `${margin}w-full rounded-lg px-3 py-2 text-sm transition-[border,box-shadow,background-color] duration-150`;
  return cn(base, draftReviewToneClasses(v));
}

/** Bloc autour d’un groupe (ex. grille de catégories). */
export function draftReviewFieldGroupClass(v: DraftReviewControlVariant): string {
  return cn(
    'rounded-lg p-3 transition-[border,box-shadow,background-color] duration-150',
    draftReviewToneClasses(v)
  );
}

export type DraftReviewSectionVariant = {
  required: boolean;
  /** Section « remplie » (ex. au moins une session, au moins une image…) */
  satisfied: boolean;
  hasError?: boolean;
};

/** Conteneur d’une rubrique (éditeurs Sessions, Transports, etc.) */
export function draftReviewSectionClass(v: DraftReviewSectionVariant): string {
  const base = 'space-y-3 rounded-xl p-4 transition-[border,box-shadow,background-color] duration-150';
  if (v.hasError) {
    return cn(base, 'border-2 border-rose-500 bg-rose-50/30 ring-1 ring-rose-200/50');
  }
  if (v.required) {
    return v.satisfied
      ? cn(base, 'border-2 border-emerald-500 bg-emerald-50/25 ring-1 ring-emerald-200/40')
      : cn(base, 'border-2 border-rose-400 bg-rose-50/25 ring-1 ring-rose-200/40');
  }
  return v.satisfied
    ? cn(base, 'border border-slate-200 bg-slate-50/50')
    : cn(base, 'border border-slate-200 bg-slate-50/70');
}

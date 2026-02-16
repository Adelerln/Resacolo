import type { StaySession } from '@prisma/client';

type StayQualityInput = {
  title?: string | null;
  description?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  location?: string | null;
  themesCount?: number;
  mediaCount?: number;
  sessions?: StaySession[];
};

export type StayQualityResult = {
  score: number;
  warnings: string[];
  suggestions: string[];
};

export function evaluateStayQuality(input: StayQualityInput): StayQualityResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (input.title) score += 10;
  if (input.description && input.description.length >= 120) score += 20;
  else warnings.push('Description trop courte ou manquante.');

  if (input.ageMin != null && input.ageMax != null && input.ageMin <= input.ageMax) {
    score += 10;
  } else {
    warnings.push("Tranches d'age invalides ou manquantes.");
  }

  if (input.location) score += 10;
  if ((input.themesCount ?? 0) > 0) score += 10;
  if ((input.mediaCount ?? 0) >= 3) score += 10;
  else suggestions.push('Ajouter au moins 3 medias.');

  if (input.sessions && input.sessions.length > 0) {
    score += 20;
  } else {
    warnings.push('Aucune session vendable.');
  }

  if (input.sessions) {
    const hasShortSession = input.sessions.some(
      (s) => s.endDate.getTime() <= s.startDate.getTime()
    );
    if (hasShortSession) warnings.push('Dates de session incoherentes.');
  }

  return {
    score: Math.min(100, score),
    warnings,
    suggestions
  };
}

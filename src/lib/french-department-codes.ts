import { FRENCH_DEPARTMENT_NAME_TO_CODE } from '@/lib/french-department-codes.generated';

export { FRENCH_DEPARTMENT_NAME_TO_CODE };

function normKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Grandes villes → département (ville seule sans code département). */
const MAJOR_CITY_TO_DEPT: Record<string, string> = {
  paris: '75',
  marseille: '13',
  lyon: '69',
  toulouse: '31',
  nice: '06',
  nantes: '44',
  bordeaux: '33',
  lille: '59',
  rennes: '35',
  strasbourg: '67',
  montpellier: '34'
};

export function resolveDepartmentCodeFromFrenchName(fragment: string): string | null {
  const stripped = fragment
    .replace(/^les?\s+/i, '')
    .replace(/^la\s+/i, '')
    .replace(/^l'\s*/i, '')
    .trim();
  const k = normKey(stripped);
  if (!k) return null;
  if (MAJOR_CITY_TO_DEPT[k]) return MAJOR_CITY_TO_DEPT[k];
  return FRENCH_DEPARTMENT_NAME_TO_CODE[k] ?? null;
}

function splitFranceCitySegments(city: string): string[] {
  return city
    .split(/\s*[/|·]\s*|\s+et\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Corrige les cas fréquents d’import IA : noms de départements dans « ville », codes manquants.
 */
export function repairAccommodationImportLocation(record: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...record };
  const modeRaw = typeof next.location_mode === 'string' ? next.location_mode.trim().toLowerCase() : '';
  if (modeRaw !== 'france') return next;

  const city = String(next.location_city ?? '').trim();
  const dept = String(next.location_department_code ?? '').trim();
  if (!city || dept) return next;

  const segments = splitFranceCitySegments(city);
  if (segments.length === 0) return next;

  const resolvedDeptOnly = segments.map((raw) => {
    const stripped = raw
      .replace(/^les?\s+/i, '')
      .replace(/^la\s+/i, '')
      .replace(/^l'\s*/i, '')
      .trim();
    const k = normKey(stripped);
    const code = FRENCH_DEPARTMENT_NAME_TO_CODE[k] ?? null;
    return { raw, code };
  });

  const allSegmentsAreDepartmentNames = resolvedDeptOnly.every((r) => Boolean(r.code));
  if (allSegmentsAreDepartmentNames) {
    next.location_mode = 'itinerant';
    next.location_city = '';
    next.location_department_code = '';
    next.location_country = '';
    if (resolvedDeptOnly.length === 1) {
      const { raw, code } = resolvedDeptOnly[0]!;
      next.itinerant_zone = `Structure située dans le département de ${raw} (${code}).`;
    } else {
      next.itinerant_zone = `Implantation à la frontière entre ${resolvedDeptOnly
        .map((r) => `${r.raw} (${r.code})`)
        .join(' et ')}.`;
    }
    return next;
  }

  if (segments.length === 1) {
    const only = segments[0]!;
    const inferredDept = resolveDepartmentCodeFromFrenchName(only);
    if (inferredDept) {
      next.location_department_code = inferredDept;
    }
  }

  return next;
}

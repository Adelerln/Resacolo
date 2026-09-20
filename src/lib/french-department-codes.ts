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

/** Liste déroulante départements (code + libellé), triée par code. */
export const FRENCH_DEPARTMENT_OPTIONS: Array<{ code: string; label: string }> = Object.entries(
  FRENCH_DEPARTMENT_NAME_TO_CODE
)
  .map(([name, code]) => {
    const pretty = name
      .split(' ')
      .map((part) =>
        part
          .split('-')
          .map((chunk) => {
            if (chunk === "d'" || chunk === "l'") return chunk;
            return chunk.charAt(0).toUpperCase() + chunk.slice(1);
          })
          .join('-')
      )
      .join(' ');
    return { code, label: `${code} — ${pretty}` };
  })
  .sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true }));

const VALID_DEPARTMENT_CODES = new Set(FRENCH_DEPARTMENT_OPTIONS.map((option) => option.code));

export function isValidFrenchDepartmentCode(code: string | null | undefined) {
  return Boolean(code && VALID_DEPARTMENT_CODES.has(code));
}

/** Suggestion depuis un code postal français (ex. 75017 → 75, 20100 → 2A). */
export function suggestDepartmentCodeFromPostalCode(postalCode: string | null | undefined) {
  const digits = String(postalCode ?? '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  const prefix2 = digits.slice(0, 2);
  if (prefix2 === '20') {
    // Corse : 200/201 → 2A, 202/206 → 2B (approx.)
    const prefix3 = digits.slice(0, 3);
    if (prefix3.startsWith('200') || prefix3.startsWith('201')) return '2A';
    if (prefix3.startsWith('202') || prefix3.startsWith('206')) return '2B';
    return '2A';
  }
  if (prefix2 === '97' || prefix2 === '98') {
    const prefix3 = digits.slice(0, 3);
    return isValidFrenchDepartmentCode(prefix3) ? prefix3 : null;
  }
  return isValidFrenchDepartmentCode(prefix2) ? prefix2 : null;
}

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

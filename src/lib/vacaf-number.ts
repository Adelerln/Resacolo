/** Matricule allocataire CAF : 7 chiffres, éventuellement 1 lettre (pas de format MSA 6 chiffres). */
export const VACAF_NUMBER_REGEX = /^\d{7}[A-Za-z]?$/;
export const VACAF_NUMBER_OPTIONAL_REGEX = /^$|^\d{7}[A-Za-z]?$/;

export const VACAF_NUMBER_MESSAGE =
  'Le matricule allocataire doit contenir 7 chiffres, éventuellement suivis d’une lettre.';

export const VACAF_DEPARTMENT_MESSAGE = 'Sélectionnez le département de votre CAF.';

export function normalizeVacafNumberInput(raw: string) {
  const cleaned = raw.replace(/\s/g, '').toUpperCase();
  let digits = '';
  let letter = '';

  for (const char of cleaned) {
    if (digits.length < 7) {
      if (/[0-9]/.test(char)) {
        digits += char;
      }
      continue;
    }
    if (!letter && /[A-Z]/.test(char)) {
      letter = char;
      break;
    }
  }

  return digits + letter;
}

/** Affiche « 7654321 (75) » avec le département saisi par le parent (pas déduit du matricule). */
export function formatVacafNumberWithDepartment(
  raw: string | null | undefined,
  departmentCode?: string | null
) {
  const normalized = normalizeVacafNumberInput(String(raw ?? ''));
  if (!normalized) return '';
  const dept = String(departmentCode ?? '').trim().toUpperCase();
  return dept ? `${normalized} (${dept})` : normalized;
}

export function isValidVacafNumber(value: string) {
  const normalized = normalizeVacafNumberInput(value);
  if (!normalized) return true;
  return VACAF_NUMBER_REGEX.test(normalized);
}

export function validateVacafNumber(value: string) {
  const normalized = normalizeVacafNumberInput(value);
  if (!normalized) return null;
  return VACAF_NUMBER_REGEX.test(normalized) ? null : VACAF_NUMBER_MESSAGE;
}

export function validateVacafDepartmentCode(input: {
  vacafNumber?: string | null;
  vacafDepartmentCode?: string | null;
  isValidDepartmentCode: (code: string) => boolean;
}) {
  const hasVacaf = Boolean(normalizeVacafNumberInput(String(input.vacafNumber ?? '')));
  if (!hasVacaf) return null;
  const code = String(input.vacafDepartmentCode ?? '').trim();
  if (!code || !input.isValidDepartmentCode(code)) {
    return VACAF_DEPARTMENT_MESSAGE;
  }
  return null;
}

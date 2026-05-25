export const PASSWORD_POLICY_MIN_LENGTH = 8;
export const PASSWORD_POLICY_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.';

/**
 * Pattern HTML (attribut `pattern`) aligné avec la validation serveur.
 * - au moins 8 caractères
 * - au moins une majuscule
 * - au moins un chiffre
 * - au moins un caractère spécial (hors espace)
 */
export const PASSWORD_POLICY_HTML_PATTERN =
  '(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).{8,}';

export function isPasswordPolicyValid(password: string): boolean {
  if (password.length < PASSWORD_POLICY_MIN_LENGTH) return false;
  if (!/[A-ZÀ-ÖØ-Þ]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9\s]/.test(password)) return false;
  return true;
}

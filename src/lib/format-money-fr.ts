/** Formate un montant en centimes avec symbole monétaire (FR), en forçant un code ISO 4217 valide. */
export function formatMoneyCentsFr(cents: number, currencyCode?: string | null): string {
  const raw = (currencyCode ?? 'EUR').trim().toUpperCase();
  const code = /^[A-Z]{3}$/.test(raw) ? raw : 'EUR';
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  };
  try {
    return new Intl.NumberFormat('fr-FR', options).format(cents / 100);
  } catch {
    return new Intl.NumberFormat('fr-FR', { ...options, currency: 'EUR' }).format(cents / 100);
  }
}

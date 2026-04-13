import { ZodError } from 'zod';
import { CheckoutValidationError } from '@/lib/checkout/pricing';

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return first?.message ?? 'Données invalides.';
  }

  if (error instanceof CheckoutValidationError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Une erreur est survenue.';
}

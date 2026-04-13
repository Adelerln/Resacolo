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

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim().length > 0) return msg.trim();
  }

  return 'Une erreur est survenue.';
}

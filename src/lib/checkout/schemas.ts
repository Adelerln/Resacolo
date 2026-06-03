import { z } from 'zod';
import {
  normalizeAncvConnectMatriculeInput,
  validateAncvConnectMatricule
} from '@/lib/ancv-connect-matricule';
import { VACAF_NUMBER_MESSAGE, VACAF_NUMBER_OPTIONAL_REGEX } from '@/lib/vacaf-number';

const nullableIdSchema = z.string().trim().min(1).nullable();

/** Chaîne issue du JSON (localStorage / fetch) : `null` est courant, Zod `.optional()` seul ne l’accepte pas. */
const trimmedStringFromJson = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : v).trim());

export const cartSelectionSchema = z.object({
  sessionId: nullableIdSchema,
  transportMode: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? 'Sans transport' : v),
    z.string().trim().min(1)
  ),
  transportOptionId: nullableIdSchema,
  departureTransportOptionId: nullableIdSchema,
  returnTransportOptionId: nullableIdSchema,
  departureCity: z.string().trim().nullable(),
  returnCity: z.string().trim().nullable(),
  insuranceOptionId: nullableIdSchema,
  extraOptionId: nullableIdSchema
});

export const cartItemSelectionLabelsSchema = z
  .object({
    // Aligné sur CartItemSelectionLabels : les lignes peuvent être null côté UI / ajout panier.
    sessionLine: z.string().trim().nullable().optional(),
    transportLine: z.string().trim().nullable().optional(),
    insuranceLine: z.string().trim().nullable().optional(),
    extraLine: z.string().trim().nullable().optional()
  })
  .optional();

export const cartItemSchema = z.object({
  id: z.string().trim().min(1),
  stayId: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  organizerId: z.string().trim().min(1),
  organizerName: z.string().trim().min(1),
  location: z.string().trim().min(1),
  duration: z.string().trim().min(1),
  ageRange: z.string().trim().min(1),
  coverImage: z.preprocess((v) => (v === null ? undefined : v), z.string().trim().optional()),
  unitPrice: z.number().nullable(),
  selection: cartSelectionSchema,
  selectionLabels: z.preprocess((v) => (v === null ? undefined : v), cartItemSelectionLabelsSchema),
  addedAt: z.string().trim().min(1)
});

export const cartItemsSchema = z.array(cartItemSchema).min(1, 'Votre panier est vide.');

const checkoutPaymentModeSchema = z
  .union([z.enum(['FULL', 'DEPOSIT_200', 'CV_CONNECT', 'CV_PAPER', 'DEFERRED']), z.null(), z.undefined()])
  .transform((v) => v ?? 'FULL');

const organizerSelectionSchema = z.object({
  paymentMode: checkoutPaymentModeSchema,
  vacafNumber: trimmedStringFromJson.pipe(
    z.string().regex(VACAF_NUMBER_OPTIONAL_REGEX, VACAF_NUMBER_MESSAGE)
  ),
  ancvConnectMatricule: trimmedStringFromJson,
  ancvConnectAmount: trimmedStringFromJson
});

function validateAncvConnectFields(
  data: {
    paymentMode: string;
    ancvConnectMatricule: string;
    ancvConnectAmount: string;
  },
  ctx: z.RefinementCtx,
  prefixPath: Array<string | number> = []
) {
  if (data.paymentMode !== 'CV_CONNECT') return;

  if (!data.ancvConnectMatricule.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...prefixPath, 'ancvConnectMatricule'],
      message: 'Matricule ANCV Connect requis.'
    });
    return;
  }

  const matriculeError = validateAncvConnectMatricule(data.ancvConnectMatricule);
  if (matriculeError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...prefixPath, 'ancvConnectMatricule'],
      message: matriculeError
    });
  }

  const normalized = data.ancvConnectAmount.replace(',', '.').trim();
  const amount = Number(normalized);
  if (!normalized || !Number.isFinite(amount) || amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...prefixPath, 'ancvConnectAmount'],
      message: 'Montant ANCV Connect invalide.'
    });
  }
}

export const checkoutContactSchema = z.object({
  billingFirstName: trimmedStringFromJson.pipe(z.string().min(2, 'Prénom requis.')),
  billingLastName: trimmedStringFromJson.pipe(z.string().min(2, 'Nom requis.')),
  email: trimmedStringFromJson.pipe(z.string().email('Adresse email invalide.')),
  phone: trimmedStringFromJson.pipe(z.string().min(8, 'Numéro de téléphone invalide.')),
  addressLine1: trimmedStringFromJson.pipe(z.string().min(3, 'Adresse requise.')),
  addressLine2: trimmedStringFromJson,
  postalCode: trimmedStringFromJson.pipe(z.string().min(4, 'Code postal requis.')),
  city: trimmedStringFromJson.pipe(z.string().min(2, 'Ville requise.')),
  country: trimmedStringFromJson.pipe(z.string().min(2, 'Pays requis.')),
  hasSeparateBillingAddress: z
    .union([z.boolean(), z.null(), z.undefined()])
    .transform((v) => Boolean(v)),
  billingAddressLine1: trimmedStringFromJson,
  billingAddressLine2: trimmedStringFromJson,
  billingPostalCode: trimmedStringFromJson,
  billingCity: trimmedStringFromJson,
  billingCountry: trimmedStringFromJson.transform((s) => s || 'France'),
  cseOrganization: trimmedStringFromJson,
  vacafNumber: trimmedStringFromJson.pipe(
    z.string().regex(VACAF_NUMBER_OPTIONAL_REGEX, VACAF_NUMBER_MESSAGE)
  ),
  ancvConnectMatricule: trimmedStringFromJson,
  ancvConnectAmount: trimmedStringFromJson,
  paymentMode: checkoutPaymentModeSchema,
  organizerSelections: z.record(z.string().trim().min(1), organizerSelectionSchema).optional().default({}),
  acceptsTerms: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter les CGV.' })
  }),
  acceptsPrivacy: z
    .union([z.boolean(), z.null(), z.undefined()])
    .transform((v) => (v === null || v === undefined ? true : v))
}).superRefine((data, ctx) => {
  if (!data.hasSeparateBillingAddress) return;

  if (!data.billingAddressLine1 || data.billingAddressLine1.trim().length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billingAddressLine1'],
      message: 'Adresse de facturation requise.'
    });
  }

  if (!data.billingPostalCode || data.billingPostalCode.trim().length < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billingPostalCode'],
      message: 'Code postal de facturation requis.'
    });
  }

  if (!data.billingCity || data.billingCity.trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billingCity'],
      message: 'Ville de facturation requise.'
    });
  }
}).superRefine((data, ctx) => {
  validateAncvConnectFields(data, ctx);

  for (const [organizerId, selection] of Object.entries(data.organizerSelections ?? {})) {
    validateAncvConnectFields(selection, ctx, ['organizerSelections', organizerId]);
  }
});

export const checkoutParticipantSchema = z.object({
  cartItemId: z.string().trim().min(1),
  childFirstName: trimmedStringFromJson.pipe(z.string().min(2, 'Prénom requis.')),
  childLastName: trimmedStringFromJson.pipe(z.string().min(2, 'Nom requis.')),
  childBirthdate: trimmedStringFromJson.pipe(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide (AAAA-MM-JJ).')
  ),
  childGender: z
    .union([z.enum(['MASCULIN', 'FEMININ']), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v == null ? '' : v)),
  additionalInfo: trimmedStringFromJson
});

export const checkoutParticipantsSchema = z.array(checkoutParticipantSchema).min(1);

export const checkoutSessionBodySchema = z.object({
  items: cartItemsSchema
});

export const checkoutContactBodySchema = z.object({
  contact: checkoutContactSchema
});

export const checkoutParticipantsBodySchema = z.object({
  participants: checkoutParticipantsSchema
});

export const checkoutPaymentIntentBodySchema = z.object({
  items: cartItemsSchema,
  contact: checkoutContactSchema,
  participants: checkoutParticipantsSchema
});

const checkoutManualConfirmSingleSchema = z.object({
  orderId: z.string().trim().min(1),
  paymentId: z.string().trim().min(1)
});

const checkoutManualConfirmBatchSchema = z.object({
  payments: z.array(checkoutManualConfirmSingleSchema).min(1)
});

export const checkoutManualConfirmBodySchema = z.union([
  checkoutManualConfirmSingleSchema,
  checkoutManualConfirmBatchSchema
]);

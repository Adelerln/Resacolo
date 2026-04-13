import { z } from 'zod';

const nullableIdSchema = z.string().trim().min(1).nullable();

export const cartSelectionSchema = z.object({
  sessionId: nullableIdSchema,
  transportMode: z.string().trim().min(1),
  transportOptionId: nullableIdSchema,
  departureTransportOptionId: nullableIdSchema,
  returnTransportOptionId: nullableIdSchema,
  departureCity: z.string().trim().nullable(),
  returnCity: z.string().trim().nullable(),
  insuranceOptionId: nullableIdSchema,
  extraOptionId: nullableIdSchema
});

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
  coverImage: z.string().trim().optional(),
  unitPrice: z.number().nullable(),
  selection: cartSelectionSchema,
  addedAt: z.string().trim().min(1)
});

export const cartItemsSchema = z.array(cartItemSchema).min(1, 'Votre panier est vide.');

export const checkoutContactSchema = z.object({
  billingFirstName: z.string().trim().min(2, 'Prénom requis.'),
  billingLastName: z.string().trim().min(2, 'Nom requis.'),
  email: z.string().trim().email('Adresse email invalide.'),
  phone: z.string().trim().min(8, 'Numéro de téléphone invalide.'),
  addressLine1: z.string().trim().min(3, 'Adresse requise.'),
  addressLine2: z.string().trim().optional().default(''),
  postalCode: z.string().trim().min(4, 'Code postal requis.'),
  city: z.string().trim().min(2, 'Ville requise.'),
  country: z.string().trim().min(2, 'Pays requis.'),
  hasSeparateBillingAddress: z.boolean().optional().default(false),
  billingAddressLine1: z.string().trim().optional().default(''),
  billingAddressLine2: z.string().trim().optional().default(''),
  billingPostalCode: z.string().trim().optional().default(''),
  billingCity: z.string().trim().optional().default(''),
  billingCountry: z.string().trim().optional().default('France'),
  cseOrganization: z.string().trim().optional().default(''),
  vacafNumber: z
    .string()
    .trim()
    .regex(/^$|^\d{7}[A-Za-z]?$/, 'Le numéro allocataire doit contenir 7 chiffres, ou 7 chiffres et 1 lettre.')
    .optional()
    .default(''),
  paymentMode: z
    .enum(['FULL', 'DEPOSIT_200', 'CV_CONNECT', 'CV_PAPER', 'DEFERRED'])
    .optional()
    .default('FULL'),
  acceptsTerms: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter les CGV.' })
  }),
  acceptsPrivacy: z.boolean().optional().default(true)
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
});

export const checkoutParticipantSchema = z.object({
  cartItemId: z.string().trim().min(1),
  childFirstName: z.string().trim().min(2, 'Prénom requis.'),
  childLastName: z.string().trim().min(2, 'Nom requis.'),
  childBirthdate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide (AAAA-MM-JJ).'),
  childGender: z.enum(['MASCULIN', 'FEMININ']).or(z.literal('')).optional().default(''),
  additionalInfo: z.string().trim().optional().default('')
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

export const checkoutManualConfirmBodySchema = z.object({
  orderId: z.string().trim().min(1),
  paymentId: z.string().trim().min(1)
});

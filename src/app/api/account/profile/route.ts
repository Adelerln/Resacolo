import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { checkoutParticipantSchema } from '@/lib/checkout/schemas';
import { getApiErrorMessage } from '@/lib/checkout/api';
import {
  getFamilyProfileSnapshot,
  patchFamilyProfileParent2,
  upsertFamilyProfileFromCheckout
} from '@/lib/account-profile/server';

export const runtime = 'nodejs';

const parent2UpdateSchema = z
  .object({
    parent2Name: z.string().trim().default(''),
    parent2Status: z.enum(['pere', 'mere', 'grand-parent', 'autre']).default('pere'),
    parent2StatusOther: z.string().trim().default(''),
    parent2Phone: z.string().trim().default(''),
    parent2Email: z.string().trim().default('').refine((value) => !value || /.+@.+\..+/.test(value), {
      message: 'Email parent 2 invalide.'
    }),
    parent2HasDifferentAddress: z.boolean().default(false),
    parent2AddressLine1: z.string().trim().default(''),
    parent2AddressLine2: z.string().trim().default(''),
    parent2PostalCode: z.string().trim().default(''),
    parent2City: z.string().trim().default('')
  })
  .superRefine((data, ctx) => {
    if (data.parent2Status === 'autre' && !data.parent2StatusOther.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent2StatusOther'],
        message: 'Précisez le statut parent 2.'
      });
    }

    if (!data.parent2HasDifferentAddress) return;

    if (!data.parent2AddressLine1.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent2AddressLine1'],
        message: 'Adresse parent 2 requise.'
      });
    }
    if (!data.parent2PostalCode.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent2PostalCode'],
        message: 'Code postal parent 2 requis.'
      });
    }
    if (!data.parent2City.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent2City'],
        message: 'Ville parent 2 requise.'
      });
    }
  });

const checkoutProfileContactSchema = z
  .object({
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
    acceptsTerms: z.boolean().optional().default(false),
    acceptsPrivacy: z.boolean().optional().default(true)
  })
  .superRefine((data, ctx) => {
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

const patchSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('checkout'),
    contact: checkoutProfileContactSchema,
    participants: z.array(checkoutParticipantSchema).default([])
  }),
  z.object({
    source: z.literal('mon-compte'),
    parent2: parent2UpdateSchema
  })
]);

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const snapshot = await getFamilyProfileSnapshot({
      userId: session.userId,
      sessionName: session.name,
      sessionEmail: session.email
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());

    if (body.source === 'checkout') {
      const profile = await upsertFamilyProfileFromCheckout({
        userId: session.userId,
        contact: body.contact,
        participants: body.participants,
        sessionName: session.name,
        sessionEmail: session.email
      });
      return NextResponse.json({ profile });
    }

    const profile = await patchFamilyProfileParent2({
      userId: session.userId,
      patch: body.parent2,
      sessionName: session.name,
      sessionEmail: session.email
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

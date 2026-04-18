import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const partnerContactSchema = z.object({
  institution: z.string().trim().min(2).max(180),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  formula: z.enum(['Formule Sérénité', 'Formule Identité']),
  message: z.string().trim().min(10).max(4000)
});

export async function POST(request: Request) {
  try {
    const input = partnerContactSchema.parse(await request.json());

    // TODO: brancher ici le transport réel (email / CRM / base de données).
    console.info('[partner-contact] message reçu', {
      institution: input.institution,
      name: input.name,
      email: input.email,
      formula: input.formula,
      messageLength: input.message.length,
      receivedAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Formulaire invalide.',
          issues: error.issues
        },
        { status: 400 }
      );
    }

    console.error('[partner-contact] erreur', error);
    return NextResponse.json(
      {
        error: 'Impossible de traiter la demande actuellement.'
      },
      { status: 500 }
    );
  }
}

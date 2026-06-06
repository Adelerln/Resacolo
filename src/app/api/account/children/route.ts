import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createFamilyChild, listFamilyChildren } from '@/lib/account-children.server';

const childPayloadSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.'),
  lastName: z.string().trim().min(1, 'Nom requis.'),
  birthdate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide.'),
  gender: z.union([z.literal(''), z.literal('MASCULIN'), z.literal('FEMININ')]).default(''),
  additionalInfo: z.string().trim().optional().default('')
});

function getApiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erreur inconnue.';
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const children = await listFamilyChildren(session.userId);
    return NextResponse.json({ children });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const body = z.object({ child: childPayloadSchema }).parse(await req.json());
    const child = await createFamilyChild({
      userId: session.userId,
      child: body.child
    });
    return NextResponse.json({ child }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

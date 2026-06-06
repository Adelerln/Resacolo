import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { deleteFamilyChild, updateFamilyChild } from '@/lib/account-children.server';

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

export async function PATCH(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const { childId } = await params;
    const body = z.object({ child: childPayloadSchema }).parse(await req.json());
    const child = await updateFamilyChild({
      userId: session.userId,
      childId,
      child: body.child
    });
    return NextResponse.json({ child });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ childId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'CLIENT') {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const { childId } = await params;
    await deleteFamilyChild({
      userId: session.userId,
      childId
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

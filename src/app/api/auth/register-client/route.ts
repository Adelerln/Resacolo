import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { getApiErrorMessage } from '@/lib/checkout/api';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const registerClientSchema = z.object({
  firstName: z.string().trim().min(2, 'Prénom requis.'),
  lastName: z.string().trim().min(2, 'Nom requis.'),
  email: z.string().trim().email('Adresse email invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    const input = registerClientSchema.parse(body);
    const email = input.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser?.passwordHash) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cette adresse email.' }, { status: 409 });
    }

    const name = `${input.firstName} ${input.lastName}`.trim();
    const passwordHash = hashPassword(input.password);

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: name || existingUser.name,
            passwordHash,
            status: existingUser.status ?? 'ACTIVE'
          }
        })
      : await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            status: 'ACTIVE'
          }
        });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'CLIENT',
      tenantId: null
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cette adresse email.' }, { status: 409 });
    }
    console.error('[register-client]', error);
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 500 });
  }
}

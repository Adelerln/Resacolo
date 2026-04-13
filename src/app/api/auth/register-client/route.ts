import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const registerClientSchema = z.object({
  firstName: z.string().trim().min(2, 'Prénom requis.'),
  lastName: z.string().trim().min(2, 'Nom requis.'),
  email: z.string().trim().email('Adresse email invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
});

export async function POST(req: Request) {
  const input = registerClientSchema.parse(await req.json());
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
}

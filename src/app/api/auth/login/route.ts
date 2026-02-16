import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSessionCookie, type AppRole } from '@/lib/auth/session';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function mapRole(memberships: { role: string; tenantId: string | null }[]): {
  role: AppRole;
  tenantId?: string | null;
} {
  const admin = memberships.find((m) => m.role === 'PLATFORM_ADMIN');
  if (admin) return { role: 'ADMIN', tenantId: null };

  const organizer = memberships.find((m) => m.role === 'ORGANIZER_ADMIN' || m.role === 'ORGANIZER_AGENT');
  if (organizer) return { role: 'ORGANISATEUR', tenantId: organizer.tenantId };

  const partner = memberships.find((m) => m.role === 'PARTNER_ADMIN' || m.role === 'PARTNER_AGENT');
  if (partner) return { role: 'PARTENAIRE', tenantId: partner.tenantId };

  return { role: 'PARTENAIRE', tenantId: null };
}

export async function POST(req: Request) {
  if (process.env.MOCK_UI === '1') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  const contentType = req.headers.get('content-type') ?? '';
  const data =
    contentType.includes('application/json')
      ? await req.json()
      : Object.fromEntries(await req.formData());
  const input = loginSchema.parse(data);

  const { prisma } = await import('@/lib/db');
  const { verifyPassword } = await import('@/lib/auth/password');
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { memberships: true }
  });

  if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const { role, tenantId } = mapRole(
    user.memberships.map((m: { role: string; tenantId: string | null }) => ({
      role: m.role,
      tenantId: m.tenantId ?? null
    }))
  );

  setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    tenantId
  });

  return NextResponse.redirect(
    new URL(role === 'ADMIN' ? '/admin' : role === 'ORGANISATEUR' ? '/organisme' : '/partenaire', req.url)
  );
}

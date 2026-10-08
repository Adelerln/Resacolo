import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api';
import { listSubEntitiesForCollectivityCode } from '@/lib/partner-sub-entities.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { unauthorized } = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const code = new URL(req.url).searchParams.get('code')?.trim() ?? '';
  if (!code) {
    return NextResponse.json({ error: 'Code CSE requis.' }, { status: 400 });
  }

  try {
    const info = await listSubEntitiesForCollectivityCode(code);
    if (!info) {
      return NextResponse.json({ error: 'Code CSE invalide.' }, { status: 404 });
    }
    return NextResponse.json({
      collectivityName: info.collectivityName,
      subEntitiesEnabled: info.subEntitiesEnabled,
      subEntities: info.subEntities
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impossible de charger les sous-entités.' },
      { status: 500 }
    );
  }
}

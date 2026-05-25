import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { resolveRoleContextForUserId } from '@/lib/auth/roles';
import {
  addFavoriteForUserId,
  getFavoriteStayIdsForUserId,
  removeFavoriteForUserId
} from '@/lib/favorites.server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

async function requireClientUserId() {
  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({ cookies: cookieAccess });
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  const roleContext = await resolveRoleContextForUserId(user.id);
  return roleContext.role === 'CLIENT' ? user.id : null;
}

export async function GET(request: Request) {
  void request;
  const userId = await requireClientUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized', stayIds: [] }, { status: 401 });
  }
  try {
    const stayIds = await getFavoriteStayIdsForUserId(userId);
    return NextResponse.json({ stayIds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'server', stayIds: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = await requireClientUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await addFavoriteForUserId(userId, body);
  if (result.error === 'INVALID_STAY_ID') {
    return NextResponse.json({ error: 'invalid_stay_id' }, { status: 400 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = await requireClientUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await removeFavoriteForUserId(userId, body);
  if (result.error === 'INVALID_STAY_ID') {
    return NextResponse.json({ error: 'invalid_stay_id' }, { status: 400 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

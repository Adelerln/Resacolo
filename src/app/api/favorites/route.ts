import { NextResponse } from 'next/server';
import { addFavorite, getFavorites, removeFavorite } from '@/lib/favorites.server';

export async function GET(request: Request) {
  const result = await getFavorites(request);
  if (result.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'unauthorized', stayIds: [] }, { status: 401 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error, stayIds: [] }, { status: 500 });
  }
  return NextResponse.json({ stayIds: result.stayIds });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await addFavorite(request, body);
  if (result.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
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
  const result = await removeFavorite(request, body);
  if (result.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (result.error === 'INVALID_STAY_ID') {
    return NextResponse.json({ error: 'invalid_stay_id' }, { status: 400 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

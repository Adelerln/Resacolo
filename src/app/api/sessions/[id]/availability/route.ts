import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type SessionRow = Pick<
  Database['public']['Tables']['sessions']['Row'],
  'id' | 'status' | 'capacity_total' | 'capacity_reserved'
>;

export const runtime = 'nodejs';
export const revalidate = 0;

function isSessionAvailable(session: SessionRow) {
  if (session.status !== 'OPEN') {
    return false;
  }

  if (session.capacity_reserved >= session.capacity_total) {
    return false;
  }

  return true;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = id?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('id,status,capacity_total,capacity_reserved')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: data.id,
    status: data.status,
    capacityTotal: data.capacity_total,
    capacityReserved: data.capacity_reserved,
    available: isSessionAvailable(data)
  });
}

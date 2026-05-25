import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { STAY_VISIT_AUDIT_ACTION, STAY_VISIT_ENTITY_TYPE } from '@/lib/stay-visits';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stayId = id?.trim();

  if (!stayId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  await supabase.from('audit_logs').insert({
    action: STAY_VISIT_AUDIT_ACTION,
    entity_type: STAY_VISIT_ENTITY_TYPE,
    entity_id: stayId,
    diff: { source: 'public_stay_page' }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import {
  readResacoloBillingSettings,
  resolveOrganizerCommissionPercent
} from '@/lib/resacolo-billing-settings.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id: idOrSlug } = await context.params;
  const formData = await req.formData();
  const notes = String(formData.get('notes') ?? '').trim();

  const supabase = getServerSupabaseClient();
  let { data: organizer } = await supabase
    .from('organizers')
    .select('id,slug,is_founding_member,is_resacolo_member')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id,slug,is_founding_member,is_resacolo_member')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    return NextResponse.redirect(new URL(`/admin/organizers/${idOrSlug}?error=Organisme%20introuvable`, req.url), 303);
  }

  const urlSlug = organizer.slug ?? organizer.id;
  const settings = await readResacoloBillingSettings(supabase);
  const { error } = await supabase.from('organizer_billing_settings').upsert(
    {
      organizer_id: organizer.id,
      commission_percent: resolveOrganizerCommissionPercent(organizer, settings),
      publication_fee_cents: settings.publication_fee_enabled ? Number(settings.publication_fee_cents) || 0 : 0,
      notes: notes || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'organizer_id' }
  );

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/organizers/${urlSlug}?error=${encodeURIComponent(error.message)}`, req.url),
      303
    );
  }

  return NextResponse.redirect(new URL(`/admin/organizers/${urlSlug}?billingSuccess=1`, req.url), 303);
}

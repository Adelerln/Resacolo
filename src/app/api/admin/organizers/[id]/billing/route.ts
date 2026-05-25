import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function parsePercent(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0 || v > 100) return null;
  return v;
}

function parseEurosToCents(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const euros = Number(s);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id: idOrSlug } = await context.params;
  const formData = await req.formData();
  const commissionRaw = String(formData.get('commission_percent') ?? '');
  const feeEurosRaw = String(formData.get('publication_fee_euros') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  const commission = parsePercent(commissionRaw);
  const publicationFeeCents = parseEurosToCents(feeEurosRaw);

  const supabase = getServerSupabaseClient();
  let { data: organizer } = await supabase.from('organizers').select('id,slug').eq('slug', idOrSlug).maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase.from('organizers').select('id,slug').eq('id', idOrSlug).maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    return NextResponse.redirect(new URL(`/admin/organizers/${idOrSlug}?error=Organisme%20introuvable`, req.url), 303);
  }

  const urlSlug = organizer.slug ?? organizer.id;

  if (commission === null || publicationFeeCents === null) {
    return NextResponse.redirect(
      new URL(
        `/admin/organizers/${urlSlug}?error=${encodeURIComponent(
          'Commission et forfait de publication : valeurs numériques obligatoires (0 autorisé).'
        )}`,
        req.url
      ),
      303
    );
  }

  const { error } = await supabase.from('organizer_billing_settings').upsert(
    {
      organizer_id: organizer.id,
      commission_percent: commission,
      publication_fee_cents: publicationFeeCents,
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

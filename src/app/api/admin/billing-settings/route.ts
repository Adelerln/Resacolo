import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import {
  readResacoloBillingSettings,
  syncOrganizerBillingSettings
} from '@/lib/resacolo-billing-settings.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function parsePercent(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

function parseEurosToCents(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export async function POST(req: Request) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const formData = await req.formData();
  const foundingRaw = String(formData.get('founding_member_commission_percent') ?? '');
  const memberRaw = String(formData.get('resacolo_member_commission_percent') ?? '');
  const externalRaw = String(formData.get('external_commission_percent') ?? '');
  const publicationFeeEnabled = formData.get('publication_fee_enabled') === 'on';
  const publicationFeeEurosRaw = String(formData.get('publication_fee_euros') ?? '0');

  const founding = parsePercent(foundingRaw);
  const member = parsePercent(memberRaw);
  const external = parsePercent(externalRaw);
  const publicationFeeCents = parseEurosToCents(publicationFeeEurosRaw);

  if (founding === null || member === null || external === null || publicationFeeCents === null) {
    return NextResponse.redirect(
      new URL(
        `/admin/organizers?settingsError=${encodeURIComponent(
          'Renseignez trois pourcentages valides et un montant numérique pour les frais de publication.'
        )}`,
        req.url
      ),
      303
    );
  }

  const supabase = getServerSupabaseClient();
  const currentSettings = await readResacoloBillingSettings(supabase);
  const updatedAt = new Date().toISOString();

  const { error: settingsError } = await supabase.from('resacolo_billing_settings').upsert(
    {
      id: currentSettings.id || 'default',
      founding_member_commission_percent: founding,
      resacolo_member_commission_percent: member,
      external_commission_percent: external,
      publication_fee_enabled: publicationFeeEnabled,
      publication_fee_cents: publicationFeeCents,
      updated_at: updatedAt
    },
    { onConflict: 'id' }
  );

  if (settingsError) {
    return NextResponse.redirect(
      new URL(`/admin/organizers?settingsError=${encodeURIComponent(settingsError.message)}`, req.url),
      303
    );
  }

  const { data: organizers, error: organizersError } = await supabase
    .from('organizers')
    .select('id, is_founding_member, is_resacolo_member');

  if (organizersError) {
    return NextResponse.redirect(
      new URL(`/admin/organizers?settingsError=${encodeURIComponent(organizersError.message)}`, req.url),
      303
    );
  }

  try {
    await syncOrganizerBillingSettings(supabase, organizers ?? [], {
      ...currentSettings,
      id: currentSettings.id || 'default',
      founding_member_commission_percent: founding,
      resacolo_member_commission_percent: member,
      external_commission_percent: external,
      publication_fee_enabled: publicationFeeEnabled,
      publication_fee_cents: publicationFeeCents,
      updated_at: updatedAt
    }, {
      source: 'GLOBAL_SETTINGS',
      effectiveAtIso: updatedAt
    });
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/organizers?settingsError=${encodeURIComponent(
          error instanceof Error ? error.message : 'Impossible de synchroniser les organismes.'
        )}`,
        req.url
      ),
      303
    );
  }

  revalidatePath('/admin/organizers');
  revalidatePath('/admin/finances');
  revalidatePath('/mnemos/organizers');
  revalidatePath('/mnemos/billing');

  return NextResponse.redirect(new URL('/admin/organizers?settingsSaved=1', req.url), 303);
}

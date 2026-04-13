'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { allocateInvoiceNumber } from '@/lib/mnemos/allocate-invoice-number.server';
import {
  loadLedgerCommissionLines,
  loadLedgerPublicationLines,
  sumCents
} from '@/lib/mnemos/ledger-period-preview.server';
import { invoiceYearFromRange, periodEndExclusive, periodStartIso } from '@/lib/mnemos/period-bounds';
import { getServerSupabaseClient } from '@/lib/supabase/server';

function formatFrDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

function billingReturnQuery(fd: FormData): string {
  const o = String(fd.get('organizer_id') ?? '').trim();
  const s = String(fd.get('start_date') ?? '').trim();
  const e = String(fd.get('end_date') ?? '').trim();
  return `organizer_id=${encodeURIComponent(o)}&start_date=${encodeURIComponent(s)}&end_date=${encodeURIComponent(e)}`;
}

export async function createPublicationPeriodInvoice(formData: FormData) {
  const session = await requireRole('ADMIN');
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const startDate = String(formData.get('start_date') ?? '').trim();
  const endDate = String(formData.get('end_date') ?? '').trim();
  const base = `/mnemos/billing?${billingReturnQuery(formData)}`;
  if (!organizerId || !startDate || !endDate) {
    redirect(`${base}&flash_err=${encodeURIComponent('Organisateur et période requis.')}`);
  }

  const supabase = getServerSupabaseClient();
  const startIso = periodStartIso(startDate);
  const endIso = periodEndExclusive(endDate);
  const { lines, error } = await loadLedgerPublicationLines(supabase, organizerId, startIso, endIso);
  if (error) {
    redirect(`${base}&flash_err=${encodeURIComponent(error)}`);
  }
  const total = sumCents(lines);
  if (total <= 0) {
    redirect(`${base}&flash_err=${encodeURIComponent('Aucun montant publication sur cette période.')}`);
  }

  const year = invoiceYearFromRange(endDate);
  const number = await allocateInvoiceNumber(supabase, year);
  const labelPrefix = `Publication — ${formatFrDate(startIso)} au ${formatFrDate(endIso)}`;

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      organizer_id: organizerId,
      invoice_type: 'MNEMOS_PUBLICATION_PERIOD',
      status: 'ISSUED',
      total_cents: total,
      year,
      number,
      issued_at: new Date().toISOString(),
      client_user_id: null,
      collectivity_id: null,
      order_id: null,
      pdf_url: null
    })
    .select('id')
    .single();

  if (invErr || !invoice) {
    redirect(`${base}&flash_err=${encodeURIComponent(invErr?.message ?? 'Création facture impossible.')}`);
  }

  const lineRows = lines.map((l) => ({
    invoice_id: invoice.id,
    label: `${labelPrefix} (${l.channel}${l.stay_id ? ` · séjour ${l.stay_id.slice(0, 8)}…` : ''})`,
    amount_cents: l.amount_cents
  }));

  const { error: linesErr } = await supabase.from('invoice_lines').insert(lineRows);
  if (linesErr) {
    await supabase.from('invoices').delete().eq('id', invoice.id);
    redirect(`${base}&flash_err=${encodeURIComponent(linesErr.message)}`);
  }

  await supabase.from('organizer_billing_events').insert({
    organizer_id: organizerId,
    event_type: 'INVOICE_PUBLICATION_PERIOD',
    invoice_id: invoice.id,
    metadata: {
      period_start: startIso,
      period_end_exclusive: endIso,
      ledger_line_ids: lines.map((l) => l.id),
      created_by: session.userId
    },
    created_by_user_id: session.userId
  });

  revalidatePath('/mnemos/billing');
  revalidatePath(`/mnemos/organizers/${organizerId}`);
  redirect(`${base}&flash=${encodeURIComponent('Facture publication créée.')}`);
}

export async function createCommissionPeriodInvoice(formData: FormData) {
  const session = await requireRole('ADMIN');
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const startDate = String(formData.get('start_date') ?? '').trim();
  const endDate = String(formData.get('end_date') ?? '').trim();
  const base = `/mnemos/billing?${billingReturnQuery(formData)}`;
  if (!organizerId || !startDate || !endDate) {
    redirect(`${base}&flash_err=${encodeURIComponent('Organisateur et période requis.')}`);
  }

  const supabase = getServerSupabaseClient();
  const startIso = periodStartIso(startDate);
  const endIso = periodEndExclusive(endDate);
  const { lines, error } = await loadLedgerCommissionLines(supabase, organizerId, startIso, endIso);
  if (error) {
    redirect(`${base}&flash_err=${encodeURIComponent(error)}`);
  }
  const total = sumCents(lines);
  if (total <= 0) {
    redirect(`${base}&flash_err=${encodeURIComponent('Aucune commission sur cette période.')}`);
  }

  const year = invoiceYearFromRange(endDate);
  const number = await allocateInvoiceNumber(supabase, year);
  const labelPrefix = `Commission — ${formatFrDate(startIso)} au ${formatFrDate(endIso)}`;

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      organizer_id: organizerId,
      invoice_type: 'MNEMOS_COMMISSION_PERIOD',
      status: 'ISSUED',
      total_cents: total,
      year,
      number,
      issued_at: new Date().toISOString(),
      client_user_id: null,
      collectivity_id: null,
      order_id: null,
      pdf_url: null
    })
    .select('id')
    .single();

  if (invErr || !invoice) {
    redirect(`${base}&flash_err=${encodeURIComponent(invErr?.message ?? 'Création facture impossible.')}`);
  }

  const lineRows = lines.map((l) => ({
    invoice_id: invoice.id,
    label: `${labelPrefix} · ${l.channel}${l.order_item_id ? ` · ligne ${l.order_item_id.slice(0, 8)}…` : ''}`,
    amount_cents: l.amount_cents
  }));

  const { error: linesErr } = await supabase.from('invoice_lines').insert(lineRows);
  if (linesErr) {
    await supabase.from('invoices').delete().eq('id', invoice.id);
    redirect(`${base}&flash_err=${encodeURIComponent(linesErr.message)}`);
  }

  await supabase.from('organizer_billing_events').insert({
    organizer_id: organizerId,
    event_type: 'INVOICE_COMMISSION_PERIOD',
    invoice_id: invoice.id,
    metadata: {
      period_start: startIso,
      period_end_exclusive: endIso,
      ledger_line_ids: lines.map((l) => l.id),
      created_by: session.userId
    },
    created_by_user_id: session.userId
  });

  revalidatePath('/mnemos/billing');
  revalidatePath(`/mnemos/organizers/${organizerId}`);
  redirect(`${base}&flash=${encodeURIComponent('Facture commissions créée.')}`);
}

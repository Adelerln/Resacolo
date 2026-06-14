import 'server-only';

import { computePartnerContributionSnapshotCents } from '@/lib/partner-offers';
import { createAndUploadClientTravelInvoicePdf } from '@/lib/mnemos/invoice-pdf.server';
import { allocateInvoiceNumber } from '@/lib/mnemos/allocate-invoice-number.server';
import { resolveFamilyPaymentModeLabel } from '@/lib/order-workflow';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json, Database } from '@/types/supabase';

const CLIENT_TRAVEL_INVOICE_TYPE = 'CLIENT';

type InvoiceRow = Pick<
  Database['public']['Tables']['invoices']['Row'],
  'id' | 'number' | 'year' | 'pdf_url' | 'issued_at' | 'status' | 'total_cents'
>;

type InvoiceLineDraft = {
  label: string;
  amountCents: number;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function asRecord(value: Json | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate && !endDate) return '';
  if (startDate && endDate) {
    return `${new Date(`${startDate}T00:00:00Z`).toLocaleDateString('fr-FR')} - ${new Date(`${endDate}T00:00:00Z`).toLocaleDateString('fr-FR')}`;
  }
  const value = startDate ?? endDate;
  return value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('fr-FR') : '';
}

function resolveBillingSnapshot(
  paymentPayload: Json | null | undefined,
  fallbackClientName: string | null | undefined
) {
  const payload = asRecord(paymentPayload);
  const contact =
    payload?.contact && typeof payload.contact === 'object' && !Array.isArray(payload.contact)
      ? (payload.contact as Record<string, unknown>)
      : null;

  const billingFirstName = typeof contact?.billingFirstName === 'string' ? contact.billingFirstName.trim() : '';
  const billingLastName = typeof contact?.billingLastName === 'string' ? contact.billingLastName.trim() : '';
  const fullName =
    [billingFirstName, billingLastName].filter(Boolean).join(' ').trim() ||
    normalizeText(fallbackClientName) ||
    'Client Resacolo';

  const hasSeparateBillingAddress = contact?.hasSeparateBillingAddress === true;
  const addressLine1 = normalizeText(
    typeof contact?.addressLine1 === 'string' ? contact.addressLine1 : null
  );
  const addressLine2 = normalizeText(
    typeof contact?.addressLine2 === 'string' ? contact.addressLine2 : null
  );
  const postalCode = normalizeText(
    typeof contact?.postalCode === 'string' ? contact.postalCode : null
  );
  const city = normalizeText(typeof contact?.city === 'string' ? contact.city : null);
  const country = normalizeText(
    typeof contact?.country === 'string' ? contact.country : null
  ) || 'France';

  const billingAddressLine1 = normalizeText(
    typeof contact?.billingAddressLine1 === 'string' ? contact.billingAddressLine1 : null
  );
  const billingAddressLine2 = normalizeText(
    typeof contact?.billingAddressLine2 === 'string' ? contact.billingAddressLine2 : null
  );
  const billingPostalCode = normalizeText(
    typeof contact?.billingPostalCode === 'string' ? contact.billingPostalCode : null
  );
  const billingCity = normalizeText(
    typeof contact?.billingCity === 'string' ? contact.billingCity : null
  );
  const billingCountry = normalizeText(
    typeof contact?.billingCountry === 'string' ? contact.billingCountry : null
  ) || country;

  const firstLine = hasSeparateBillingAddress ? billingAddressLine1 : addressLine1;
  const secondLine = hasSeparateBillingAddress ? billingAddressLine2 : addressLine2;
  const zipCityLine = [hasSeparateBillingAddress ? billingPostalCode : postalCode, hasSeparateBillingAddress ? billingCity : city]
    .filter(Boolean)
    .join(' ');
  const countryLine = hasSeparateBillingAddress ? billingCountry : country;

  return {
    billingName: fullName,
    billingEmail: normalizeText(typeof contact?.email === 'string' ? contact.email : null) || null,
    billingAddressLines: [firstLine, secondLine, zipCityLine, countryLine].filter(Boolean)
  };
}

function buildExternalAidLabel(requestKind: string | null | undefined) {
  if (requestKind === 'VACAF') return 'Aide VACAF';
  return 'Aide externe';
}

async function buildClientTravelInvoiceModel(orderId: string) {
  const supabase = getServerSupabaseClient();
  let { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id,status,created_at,paid_at,client_user_id,collectivity_id,external_aid_cents,external_paid_cents,request_kind'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderError && isMissingAnyColumnError(orderError, ['external_aid_cents', 'external_paid_cents', 'request_kind'])) {
    const legacyResult = await supabase
      .from('orders')
      .select('id,status,created_at,paid_at,client_user_id,collectivity_id')
      .eq('id', orderId)
      .maybeSingle();

    order = legacyResult.data
      ? {
          ...legacyResult.data,
          external_aid_cents: 0,
          external_paid_cents: 0,
          request_kind: null
        }
      : null;
    orderError = legacyResult.error;
  }

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Commande introuvable pour la facture.');
  }
  if (order.status === 'CART' || order.status === 'CANCELLED') {
    throw new Error('Cette commande ne permet pas encore de générer une facture.');
  }

  const [{ data: payments }, { data: orderItems }, { data: clientRow }, { data: collectivityRow }] = await Promise.all([
    supabase
      .from('payments')
      .select('amount_cents,currency,status,raw_payload,updated_at')
      .eq('order_id', orderId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('order_items')
      .select('id,session_id,child_first_name,child_last_name,total_price_cents')
      .eq('order_id', orderId),
    order.client_user_id
      ? supabase.from('clients').select('full_name').eq('user_id', order.client_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.collectivity_id
      ? supabase.from('collectivities').select('id,name').eq('id', order.collectivity_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const sessionIds = Array.from(
    new Set((orderItems ?? []).map((item) => item.session_id).filter((value): value is string => Boolean(value)))
  );
  const [{ data: sessions }, { data: contributions }] = await Promise.all([
    sessionIds.length
      ? supabase.from('sessions').select('id,stay_id,start_date,end_date').in('id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ id: string; stay_id: string; start_date: string; end_date: string }> }),
    (orderItems ?? []).length
      ? supabase
          .from('collectivity_contributions')
          .select('order_item_id,mode,fixed_cents,percent_value,cap_cents,status')
          .in(
            'order_item_id',
            (orderItems ?? []).map((item) => item.id)
          )
          .eq('status', 'APPROVED')
      : Promise.resolve({
          data: [] as Array<{
            order_item_id: string;
            mode: string;
            fixed_cents: number | null;
            percent_value: number | null;
            cap_cents: number | null;
            status: Database['public']['Enums']['contribution_status'];
          }>
        })
  ]);

  const stayIds = Array.from(
    new Set((sessions ?? []).map((session) => session.stay_id).filter((value): value is string => Boolean(value)))
  );
  const { data: stays } = stayIds.length
    ? await supabase.from('stays').select('id,title,organizer_id').in('id', stayIds)
    : { data: [] as Array<{ id: string; title: string; organizer_id: string | null }> };

  const organizerIds = Array.from(
    new Set((stays ?? []).map((stay) => stay.organizer_id).filter((value): value is string => Boolean(value)))
  );
  const { data: organizers } = organizerIds.length
    ? await supabase.from('organizers').select('id,name').in('id', organizerIds)
    : { data: [] as Array<{ id: string; name: string | null }> };

  const sessionsById = new Map((sessions ?? []).map((session) => [session.id, session]));
  const staysById = new Map((stays ?? []).map((stay) => [stay.id, stay]));
  const organizersById = new Map((organizers ?? []).map((organizer) => [organizer.id, organizer]));
  const contributionsByOrderItemId = new Map((contributions ?? []).map((row) => [row.order_item_id, row]));

  const latestPayment = (payments ?? [])[0] ?? null;
  const onlinePaidCents = (payments ?? [])
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  const externalPaidCents = Math.max(0, order.external_paid_cents ?? 0);
  const paidCents = onlinePaidCents + externalPaidCents;
  const billing = resolveBillingSnapshot(latestPayment?.raw_payload, clientRow?.full_name ?? null);
  const currency = latestPayment?.currency ?? 'EUR';
  if (currency !== 'EUR') {
    throw new Error('La facture client ne gère actuellement que les paiements en EUR.');
  }

  const grossTotalCents = (orderItems ?? []).reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
  const partnerContributionCents = (orderItems ?? []).reduce((sum, item) => {
    const contribution = contributionsByOrderItemId.get(item.id);
    if (!contribution) return sum;
    return (
      sum +
      computePartnerContributionSnapshotCents({
        mode: contribution.mode,
        totalCents: item.total_price_cents ?? 0,
        percentValue: contribution.percent_value,
        fixedCents: contribution.fixed_cents,
        capCents: contribution.cap_cents
      })
    );
  }, 0);
  const externalAidCents = Math.max(0, order.external_aid_cents ?? 0);
  const clientTotalCents = Math.max(0, grossTotalCents - partnerContributionCents - externalAidCents);
  const remainingBalanceCents = Math.max(0, clientTotalCents - paidCents);

  const lines: InvoiceLineDraft[] = (orderItems ?? []).map((item) => {
    const session = item.session_id ? sessionsById.get(item.session_id) ?? null : null;
    const stay = session?.stay_id ? staysById.get(session.stay_id) ?? null : null;
    const childName = [normalizeText(item.child_first_name), normalizeText(item.child_last_name).toUpperCase()]
      .filter(Boolean)
      .join(' ')
      .trim();
    const sessionLabel = formatDateRange(session?.start_date, session?.end_date);
    const labelParts = [stay?.title ?? 'Séjour', childName || null, sessionLabel || null].filter(Boolean);

    return {
      label: labelParts.join(' - '),
      amountCents: item.total_price_cents ?? 0
    };
  });

  if (partnerContributionCents > 0) {
    lines.push({
      label: collectivityRow?.name
        ? `Prise en charge partenaire - ${collectivityRow.name}`
        : 'Prise en charge partenaire',
      amountCents: -partnerContributionCents
    });
  }

  if (externalAidCents > 0) {
    lines.push({
      label: buildExternalAidLabel(order.request_kind),
      amountCents: -externalAidCents
    });
  }

  const linesTotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (linesTotalCents !== clientTotalCents) {
    lines.push({
      label: 'Ajustement de facturation',
      amountCents: clientTotalCents - linesTotalCents
    });
  }

  const firstStay = staysById.get((sessionsById.get((orderItems ?? [])[0]?.session_id ?? '')?.stay_id ?? '') as string);
  const organizer =
    firstStay?.organizer_id ? organizersById.get(firstStay.organizer_id) ?? null : null;

  return {
    order,
    isProvisional: order.status !== 'PAID',
    lines,
    totalCents: clientTotalCents,
    issuedAt: order.paid_at ?? order.created_at,
    paidAt: order.paid_at ?? null,
    organizerName: organizer?.name ?? null,
    paymentModeLabel: resolveFamilyPaymentModeLabel(asRecord(latestPayment?.raw_payload)),
    billingName: billing.billingName,
    billingAddressLines: billing.billingAddressLines,
    billingEmail: billing.billingEmail,
    paidCents,
    remainingBalanceCents
  };
}

export async function ensureClientTravelInvoiceForOrder(orderId: string) {
  const supabase = getServerSupabaseClient();
  const model = await buildClientTravelInvoiceModel(orderId);

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id,number,year,pdf_url,issued_at,status,total_cents')
    .eq('order_id', orderId)
    .eq('invoice_type', CLIENT_TRAVEL_INVOICE_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let invoice = (existingInvoice as InvoiceRow | null) ?? null;
  if (!invoice) {
    const invoiceYear = new Date(model.issuedAt).getFullYear();
    const nextNumber = await allocateInvoiceNumber(supabase, invoiceYear);
    const { data: createdInvoice, error: createError } = await supabase
      .from('invoices')
      .insert({
        client_user_id: model.order.client_user_id,
        collectivity_id: model.order.collectivity_id,
        order_id: model.order.id,
        organizer_id: null,
        invoice_type: CLIENT_TRAVEL_INVOICE_TYPE,
        number: nextNumber,
        year: invoiceYear,
        status: model.isProvisional ? 'DRAFT' : 'ISSUED',
        issued_at: model.issuedAt,
        total_cents: model.totalCents,
        pdf_url: null
      })
      .select('id,number,year,pdf_url,issued_at,status,total_cents')
      .single();

    if (createError || !createdInvoice) {
      throw new Error(`Impossible de créer la facture client : ${createError?.message ?? 'insertion échouée'}`);
    }
    invoice = createdInvoice as InvoiceRow;
  }

  const shouldRefreshPdf =
    model.isProvisional ||
    !invoice.pdf_url ||
    invoice.status !== (model.isProvisional ? 'DRAFT' : 'ISSUED') ||
    invoice.issued_at !== model.issuedAt ||
    invoice.total_cents !== model.totalCents;

  if (shouldRefreshPdf) {
    await supabase.from('invoice_lines').delete().eq('invoice_id', invoice.id);

    if (model.lines.length > 0) {
      const { error: lineError } = await supabase.from('invoice_lines').insert(
        model.lines.map((line) => ({
          invoice_id: invoice!.id,
          label: line.label,
          amount_cents: line.amountCents
        }))
      );
      if (lineError) {
        throw new Error(`Impossible de créer les lignes de facture client : ${lineError.message}`);
      }
    }

    const pdfPath = await createAndUploadClientTravelInvoicePdf(supabase, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceYear: invoice.year,
      issuedAt: invoice.issued_at ?? model.issuedAt,
      paidAt: model.paidAt,
      isProvisional: model.isProvisional,
      orderId: model.order.id,
      organizerName: model.organizerName,
      billingName: model.billingName,
      billingAddressLines: model.billingAddressLines,
      billingEmail: model.billingEmail,
      paymentModeLabel: model.paymentModeLabel,
      totalCents: model.totalCents,
      paidCents: model.paidCents,
      remainingBalanceCents: model.remainingBalanceCents,
      lines: model.lines
    });

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        pdf_url: pdfPath,
        status: model.isProvisional ? 'DRAFT' : 'ISSUED',
        issued_at: model.issuedAt,
        total_cents: model.totalCents
      })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Impossible de finaliser la facture client : ${updateError.message}`);
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceYear: invoice.year,
      pdfPath
    };
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    invoiceYear: invoice.year,
    pdfPath: invoice.pdf_url
  };
}

export function isClientTravelInvoiceType(value: string | null | undefined) {
  return value === CLIENT_TRAVEL_INVOICE_TYPE;
}

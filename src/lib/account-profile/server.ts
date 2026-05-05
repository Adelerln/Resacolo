import type { Json, Database } from '@/types/supabase';
import type {
  FamilyCheckoutSyncInput,
  FamilyParent2Patch,
  FamilyProfile,
  FamilyProfileChild,
  FamilyProfileSnapshot,
  FamilyReservation
} from '@/types/family-profile';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type ClientProfileRow = Database['public']['Tables']['client_profiles']['Row'];
type ClientProfileInsert = Database['public']['Tables']['client_profiles']['Insert'];

const DEFAULT_COUNTRY = 'France';
const CLIENT_PROFILES_MISSING_ERROR =
  "Configuration incomplète: table 'public.client_profiles' absente. Appliquez les migrations Supabase avant de modifier les préférences.";
const LEGACY_CLIENTS_FK_RETRY_COUNT = 5;
const LEGACY_CLIENTS_FK_RETRY_DELAY_MS = 250;

function isMissingClientProfilesTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code ?? '').trim();
  const message = String(error.message ?? '');
  if (code === 'PGRST205') return true;
  return (
    message.includes('public.client_profiles') &&
    (message.includes('schema cache') || message.includes('Could not find the table') || message.includes('does not exist'))
  );
}

function isLegacyClientsUserForeignKeyError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code ?? '').trim();
  const message = String(error.message ?? '').toLowerCase();
  return code === '23503' && message.includes('clients_user_id_fkey');
}

function shouldIgnoreLegacyClientsSyncError(error: unknown): error is Error {
  return error instanceof Error && error.message.includes('clients_user_id_fkey');
}

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function waitForLegacyClientsRetry() {
  await new Promise((resolve) => setTimeout(resolve, LEGACY_CLIENTS_FK_RETRY_DELAY_MS));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function normalizeUpper(value: string | null | undefined) {
  return normalizeText(value).toUpperCase();
}

function normalizeParentStatus(value: string | null | undefined): FamilyProfile['parent2Status'] {
  if (value === 'pere' || value === 'mere' || value === 'grand-parent' || value === 'autre') {
    return value;
  }
  return 'pere';
}

function normalizePaymentMode(value: string | null | undefined): FamilyProfile['paymentMode'] {
  if (
    value === 'FULL' ||
    value === 'DEPOSIT_200' ||
    value === 'CV_CONNECT' ||
    value === 'CV_PAPER' ||
    value === 'DEFERRED'
  ) {
    return value;
  }
  return 'FULL';
}

function splitName(value: string | null | undefined) {
  const clean = normalizeText(value);
  if (!clean) {
    return { firstName: '', lastName: '' };
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function parseChildrenJson(value: Json | null): FamilyProfileChild[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): FamilyProfileChild | null => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return null;
      }
      const record = item as Record<string, unknown>;
      const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : '';
      const lastName = typeof record.lastName === 'string' ? record.lastName.trim() : '';
      const birthdate = typeof record.birthdate === 'string' ? record.birthdate.trim() : '';
      const gender =
        record.gender === 'MASCULIN' || record.gender === 'FEMININ' ? record.gender : '';
      const additionalInfo =
        typeof record.additionalInfo === 'string' ? record.additionalInfo.trim() : '';
      return {
        firstName,
        lastName,
        birthdate,
        gender,
        additionalInfo
      };
    })
    .filter((item): item is FamilyProfileChild => item !== null);
}

function toChildrenJson(children: FamilyProfileChild[]): Json {
  return children.map((child) => ({
    firstName: child.firstName,
    lastName: child.lastName,
    birthdate: child.birthdate,
    gender: child.gender,
    additionalInfo: child.additionalInfo
  }));
}

function mapRowToProfile(row: ClientProfileRow): FamilyProfile {
  return {
    userId: row.user_id,
    billingFirstName: row.parent1_first_name,
    billingLastName: row.parent1_last_name,
    email: row.parent1_email,
    phone: row.parent1_phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    hasSeparateBillingAddress: row.has_separate_billing_address,
    billingAddressLine1: row.billing_address_line1,
    billingAddressLine2: row.billing_address_line2,
    billingPostalCode: row.billing_postal_code,
    billingCity: row.billing_city,
    billingCountry: row.billing_country,
    cseOrganization: row.cse_organization,
    vacafNumber: row.vacaf_number,
    paymentMode: normalizePaymentMode(row.payment_mode),
    parent1Status: normalizeParentStatus(row.parent1_status),
    parent1StatusOther: row.parent1_status_other,
    parent2Name: row.parent2_name,
    parent2Status: normalizeParentStatus(row.parent2_status),
    parent2StatusOther: row.parent2_status_other,
    parent2Phone: row.parent2_phone,
    parent2Email: row.parent2_email,
    parent2HasDifferentAddress: row.parent2_has_different_address,
    parent2AddressLine1: row.parent2_address_line1,
    parent2AddressLine2: row.parent2_address_line2,
    parent2PostalCode: row.parent2_postal_code,
    parent2City: row.parent2_city,
    children: parseChildrenJson(row.children_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createDefaultProfile(input: {
  userId: string;
  sessionName?: string | null;
  sessionEmail?: string | null;
}): FamilyProfile {
  const split = splitName(input.sessionName);
  return {
    userId: input.userId,
    billingFirstName: split.firstName,
    billingLastName: split.lastName,
    email: normalizeText(input.sessionEmail).toLowerCase(),
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: DEFAULT_COUNTRY,
    hasSeparateBillingAddress: false,
    billingAddressLine1: '',
    billingAddressLine2: '',
    billingPostalCode: '',
    billingCity: '',
    billingCountry: DEFAULT_COUNTRY,
    cseOrganization: '',
    vacafNumber: '',
    paymentMode: 'FULL',
    parent1Status: 'pere',
    parent1StatusOther: '',
    parent2Name: '',
    parent2Status: 'pere',
    parent2StatusOther: '',
    parent2Phone: '',
    parent2Email: '',
    parent2HasDifferentAddress: false,
    parent2AddressLine1: '',
    parent2AddressLine2: '',
    parent2PostalCode: '',
    parent2City: '',
    children: [],
    createdAt: null,
    updatedAt: null
  };
}

function toDbPayload(profile: FamilyProfile): ClientProfileInsert {
  return {
    user_id: profile.userId,
    parent1_first_name: normalizeText(profile.billingFirstName),
    parent1_last_name: normalizeText(profile.billingLastName),
    parent1_email: normalizeText(profile.email).toLowerCase(),
    parent1_phone: normalizeText(profile.phone),
    address_line1: normalizeText(profile.addressLine1),
    address_line2: normalizeText(profile.addressLine2),
    postal_code: normalizeText(profile.postalCode),
    city: normalizeText(profile.city),
    country: normalizeText(profile.country) || DEFAULT_COUNTRY,
    has_separate_billing_address: Boolean(profile.hasSeparateBillingAddress),
    billing_address_line1: profile.hasSeparateBillingAddress
      ? normalizeText(profile.billingAddressLine1)
      : '',
    billing_address_line2: profile.hasSeparateBillingAddress
      ? normalizeText(profile.billingAddressLine2)
      : '',
    billing_postal_code: profile.hasSeparateBillingAddress ? normalizeText(profile.billingPostalCode) : '',
    billing_city: profile.hasSeparateBillingAddress ? normalizeText(profile.billingCity) : '',
    billing_country: profile.hasSeparateBillingAddress
      ? normalizeText(profile.billingCountry) || DEFAULT_COUNTRY
      : DEFAULT_COUNTRY,
    cse_organization: normalizeText(profile.cseOrganization),
    vacaf_number: normalizeUpper(profile.vacafNumber),
    payment_mode: normalizePaymentMode(profile.paymentMode),
    parent1_status: normalizeParentStatus(profile.parent1Status),
    parent1_status_other: normalizeText(profile.parent1StatusOther),
    parent2_name: normalizeText(profile.parent2Name),
    parent2_status: normalizeParentStatus(profile.parent2Status),
    parent2_status_other: normalizeText(profile.parent2StatusOther),
    parent2_phone: normalizeText(profile.parent2Phone),
    parent2_email: normalizeText(profile.parent2Email).toLowerCase(),
    parent2_has_different_address: Boolean(profile.parent2HasDifferentAddress),
    parent2_address_line1: profile.parent2HasDifferentAddress
      ? normalizeText(profile.parent2AddressLine1)
      : '',
    parent2_address_line2: profile.parent2HasDifferentAddress
      ? normalizeText(profile.parent2AddressLine2)
      : '',
    parent2_postal_code: profile.parent2HasDifferentAddress ? normalizeText(profile.parent2PostalCode) : '',
    parent2_city: profile.parent2HasDifferentAddress ? normalizeText(profile.parent2City) : '',
    children_json: toChildrenJson(profile.children),
    updated_at: new Date().toISOString()
  };
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) return 'Dates à confirmer';
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Dates à confirmer';
  return `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
}

function labelOrderStatus(status: string) {
  if (status === 'PAID' || status === 'CONFIRMED') return 'Confirmé';
  if (status === 'BOOKED' || status === 'VALIDATED') return 'Réservé';
  if (status === 'REQUESTED') return 'Demande en cours';
  if (status === 'CANCELLED') return 'Annulé';
  return status;
}

const PAYMENT_MODE_LABELS: Record<FamilyProfile['paymentMode'], string> = {
  FULL: 'Paiement de la totalité en CB',
  DEPOSIT_200: "Paiement d'un acompte (200 €) en CB",
  CV_CONNECT: 'Paiement en ANCV Connect',
  CV_PAPER: 'Paiement en ANCV papier',
  DEFERRED: 'Paiement différé'
};

function formatEuroFromCents(cents: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

function parsePaymentModeFromPayload(rawPayload: Json | null | undefined): FamilyProfile['paymentMode'] {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return 'FULL';
  }

  const rawRecord = rawPayload as Record<string, unknown>;
  const contact = rawRecord.contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return 'FULL';
  }

  const paymentMode = (contact as Record<string, unknown>).paymentMode;
  if (
    paymentMode === 'FULL' ||
    paymentMode === 'DEPOSIT_200' ||
    paymentMode === 'CV_CONNECT' ||
    paymentMode === 'CV_PAPER' ||
    paymentMode === 'DEFERRED'
  ) {
    return paymentMode;
  }

  return 'FULL';
}

function formatTransportCities(departureCity: string | null | undefined, returnCity: string | null | undefined) {
  const departure = normalizeText(departureCity);
  const returning = normalizeText(returnCity);
  if (departure && returning) {
    return departure === returning ? departure : `${departure} / ${returning}`;
  }
  return departure || returning || 'Transport sélectionné';
}

function computeDifferentiatedTransportAmount(
  amountCents: number,
  departureCity: string | null | undefined,
  returnCity: string | null | undefined,
  leg: 'outbound' | 'return'
) {
  if (leg === 'outbound') {
    return normalizeText(returnCity) ? Math.round(amountCents / 2) : amountCents;
  }
  return normalizeText(departureCity) ? Math.round(amountCents / 2) : amountCents;
}

function buildTransportLegLine(
  label: 'Aller' | 'Retour',
  city: string | null | undefined,
  amountCents: number | null
) {
  const trimmedCity = normalizeText(city);
  if (!trimmedCity) return null;
  if (typeof amountCents === 'number' && amountCents > 0) {
    return `${label} : ${trimmedCity} · ${formatEuroFromCents(amountCents)}`;
  }
  return `${label} : ${trimmedCity}`;
}

function computeRemainingBalanceCents(
  totalCents: number,
  paymentMode: FamilyProfile['paymentMode'],
  settled: boolean
) {
  if (paymentMode === 'DEPOSIT_200') {
    const paidCents = settled ? Math.min(20_000, totalCents) : 0;
    return Math.max(0, totalCents - paidCents);
  }

  if (paymentMode === 'DEFERRED') {
    return totalCents;
  }

  return settled ? 0 : totalCents;
}

async function syncLegacyClientsRow(input: { userId: string; fullName: string; phone: string }) {
  const supabase = getServerSupabaseClient();
  for (let attempt = 0; attempt < LEGACY_CLIENTS_FK_RETRY_COUNT; attempt += 1) {
    const { error } = await supabase.from('clients').upsert(
      {
        user_id: input.userId,
        full_name: input.fullName || null,
        phone: input.phone || null,
        collectivity_id: null
      },
      { onConflict: 'user_id' }
    );

    if (!error) {
      return;
    }

    if (isLegacyClientsUserForeignKeyError(error) && attempt < LEGACY_CLIENTS_FK_RETRY_COUNT - 1) {
      await waitForLegacyClientsRetry();
      continue;
    }

    throw new Error(`Impossible de synchroniser la table clients: ${error.message}`);
  }
}

async function readReservations(userId: string): Promise<FamilyReservation[]> {
  const supabase = getServerSupabaseClient();
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,status,created_at,paid_at')
    .eq('client_user_id', userId)
    .order('created_at', { ascending: false })
    .neq('status', 'CART');

  if (ordersError || !orders?.length) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const { data: items } = await supabase
    .from('order_items')
    .select(
      'id,order_id,session_id,child_first_name,child_last_name,transport_option_id,insurance_option_id,base_price_cents,options_price_cents,total_price_cents'
    )
    .in('order_id', orderIds);
  const orderItems = items ?? [];
  const itemsByOrder = new Map<string, typeof orderItems>();
  const sessionIds = new Set<string>();
  const transportOptionIds = new Set<string>();
  const insuranceOptionIds = new Set<string>();
  const orderItemIds: string[] = [];
  for (const item of orderItems) {
    const existing = itemsByOrder.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrder.set(item.order_id, existing);
    orderItemIds.push(item.id);
    if (item.session_id) {
      sessionIds.add(item.session_id);
    }
    if (item.transport_option_id) {
      transportOptionIds.add(item.transport_option_id);
    }
    if (item.insurance_option_id) {
      insuranceOptionIds.add(item.insurance_option_id);
    }
  }

  const { data: sessions } = sessionIds.size
    ? await supabase
        .from('sessions')
        .select('id,start_date,end_date,stay_id')
        .in('id', Array.from(sessionIds))
    : { data: [] as Array<{ id: string; start_date: string; end_date: string; stay_id: string }> };
  const sessionsById = new Map((sessions ?? []).map((session) => [session.id, session]));

  const stayIds = new Set<string>();
  for (const session of sessions ?? []) {
    if (session.stay_id) {
      stayIds.add(session.stay_id);
    }
  }

  const { data: stays } = stayIds.size
    ? await supabase.from('stays').select('id,title').in('id', Array.from(stayIds))
    : { data: [] as Array<{ id: string; title: string }> };
  const staysById = new Map((stays ?? []).map((stay) => [stay.id, stay]));
  const [{ data: payments }, { data: transportOptions }, { data: insuranceOptions }, { data: extraOptions }] =
    await Promise.all([
      supabase
        .from('payments')
        .select('order_id,amount_cents,currency,status,updated_at,raw_payload')
        .in('order_id', orderIds)
        .order('updated_at', { ascending: false }),
      transportOptionIds.size
        ? supabase
            .from('transport_options')
            .select('id,departure_city,return_city,amount_cents')
            .in('id', Array.from(transportOptionIds))
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              departure_city: string | null;
              return_city: string | null;
              amount_cents: number;
            }>
          }),
      insuranceOptionIds.size
        ? supabase
            .from('insurance_options')
            .select('id,label,amount_cents,percent_value')
            .in('id', Array.from(insuranceOptionIds))
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              label: string;
              amount_cents: number | null;
              percent_value: number | null;
            }>
          }),
      orderItemIds.length
        ? supabase
            .from('order_item_extra_options')
            .select('order_item_id,label_snapshot,amount_cents_snapshot')
            .in('order_item_id', orderItemIds)
        : Promise.resolve({
            data: [] as Array<{
              order_item_id: string;
              label_snapshot: string;
              amount_cents_snapshot: number;
            }>
          })
    ]);

  const paymentsByOrder = new Map<
    string,
    { amount_cents: number; currency: string; status: string; raw_payload: Json | null }
  >();
  for (const payment of payments ?? []) {
    if (!paymentsByOrder.has(payment.order_id)) {
      paymentsByOrder.set(payment.order_id, {
        amount_cents: payment.amount_cents,
        currency: payment.currency,
        status: payment.status,
        raw_payload: payment.raw_payload
      });
    }
  }

  const transportById = new Map((transportOptions ?? []).map((option) => [option.id, option]));
  const insuranceById = new Map((insuranceOptions ?? []).map((option) => [option.id, option]));
  const extrasByOrderItemId = new Map<
    string,
    Array<{ label_snapshot: string; amount_cents_snapshot: number }>
  >();
  for (const extra of extraOptions ?? []) {
    const existing = extrasByOrderItemId.get(extra.order_item_id) ?? [];
    existing.push({
      label_snapshot: extra.label_snapshot,
      amount_cents_snapshot: extra.amount_cents_snapshot
    });
    extrasByOrderItemId.set(extra.order_item_id, existing);
  }

  return orders
    .map((order) => {
      const itemsForOrder = itemsByOrder.get(order.id) ?? [];
      const firstItem = itemsForOrder[0];
      const session = firstItem?.session_id ? sessionsById.get(firstItem.session_id) : null;
      const stay = session?.stay_id ? staysById.get(session.stay_id) : null;
      const children = itemsForOrder
        .map((item) => {
          const firstName = normalizeText(item.child_first_name);
          const lastName = normalizeText(item.child_last_name).toUpperCase();
          return [firstName, lastName].filter(Boolean).join(' ').trim();
        })
        .filter(Boolean);
      const child = children[0] || 'Participant';
      const payment = paymentsByOrder.get(order.id);
      const totalCents =
        payment?.amount_cents ??
        itemsForOrder.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
      const currency = payment?.currency ?? 'EUR';
      const paymentMode = parsePaymentModeFromPayload(payment?.raw_payload);
      const settled =
        order.status === 'PAID' ||
        order.status === 'CONFIRMED' ||
        payment?.status === 'SUCCEEDED';
      const remainingBalanceCents = computeRemainingBalanceCents(totalCents, paymentMode, settled);

      const extraEntries = itemsForOrder.flatMap((item) => extrasByOrderItemId.get(item.id) ?? []);
      const extraLines = Array.from(
        new Set(
          extraEntries.map((extra) => `${extra.label_snapshot} · ${formatEuroFromCents(extra.amount_cents_snapshot)}`)
        )
      );

      const insuranceLines = Array.from(
        new Set(
          itemsForOrder
            .map((item) => {
              if (!item.insurance_option_id) return null;
              const insurance = insuranceById.get(item.insurance_option_id);
              if (!insurance) return 'Assurance sélectionnée';
              if (typeof insurance.amount_cents === 'number') {
                return `${insurance.label} · ${formatEuroFromCents(insurance.amount_cents)}`;
              }
              if (typeof insurance.percent_value === 'number') {
                return `${insurance.label} · ${insurance.percent_value}%`;
              }
              return insurance.label;
            })
            .filter((value): value is string => Boolean(value))
        )
      );

      const transportSummaryLines = new Set<string>();
      const outboundTransportLines = new Set<string>();
      const returnTransportLines = new Set<string>();
      for (const item of itemsForOrder) {
        if (!item.transport_option_id) continue;
        const transport = transportById.get(item.transport_option_id);
        if (!transport) {
          transportSummaryLines.add('Transport sélectionné');
          continue;
        }

        const departureCity = normalizeText(transport.departure_city);
        const returnCity = normalizeText(transport.return_city);
        const isDifferentiated = Boolean(departureCity && returnCity && departureCity !== returnCity);

        transportSummaryLines.add(
          `${formatTransportCities(transport.departure_city, transport.return_city)} · ${formatEuroFromCents(
            transport.amount_cents
          )}`
        );

        if (!isDifferentiated) {
          continue;
        }

        const outboundLine = buildTransportLegLine(
          'Aller',
          departureCity,
          computeDifferentiatedTransportAmount(transport.amount_cents, departureCity, returnCity, 'outbound')
        );
        const returnLine = buildTransportLegLine(
          'Retour',
          returnCity,
          computeDifferentiatedTransportAmount(transport.amount_cents, departureCity, returnCity, 'return')
        );
        if (outboundLine) outboundTransportLines.add(outboundLine);
        if (returnLine) returnTransportLines.add(returnLine);
      }

      const extraTotalCents = extraEntries.reduce((sum, extra) => sum + extra.amount_cents_snapshot, 0);
      const knownInsuranceTotalCents = itemsForOrder.reduce((sum, item) => {
        if (!item.insurance_option_id) return sum;
        const insurance = insuranceById.get(item.insurance_option_id);
        return sum + (insurance?.amount_cents ?? 0);
      }, 0);
      const knownTransportTotalCents = itemsForOrder.reduce((sum, item) => {
        if (!item.transport_option_id) return sum;
        const transport = transportById.get(item.transport_option_id);
        return sum + (transport?.amount_cents ?? 0);
      }, 0);
      const estimatedTransportResidualCents =
        itemsForOrder.reduce((sum, item) => sum + item.options_price_cents, 0) -
        extraTotalCents -
        knownInsuranceTotalCents -
        knownTransportTotalCents;

      return {
        orderId: order.id,
        title: stay?.title ?? 'Séjour réservé',
        dates: formatDateRange(session?.start_date, session?.end_date),
        child,
        children,
        status: labelOrderStatus(order.status),
        sessionStartDate: session?.start_date ?? null,
        sessionEndDate: session?.end_date ?? null,
        isPast: session?.end_date ? new Date(`${session.end_date}T23:59:59`).getTime() < Date.now() : false,
        totalCents,
        currency,
        paymentMode,
        paymentModeLabel: PAYMENT_MODE_LABELS[paymentMode],
        remainingBalanceCents,
        transportLine:
          Array.from(transportSummaryLines).join(' / ') ||
          (estimatedTransportResidualCents > 0
            ? `Transport sélectionné · ${formatEuroFromCents(estimatedTransportResidualCents)}`
            : null),
        transportOutboundLine: Array.from(outboundTransportLines).join(' / ') || null,
        transportReturnLine: Array.from(returnTransportLines).join(' / ') || null,
        insuranceLine: insuranceLines.join(' / ') || null,
        extraLines
      } satisfies FamilyReservation;
    })
    .sort((left, right) => {
      if (left.isPast !== right.isPast) {
        return left.isPast ? 1 : -1;
      }
      const leftDate = left.sessionStartDate ? new Date(left.sessionStartDate).getTime() : 0;
      const rightDate = right.sessionStartDate ? new Date(right.sessionStartDate).getTime() : 0;
      return rightDate - leftDate;
    });
}

async function upsertProfile(profile: FamilyProfile): Promise<FamilyProfile> {
  const supabase = getServerSupabaseClient();
  const payload = toDbPayload(profile);
  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  const { data, error } = await supabase
    .from('client_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingClientProfilesTableError(error)) {
      try {
        await syncLegacyClientsRow({ userId: profile.userId, fullName, phone: profile.phone });
      } catch (legacyClientsError) {
        if (shouldIgnoreLegacyClientsSyncError(legacyClientsError)) {
          console.warn('[account-profile] legacy clients sync skipped without client_profiles table', {
            userId: profile.userId,
            error: messageFromUnknown(legacyClientsError)
          });
        } else {
          throw legacyClientsError;
        }
      }
      return {
        ...profile,
        updatedAt: new Date().toISOString()
      };
    }
    throw new Error(error?.message ?? 'Impossible de sauvegarder le profil famille.');
  }

  try {
    await syncLegacyClientsRow({ userId: profile.userId, fullName, phone: profile.phone });
  } catch (legacyClientsError) {
    if (shouldIgnoreLegacyClientsSyncError(legacyClientsError)) {
      console.warn('[account-profile] legacy clients sync skipped after profile upsert', {
        userId: profile.userId,
        error: messageFromUnknown(legacyClientsError)
      });
    } else {
      throw legacyClientsError;
    }
  }
  return mapRowToProfile(data as ClientProfileRow);
}

export async function getFamilyProfile(userId: string): Promise<FamilyProfile | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingClientProfilesTableError(error)) {
      throw new Error(CLIENT_PROFILES_MISSING_ERROR);
    }
    throw new Error(`Impossible de lire le profil famille: ${error.message}`);
  }
  if (!data) return null;
  return mapRowToProfile(data as ClientProfileRow);
}

export async function getFamilyProfileSnapshot(input: {
  userId: string;
  sessionName?: string | null;
  sessionEmail?: string | null;
}): Promise<FamilyProfileSnapshot> {
  const profile =
    (await getFamilyProfile(input.userId)) ??
    createDefaultProfile({
      userId: input.userId,
      sessionName: input.sessionName,
      sessionEmail: input.sessionEmail
    });
  const reservations = await readReservations(input.userId);
  return { profile, reservations };
}

export async function upsertFamilyProfileFromRegistration(input: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country?: string;
  parent2Name?: string;
  parent2Status?: FamilyProfile['parent2Status'];
  parent2StatusOther?: string;
  parent2Phone?: string;
  parent2Email?: string;
}) {
  const existing =
    (await getFamilyProfile(input.userId)) ??
    createDefaultProfile({
      userId: input.userId,
      sessionName: `${input.firstName} ${input.lastName}`.trim(),
      sessionEmail: input.email
    });

  const nextProfile: FamilyProfile = {
    ...existing,
    billingFirstName: normalizeText(input.firstName),
    billingLastName: normalizeText(input.lastName),
    email: normalizeText(input.email).toLowerCase(),
    phone: normalizeText(input.phone),
    addressLine1: normalizeText(input.addressLine1),
    addressLine2: normalizeText(input.addressLine2),
    postalCode: normalizeText(input.postalCode),
    city: normalizeText(input.city),
    country: normalizeText(input.country) || DEFAULT_COUNTRY,
    hasSeparateBillingAddress: false,
    billingAddressLine1: '',
    billingAddressLine2: '',
    billingPostalCode: '',
    billingCity: '',
    billingCountry: DEFAULT_COUNTRY,
    parent2Name: normalizeText(input.parent2Name),
    parent1Status: existing.parent1Status,
    parent1StatusOther: existing.parent1StatusOther,
    parent2Status: normalizeParentStatus(input.parent2Status),
    parent2StatusOther: normalizeText(input.parent2StatusOther),
    parent2Phone: normalizeText(input.parent2Phone),
    parent2Email: normalizeText(input.parent2Email).toLowerCase(),
    parent2HasDifferentAddress: false,
    parent2AddressLine1: '',
    parent2AddressLine2: '',
    parent2PostalCode: '',
    parent2City: ''
  };

  return upsertProfile(nextProfile);
}

export async function upsertFamilyProfileFromCheckout(input: {
  userId: string;
  contact: FamilyCheckoutSyncInput['contact'];
  participants: FamilyCheckoutSyncInput['participants'];
  sessionName?: string | null;
  sessionEmail?: string | null;
}) {
  const existing =
    (await getFamilyProfile(input.userId)) ??
    createDefaultProfile({
      userId: input.userId,
      sessionName: input.sessionName,
      sessionEmail: input.sessionEmail
    });

  const children: FamilyProfileChild[] = input.participants.map((participant) => ({
    firstName: normalizeText(participant.childFirstName),
    lastName: normalizeText(participant.childLastName),
    birthdate: normalizeText(participant.childBirthdate),
    gender: participant.childGender === 'MASCULIN' || participant.childGender === 'FEMININ' ? participant.childGender : '',
    additionalInfo: normalizeText(participant.additionalInfo)
  }));

  const nextProfile: FamilyProfile = {
    ...existing,
    billingFirstName: normalizeText(input.contact.billingFirstName),
    billingLastName: normalizeText(input.contact.billingLastName),
    email: normalizeText(input.contact.email).toLowerCase(),
    phone: normalizeText(input.contact.phone),
    addressLine1: normalizeText(input.contact.addressLine1),
    addressLine2: normalizeText(input.contact.addressLine2),
    postalCode: normalizeText(input.contact.postalCode),
    city: normalizeText(input.contact.city),
    country: normalizeText(input.contact.country) || DEFAULT_COUNTRY,
    hasSeparateBillingAddress: Boolean(input.contact.hasSeparateBillingAddress),
    billingAddressLine1: normalizeText(input.contact.billingAddressLine1),
    billingAddressLine2: normalizeText(input.contact.billingAddressLine2),
    billingPostalCode: normalizeText(input.contact.billingPostalCode),
    billingCity: normalizeText(input.contact.billingCity),
    billingCountry: normalizeText(input.contact.billingCountry) || DEFAULT_COUNTRY,
    cseOrganization: normalizeText(input.contact.cseOrganization),
    vacafNumber: normalizeUpper(input.contact.vacafNumber),
    paymentMode: input.contact.paymentMode,
    parent1Status: existing.parent1Status,
    parent1StatusOther: existing.parent1StatusOther,
    children
  };

  return upsertProfile(nextProfile);
}

export async function patchFamilyProfileParent2(input: {
  userId: string;
  patch: FamilyParent2Patch;
  sessionName?: string | null;
  sessionEmail?: string | null;
}) {
  const existing =
    (await getFamilyProfile(input.userId)) ??
    createDefaultProfile({
      userId: input.userId,
      sessionName: input.sessionName,
      sessionEmail: input.sessionEmail
    });

  const nextProfile: FamilyProfile = {
    ...existing,
    parent2Name:
      input.patch.parent2Name === undefined
        ? existing.parent2Name
        : normalizeText(input.patch.parent2Name),
    parent2Status:
      input.patch.parent2Status === undefined
        ? existing.parent2Status
        : normalizeParentStatus(input.patch.parent2Status),
    parent2StatusOther:
      input.patch.parent2StatusOther === undefined
        ? existing.parent2StatusOther
        : normalizeText(input.patch.parent2StatusOther),
    parent2Phone:
      input.patch.parent2Phone === undefined
        ? existing.parent2Phone
        : normalizeText(input.patch.parent2Phone),
    parent2Email:
      input.patch.parent2Email === undefined
        ? existing.parent2Email
        : normalizeText(input.patch.parent2Email).toLowerCase(),
    parent2HasDifferentAddress:
      input.patch.parent2HasDifferentAddress === undefined
        ? existing.parent2HasDifferentAddress
        : Boolean(input.patch.parent2HasDifferentAddress),
    parent2AddressLine1:
      input.patch.parent2AddressLine1 === undefined
        ? existing.parent2AddressLine1
        : normalizeText(input.patch.parent2AddressLine1),
    parent2AddressLine2:
      input.patch.parent2AddressLine2 === undefined
        ? existing.parent2AddressLine2
        : normalizeText(input.patch.parent2AddressLine2),
    parent2PostalCode:
      input.patch.parent2PostalCode === undefined
        ? existing.parent2PostalCode
        : normalizeText(input.patch.parent2PostalCode),
    parent2City:
      input.patch.parent2City === undefined
        ? existing.parent2City
        : normalizeText(input.patch.parent2City)
  };

  if (!nextProfile.parent2HasDifferentAddress) {
    nextProfile.parent2AddressLine1 = '';
    nextProfile.parent2AddressLine2 = '';
    nextProfile.parent2PostalCode = '';
    nextProfile.parent2City = '';
  }

  return upsertProfile(nextProfile);
}

export async function patchFamilyProfilePreferences(input: {
  userId: string;
  patch: {
    parent1Name: string;
    parent1Status: FamilyProfile['parent1Status'];
    parent1StatusOther?: string;
    parent1Email: string;
    parent1Phone: string;
    addressLine1: string;
    addressLine2?: string;
    postalCode: string;
    city: string;
    country?: string;
    parent2Name?: string;
    parent2Status?: FamilyProfile['parent2Status'];
    parent2StatusOther?: string;
    parent2Phone?: string;
    parent2Email?: string;
    parent2HasDifferentAddress?: boolean;
    parent2AddressLine1?: string;
    parent2AddressLine2?: string;
    parent2PostalCode?: string;
    parent2City?: string;
  };
  sessionName?: string | null;
  sessionEmail?: string | null;
}) {
  const existing =
    (await getFamilyProfile(input.userId)) ??
    createDefaultProfile({
      userId: input.userId,
      sessionName: input.sessionName,
      sessionEmail: input.sessionEmail
    });

  const parent1Split = splitName(input.patch.parent1Name);

  const nextProfile: FamilyProfile = {
    ...existing,
    billingFirstName: normalizeText(parent1Split.firstName),
    billingLastName: normalizeText(parent1Split.lastName),
    parent1Status: normalizeParentStatus(input.patch.parent1Status),
    parent1StatusOther: normalizeText(input.patch.parent1StatusOther),
    email: normalizeText(input.patch.parent1Email).toLowerCase(),
    phone: normalizeText(input.patch.parent1Phone),
    addressLine1: normalizeText(input.patch.addressLine1),
    addressLine2: normalizeText(input.patch.addressLine2),
    postalCode: normalizeText(input.patch.postalCode),
    city: normalizeText(input.patch.city),
    country: normalizeText(input.patch.country) || DEFAULT_COUNTRY,
    parent2Name: normalizeText(input.patch.parent2Name),
    parent2Status: normalizeParentStatus(input.patch.parent2Status),
    parent2StatusOther: normalizeText(input.patch.parent2StatusOther),
    parent2Phone: normalizeText(input.patch.parent2Phone),
    parent2Email: normalizeText(input.patch.parent2Email).toLowerCase(),
    parent2HasDifferentAddress: Boolean(input.patch.parent2HasDifferentAddress),
    parent2AddressLine1: normalizeText(input.patch.parent2AddressLine1),
    parent2AddressLine2: normalizeText(input.patch.parent2AddressLine2),
    parent2PostalCode: normalizeText(input.patch.parent2PostalCode),
    parent2City: normalizeText(input.patch.parent2City)
  };

  if (!nextProfile.parent2HasDifferentAddress) {
    nextProfile.parent2AddressLine1 = '';
    nextProfile.parent2AddressLine2 = '';
    nextProfile.parent2PostalCode = '';
    nextProfile.parent2City = '';
  }

  return upsertProfile(nextProfile);
}

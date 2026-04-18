import type { Json, Database } from '@/types/supabase';
import type {
  FamilyCheckoutSyncInput,
  FamilyParent2Patch,
  FamilyProfile,
  FamilyProfileChild,
  FamilyProfileSnapshot,
  FamilyUpcomingReservation
} from '@/types/family-profile';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type ClientProfileRow = Database['public']['Tables']['client_profiles']['Row'];
type ClientProfileInsert = Database['public']['Tables']['client_profiles']['Insert'];

const DEFAULT_COUNTRY = 'France';

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

async function syncLegacyClientsRow(input: { userId: string; fullName: string; phone: string }) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('clients').upsert(
    {
      user_id: input.userId,
      full_name: input.fullName || null,
      phone: input.phone || null,
      collectivity_id: null
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    throw new Error(`Impossible de synchroniser la table clients: ${error.message}`);
  }
}

async function readUpcomingReservations(userId: string): Promise<FamilyUpcomingReservation[]> {
  const supabase = getServerSupabaseClient();
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,status,created_at')
    .eq('client_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (ordersError || !orders?.length) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const { data: items } = await supabase
    .from('order_items')
    .select('order_id,session_id,child_first_name,child_last_name')
    .in('order_id', orderIds);

  type OrderItemSummary = {
    order_id: string;
    session_id: string | null;
    child_first_name: string;
    child_last_name: string;
  };

  const itemsByOrder = new Map<string, OrderItemSummary>();
  const sessionIds = new Set<string>();
  for (const item of items ?? []) {
    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, {
        order_id: item.order_id,
        session_id: item.session_id,
        child_first_name: item.child_first_name,
        child_last_name: item.child_last_name
      });
    }
    if (item.session_id) {
      sessionIds.add(item.session_id);
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

  return orders.map((order) => {
    const item = itemsByOrder.get(order.id);
    const session = item?.session_id ? sessionsById.get(item.session_id) : null;
    const stay = session?.stay_id ? staysById.get(session.stay_id) : null;
    const childFirstName = normalizeText(item?.child_first_name);
    const childLastName = normalizeText(item?.child_last_name).toUpperCase();
    const child = [childFirstName, childLastName].filter(Boolean).join(' ') || 'Participant';
    return {
      orderId: order.id,
      title: stay?.title ?? 'Séjour réservé',
      dates: formatDateRange(session?.start_date, session?.end_date),
      child,
      status: labelOrderStatus(order.status)
    };
  });
}

async function upsertProfile(profile: FamilyProfile): Promise<FamilyProfile> {
  const supabase = getServerSupabaseClient();
  const payload = toDbPayload(profile);
  const { data, error } = await supabase
    .from('client_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossible de sauvegarder le profil famille.');
  }

  const fullName = [profile.billingFirstName, profile.billingLastName].filter(Boolean).join(' ').trim();
  await syncLegacyClientsRow({ userId: profile.userId, fullName, phone: profile.phone });
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
  const upcomingReservations = await readUpcomingReservations(input.userId);
  return { profile, upcomingReservations };
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

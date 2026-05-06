import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type CollectivityRow = Database['public']['Tables']['collectivities']['Row'];
type CollectivityContactRow = Database['public']['Tables']['collectivity_contacts']['Row'];
type OrderItemRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'order_id' | 'session_id' | 'child_first_name' | 'child_last_name' | 'total_price_cents'
>;

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

function buildClientDisplayName(profile: {
  parent1_first_name?: string | null;
  parent1_last_name?: string | null;
}) {
  return [profile.parent1_first_name, profile.parent1_last_name].filter(Boolean).join(' ').trim();
}

function formatOrderStatus(status: Database['public']['Enums']['order_status'] | string | null | undefined) {
  switch (status) {
    case 'REQUESTED':
      return 'Demandée';
    case 'VALIDATED':
      return 'Validée';
    case 'BOOKED':
      return 'Réservée';
    case 'PAID':
      return 'Payée';
    case 'CONFIRMED':
      return 'Confirmée';
    case 'CANCELLED':
      return 'Annulée';
    case 'CART':
      return 'Panier';
    default:
      return status ?? '-';
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate && !endDate) return '-';
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  return formatDate(startDate ?? endDate);
}

function formatCurrencyFromCents(value: number | null | undefined, currency = 'EUR') {
  if (value == null || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export async function readPartnerCollectivity(collectivityId: string): Promise<CollectivityRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivities')
    .select('*')
    .eq('id', collectivityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossible de charger la collectivité : ${error.message}`);
  }
  if (!data) {
    throw new Error('Collectivité introuvable.');
  }

  return data;
}

export async function listPartnerContacts(collectivityId: string): Promise<CollectivityContactRow[]> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivity_contacts')
    .select('*')
    .eq('collectivity_id', collectivityId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (isCollectivityContactsTableMissingError(error)) {
      const collectivity = await readPartnerCollectivity(collectivityId);
      if (!collectivity.contact_email?.trim()) {
        return [];
      }

      return [
        {
          id: `legacy-${collectivityId}`,
          collectivity_id: collectivityId,
          full_name: collectivity.contact_name?.trim() || collectivity.name,
          role_label: null,
          email: collectivity.contact_email.trim(),
          phone: collectivity.contact_phone?.trim() || null,
          is_primary: true,
          created_at: collectivity.created_at,
          updated_at: collectivity.updated_at
        }
      ];
    }
    throw new Error(`Impossible de charger les contacts partenaire : ${error.message}`);
  }

  return data ?? [];
}

export async function isPartnerContactsTableAvailable(collectivityId: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('collectivity_contacts')
    .select('id')
    .eq('collectivity_id', collectivityId)
    .limit(1);

  return !isCollectivityContactsTableMissingError(error);
}

export async function listPartnerBeneficiaryUserIds(collectivityId: string, excludedUserId?: string | null) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('clients')
    .select('user_id')
    .eq('collectivity_id', collectivityId);

  if (error) {
    throw new Error(`Impossible de charger les bénéficiaires rattachés : ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.user_id)
    .filter((userId) => userId !== excludedUserId);
}

export async function listPartnerBeneficiaries(collectivityId: string, excludedUserId?: string | null) {
  const supabase = getServerSupabaseClient();
  const { data: beneficiaryClients, error: beneficiaryClientsError } = await supabase
    .from('clients')
    .select('user_id,full_name,phone,created_at')
    .eq('collectivity_id', collectivityId);

  if (beneficiaryClientsError) {
    throw new Error(`Impossible de charger les clients rattachés : ${beneficiaryClientsError.message}`);
  }

  const filteredClients = (beneficiaryClients ?? []).filter((row) => row.user_id !== excludedUserId);
  const userIds = filteredClients.map((row) => row.user_id);
  if (userIds.length === 0) return [];

  const [{ data: profiles, error: profilesError }] = await Promise.all([
    supabase
      .from('client_profiles')
      .select('user_id,parent1_first_name,parent1_last_name,parent1_email,parent1_phone,city,created_at')
      .in('user_id', userIds)
  ]);

  if (profilesError) {
    throw new Error(`Impossible de charger les profils clients rattachés : ${profilesError.message}`);
  }

  const profilesByUserId = new Map((profiles ?? []).map((row) => [row.user_id, row]));

  return filteredClients.map((client) => {
    const profile = profilesByUserId.get(client.user_id);
    const nameFromProfile = profile ? buildClientDisplayName(profile) : '';
    const displayName = client?.full_name?.trim() || nameFromProfile || 'Nom non renseigné';

    return {
      id: client.user_id,
      userId: client.user_id,
      name: displayName,
      email: profile?.parent1_email?.trim() || 'Non renseigné',
      phone: profile?.parent1_phone?.trim() || client?.phone?.trim() || 'Non renseigné',
      city: profile?.city?.trim() || 'Non renseignée',
      attachedAt: profile?.created_at ?? client.created_at,
      role: 'BENEFICIARY'
    };
  });
}

export async function listPartnerReservations(collectivityId: string, excludedUserId?: string | null) {
  const supabase = getServerSupabaseClient();
  const beneficiaryUserIds = await listPartnerBeneficiaryUserIds(collectivityId, excludedUserId);
  if (beneficiaryUserIds.length === 0) return [];

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,status,created_at,requested_at,validated_at,booked_at,paid_at,client_user_id,collectivity_id')
    .in('client_user_id', beneficiaryUserIds)
    .neq('status', 'CART')
    .order('created_at', { ascending: false });

  if (ordersError) {
    throw new Error(`Impossible de charger les réservations : ${ordersError.message}`);
  }

  const orderRows = orders ?? [];
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((row) => row.id);
  const clientUserIds = Array.from(new Set(orderRows.map((row) => row.client_user_id).filter(Boolean)));

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id,order_id,session_id,child_first_name,child_last_name,total_price_cents')
    .in('order_id', orderIds);

  if (itemsError) {
    throw new Error(`Impossible de charger les lignes de commande : ${itemsError.message}`);
  }

  const sessionIds = Array.from(new Set((orderItems ?? []).map((row) => row.session_id).filter(Boolean)));
  const orderItemIds = Array.from(new Set((orderItems ?? []).map((row) => row.id).filter(Boolean)));

  const contributionsResponse = orderItemIds.length
    ? await supabase
        .from('collectivity_contributions')
        .select('order_item_id,fixed_cents,status')
        .eq('collectivity_id', collectivityId)
        .in('order_item_id', orderItemIds)
    : { data: [], error: null };

  const sessionsResponse = sessionIds.length
    ? await supabase.from('sessions').select('id,start_date,end_date,stay_id').in('id', sessionIds)
    : { data: [], error: null };
  const clientsResponse = clientUserIds.length
    ? await supabase.from('clients').select('user_id,full_name').in('user_id', clientUserIds)
    : { data: [], error: null };
  const profilesResponse = clientUserIds.length
    ? await supabase
        .from('client_profiles')
        .select('user_id,parent1_first_name,parent1_last_name,parent1_email')
        .in('user_id', clientUserIds)
    : { data: [], error: null };

  if (sessionsResponse.error) {
    throw new Error(`Impossible de charger les sessions réservées : ${sessionsResponse.error.message}`);
  }
  if (clientsResponse.error) {
    throw new Error(`Impossible de charger les clients des réservations : ${clientsResponse.error.message}`);
  }
  if (profilesResponse.error) {
    throw new Error(`Impossible de charger les profils des réservations : ${profilesResponse.error.message}`);
  }
  if (contributionsResponse.error) {
    throw new Error(`Impossible de charger les contributions partenaire : ${contributionsResponse.error.message}`);
  }

  const sessions = sessionsResponse.data ?? [];
  const clients = clientsResponse.data ?? [];
  const profiles = profilesResponse.data ?? [];

  const stayIds = Array.from(new Set(sessions.map((row) => row.stay_id).filter(Boolean)));
  const { data: stays, error: staysError } = stayIds.length
    ? await supabase
        .from('stays')
        .select('id,title,location_text,destination_city,destination_country')
        .in('id', stayIds)
    : { data: [], error: null };

  if (staysError) {
    throw new Error(`Impossible de charger les séjours réservés : ${staysError.message}`);
  }

  const itemsByOrderId = new Map<string, OrderItemRow[]>();
  for (const item of orderItems ?? []) {
    const existing = itemsByOrderId.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrderId.set(item.order_id, existing);
  }

  const sessionsById = new Map(sessions.map((row) => [row.id, row]));
  const staysById = new Map((stays ?? []).map((row) => [row.id, row]));
  const clientsByUserId = new Map(clients.map((row) => [row.user_id, row]));
  const profilesByUserId = new Map(profiles.map((row) => [row.user_id, row]));
  const contributionCentsByOrderItemId = new Map(
    (contributionsResponse.data ?? [])
      .filter((row) => row.status !== 'REJECTED')
      .map((row) => [row.order_item_id, row.fixed_cents ?? 0])
  );

  return orderRows.map((order) => {
    const itemsForOrder = itemsByOrderId.get(order.id) ?? [];
    const firstSession = itemsForOrder.length ? sessionsById.get(itemsForOrder[0].session_id) : null;
    const firstStay = firstSession ? staysById.get(firstSession.stay_id) : null;
    const profile = profilesByUserId.get(order.client_user_id);
    const client = clientsByUserId.get(order.client_user_id);
    const beneficiaryName =
      client?.full_name?.trim() ||
      (profile ? buildClientDisplayName(profile) : '') ||
      'Nom non renseigné';
    const beneficiaryEmail = profile?.parent1_email?.trim() || 'Non renseigné';
    const childNames = Array.from(
      new Set(
        itemsForOrder
          .map((item) => [item.child_first_name, item.child_last_name].filter(Boolean).join(' ').trim())
          .filter(Boolean)
      )
    );
    const totalCents = itemsForOrder.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
    const manualContributionCents = itemsForOrder.reduce(
      (sum, item) => sum + (contributionCentsByOrderItemId.get(item.id) ?? 0),
      0
    );

    return {
      id: order.id,
      orderItemIds: itemsForOrder.map((item) => item.id),
      createdAt: order.created_at,
      status: order.status,
      statusLabel: formatOrderStatus(order.status),
      beneficiaryName,
      beneficiaryEmail,
      stayTitle: firstStay?.title ?? 'Séjour inconnu',
      stayLocation:
        firstStay?.location_text ||
        [firstStay?.destination_city, firstStay?.destination_country].filter(Boolean).join(', ') ||
        'Lieu non renseigné',
      sessionLabel: formatDateRange(firstSession?.start_date, firstSession?.end_date),
      childNames,
      childrenLabel: childNames.length > 0 ? childNames.join(', ') : 'Aucun participant',
      totalCents,
      totalLabel: formatCurrencyFromCents(totalCents, 'EUR'),
      manualContributionCents,
      isTaggedToCollectivity: order.collectivity_id === collectivityId
    };
  });
}

export type PartnerCollectivityProfile = Awaited<ReturnType<typeof readPartnerCollectivity>>;

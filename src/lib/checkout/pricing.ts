import { getServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { evaluatePartnerCatalogEligibility, simulatePartnerAid } from '@/lib/partner-catalog-rules';
import { normalizePartnerCatalogRules } from '@/lib/partner-catalog-rules';
import type { CartItem } from '@/types/cart';
import type { Database } from '@/types/supabase';
import { formatEuroFromCents, type CheckoutPricing, type CheckoutPricingItem } from '@/types/checkout';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

type SessionRow = Pick<
  Database['public']['Tables']['sessions']['Row'],
  'id' | 'stay_id' | 'status' | 'capacity_total' | 'capacity_reserved' | 'start_date' | 'end_date'
>;
type StayRow = Pick<
  Database['public']['Tables']['stays']['Row'],
  | 'id'
  | 'organizer_id'
  | 'title'
  | 'status'
  | 'age_min'
  | 'age_max'
  | 'categories'
  | 'destination_country'
  | 'destination_countries'
  | 'transport_mode'
  | 'required_documents_text'
  | 'supervision_text'
>;
type SessionPriceRow = Pick<Database['public']['Tables']['session_prices']['Row'], 'session_id' | 'amount_cents'>;
type TransportRow = Pick<
  Database['public']['Tables']['transport_options']['Row'],
  'id' | 'session_id' | 'stay_id' | 'amount_cents' | 'departure_city' | 'return_city'
>;
type ExtraOptionRow = Pick<
  Database['public']['Tables']['stay_extra_options']['Row'],
  'id' | 'stay_id' | 'label' | 'amount_cents'
>;
type ResolvedInsuranceOption = {
  id: string;
  label: string;
  session_id: string | null;
  stay_id: string | null;
  amount_cents: number | null;
  percent_value: number | null;
  source: 'INSURANCE_OPTION' | 'EXTRA_INSURANCE';
};

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutValidationError';
  }
}

function asValidationError(message: string): never {
  throw new CheckoutValidationError(message);
}

function pickStoredTransportOptionId(item: CartItem) {
  if (item.selection.transportOptionId) {
    return item.selection.transportOptionId;
  }

  if (
    item.selection.departureTransportOptionId &&
    item.selection.returnTransportOptionId &&
    item.selection.departureTransportOptionId === item.selection.returnTransportOptionId
  ) {
    return item.selection.departureTransportOptionId;
  }

  return null;
}

function computeDifferentiatedAmount(option: TransportRow, leg: 'outbound' | 'return') {
  if (leg === 'outbound') {
    return option.return_city ? Math.round(option.amount_cents / 2) : option.amount_cents;
  }
  return option.departure_city ? Math.round(option.amount_cents / 2) : option.amount_cents;
}

function formatTransportLabel(departureCity: string | null | undefined, returnCity: string | null | undefined) {
  const departure = departureCity?.trim() ?? '';
  const returning = returnCity?.trim() ?? '';

  if (departure && returning) {
    return departure === returning
      ? `Ville départ/retour: ${departure}`
      : `Ville départ/retour: ${departure} / ${returning}`;
  }

  if (departure) return `Ville départ: ${departure}`;
  if (returning) return `Ville retour: ${returning}`;
  return null;
}

function buildTransportDisplaySegment(label: string, city: string | null | undefined, amountCents: number | null) {
  const trimmedCity = city?.trim() ?? '';
  if (!trimmedCity) return null;
  if (amountCents != null && amountCents > 0) {
    return `${label} : ${trimmedCity} · ${formatEuroFromCents(amountCents)}`;
  }
  return `${label} : ${trimmedCity}`;
}

function isInsuranceLikeLabel(label: string | null | undefined) {
  if (!label) return false;
  return /(assur|annulation|rapatriement|multirisque)/i.test(label);
}

async function fetchSession(sessionId: string): Promise<SessionRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('id,stay_id,status,capacity_total,capacity_reserved,start_date,end_date')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) {
    asValidationError('La session sélectionnée est introuvable.');
  }

  return data;
}

async function fetchStay(stayId: string): Promise<StayRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      'id,organizer_id,title,status,age_min,age_max,categories,destination_country,destination_countries,transport_mode,required_documents_text,supervision_text'
    )
    .eq('id', stayId)
    .maybeSingle();

  if (error || !data) {
    asValidationError('Le séjour sélectionné est introuvable.');
  }

  return data;
}

function getSimulationQfValue(rules: PartnerCatalogRules) {
  return rules.financialRules.qfMax != null
    ? ((rules.financialRules.qfMin ?? 0) + rules.financialRules.qfMax) / 2
    : (rules.financialRules.qfMin ?? 1200);
}

async function readCheckoutCseRulesForCurrentUser() {
  const session = await getCurrentUser();
  if (!session?.userId) return null;
  const supabase = getServerSupabaseClient();
  const { data: client } = await supabase
    .from('clients')
    .select('collectivity_id')
    .eq('user_id', session.userId)
    .maybeSingle();
  if (!client?.collectivity_id) return null;

  const { data: collectivity } = await supabase
    .from('collectivities')
    .select('catalog_rules_published')
    .eq('id', client.collectivity_id)
    .maybeSingle();
  if (!collectivity?.catalog_rules_published) return null;
  return normalizePartnerCatalogRules(collectivity.catalog_rules_published);
}

async function fetchSessionPrice(sessionId: string): Promise<SessionPriceRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('session_prices')
    .select('session_id,amount_cents')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data) {
    asValidationError('Le tarif de la session est indisponible.');
  }

  return data;
}

async function fetchTransportOption(optionId: string): Promise<TransportRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('transport_options')
    .select('id,session_id,stay_id,amount_cents,departure_city,return_city')
    .eq('id', optionId)
    .maybeSingle();

  if (error || !data) {
    asValidationError('L’option de transport sélectionnée est introuvable.');
  }

  return data;
}

async function fetchInsuranceOption(optionId: string): Promise<ResolvedInsuranceOption> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('insurance_options')
    .select('id,label,session_id,stay_id,amount_cents,percent_value')
    .eq('id', optionId)
    .maybeSingle();

  if (!error && data) {
    return {
      id: data.id,
      label: data.label,
      session_id: data.session_id,
      stay_id: data.stay_id,
      amount_cents: data.amount_cents,
      percent_value: data.percent_value,
      source: 'INSURANCE_OPTION'
    };
  }

  const { data: fallbackExtra, error: fallbackError } = await supabase
    .from('stay_extra_options')
    .select('id,stay_id,label,amount_cents')
    .eq('id', optionId)
    .maybeSingle();

  if (fallbackError || !fallbackExtra || !isInsuranceLikeLabel(fallbackExtra.label)) {
    asValidationError('L’option d’assurance sélectionnée est introuvable.');
  }

  return {
    id: fallbackExtra.id,
    label: fallbackExtra.label,
    session_id: null,
    stay_id: fallbackExtra.stay_id,
    amount_cents: fallbackExtra.amount_cents,
    percent_value: null,
    source: 'EXTRA_INSURANCE'
  };
}

async function fetchExtraOption(optionId: string): Promise<ExtraOptionRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('stay_extra_options')
    .select('id,stay_id,label,amount_cents')
    .eq('id', optionId)
    .maybeSingle();

  if (error || !data) {
    asValidationError('L’option supplémentaire sélectionnée est introuvable.');
  }

  return data;
}

function assertSessionAvailability(session: SessionRow) {
  if (session.status !== 'OPEN') {
    asValidationError('La session sélectionnée n’est plus disponible.');
  }

  if (session.capacity_reserved >= session.capacity_total) {
    asValidationError('La session sélectionnée est complète.');
  }
}

function assertRowBelongsToSession(optionSessionId: string | null, sessionId: string, label: string) {
  if (optionSessionId && optionSessionId !== sessionId) {
    asValidationError(`${label} ne correspond pas à la session choisie.`);
  }
}

function assertRowBelongsToStay(optionStayId: string | null, stayId: string, label: string) {
  if (optionStayId && optionStayId !== stayId) {
    asValidationError(`${label} ne correspond pas au séjour choisi.`);
  }
}

export async function repriceCart(items: CartItem[]): Promise<CheckoutPricing> {
  const cseRules = await readCheckoutCseRulesForCurrentUser();
  const qfValue = cseRules ? getSimulationQfValue(cseRules) : null;
  const pricedItems = await Promise.all(
    items.map(async (cartItem): Promise<CheckoutPricingItem> => {
      const sessionId = cartItem.selection.sessionId;
      if (!sessionId) {
        asValidationError(`La session est manquante pour le séjour « ${cartItem.title} ».`);
      }

      const [session, stay, sessionPrice] = await Promise.all([
        fetchSession(sessionId),
        fetchStay(cartItem.stayId),
        fetchSessionPrice(sessionId)
      ]);

      if (session.stay_id !== cartItem.stayId) {
        asValidationError(`Le séjour « ${cartItem.title} » ne correspond plus à la session choisie.`);
      }

      if (stay.status !== 'PUBLISHED') {
        asValidationError(`Le séjour « ${cartItem.title} » n’est plus disponible.`);
      }

      assertSessionAvailability(session);

      const basePriceCents = sessionPrice.amount_cents;

      let transportPriceCents = 0;
      let transportLabel: string | null = null;
      let transportDisplayLine: string | null = null;
      if (cartItem.selection.transportOptionId) {
        const transportOption = await fetchTransportOption(cartItem.selection.transportOptionId);
        assertRowBelongsToSession(transportOption.session_id, sessionId, 'Le transport');
        assertRowBelongsToStay(transportOption.stay_id, cartItem.stayId, 'Le transport');
        transportPriceCents = transportOption.amount_cents;
        transportLabel = formatTransportLabel(
          transportOption.departure_city,
          transportOption.return_city
        );
        transportDisplayLine =
          transportLabel ? `${transportLabel} (${formatEuroFromCents(transportPriceCents)})` : null;
      } else {
        const [departureOption, returnOption] = await Promise.all([
          cartItem.selection.departureTransportOptionId
            ? fetchTransportOption(cartItem.selection.departureTransportOptionId)
            : Promise.resolve(null),
          cartItem.selection.returnTransportOptionId
            ? fetchTransportOption(cartItem.selection.returnTransportOptionId)
            : Promise.resolve(null)
        ]);

        if (departureOption) {
          assertRowBelongsToSession(departureOption.session_id, sessionId, 'Le transport aller');
          assertRowBelongsToStay(departureOption.stay_id, cartItem.stayId, 'Le transport aller');
          transportPriceCents += computeDifferentiatedAmount(departureOption, 'outbound');
        }
        if (returnOption) {
          assertRowBelongsToSession(returnOption.session_id, sessionId, 'Le transport retour');
          assertRowBelongsToStay(returnOption.stay_id, cartItem.stayId, 'Le transport retour');
          transportPriceCents += computeDifferentiatedAmount(returnOption, 'return');
        }

        transportLabel =
          formatTransportLabel(
            cartItem.selection.departureCity ?? departureOption?.departure_city ?? null,
            cartItem.selection.returnCity ?? returnOption?.return_city ?? null
          ) ??
          formatTransportLabel(departureOption?.departure_city ?? null, returnOption?.return_city ?? null);

        const departureLine = buildTransportDisplaySegment(
          'Aller',
          cartItem.selection.departureCity ?? departureOption?.departure_city ?? null,
          departureOption ? computeDifferentiatedAmount(departureOption, 'outbound') : null
        );
        const returnLine = buildTransportDisplaySegment(
          'Retour',
          cartItem.selection.returnCity ?? returnOption?.return_city ?? null,
          returnOption ? computeDifferentiatedAmount(returnOption, 'return') : null
        );
        transportDisplayLine = [departureLine, returnLine].filter(Boolean).join(' — ') || null;
      }

      let insurancePriceCents = 0;
      let persistedInsuranceOptionId: string | null = null;
      let insuranceLabel: string | null = null;
      if (cartItem.selection.insuranceOptionId) {
        const insuranceOption = await fetchInsuranceOption(cartItem.selection.insuranceOptionId);
        assertRowBelongsToSession(insuranceOption.session_id, sessionId, 'L’assurance');
        assertRowBelongsToStay(insuranceOption.stay_id, cartItem.stayId, 'L’assurance');
        insuranceLabel = insuranceOption.label;
        if (insuranceOption.source === 'INSURANCE_OPTION') {
          persistedInsuranceOptionId = insuranceOption.id;
        }

        if (insuranceOption.amount_cents != null) {
          insurancePriceCents = insuranceOption.amount_cents;
        } else if (insuranceOption.percent_value != null) {
          insurancePriceCents = Math.round((basePriceCents * insuranceOption.percent_value) / 100);
        }
      }

      let extraOptionPriceCents = 0;
      let extraOptionLabel: string | null = null;
      if (cartItem.selection.extraOptionId) {
        const extraOption = await fetchExtraOption(cartItem.selection.extraOptionId);
        assertRowBelongsToStay(extraOption.stay_id, cartItem.stayId, 'L’option supplémentaire');
        extraOptionPriceCents = extraOption.amount_cents;
        extraOptionLabel = extraOption.label;
      }

      const optionsPriceCents = transportPriceCents + insurancePriceCents + extraOptionPriceCents;
      const totalPriceCents = basePriceCents + optionsPriceCents;
      let cseAidCents = 0;
      let familyCentsAfterAid = totalPriceCents;
      let cseEligible = false;
      let cseLabel: string | null = null;

      if (cseRules && qfValue != null) {
        const eligibility = evaluatePartnerCatalogEligibility({
          rules: cseRules,
          stay: {
            age_min: stay.age_min,
            age_max: stay.age_max,
            categories: stay.categories ?? [],
            destination_country: stay.destination_country,
            destination_countries: stay.destination_countries,
            transport_mode: stay.transport_mode ?? 'NONE',
            required_documents_text: stay.required_documents_text,
            education_project_path: null,
            supervision_text: stay.supervision_text
          },
          session: {
            start_date: session.start_date,
            end_date: session.end_date
          },
          priceCents: totalPriceCents,
          organizer: {
            is_resacolo_member: true
          }
        });

        if (eligibility.status === 'ELIGIBLE') {
          const simulation = simulatePartnerAid({
            rules: cseRules,
            priceCents: totalPriceCents,
            durationDays: Math.max(
              1,
              Math.ceil(
                (new Date(`${session.end_date}T00:00:00Z`).getTime() -
                  new Date(`${session.start_date}T00:00:00Z`).getTime()) /
                  (24 * 60 * 60 * 1000)
              ) + 1
            ),
            qfValue
          });
          cseAidCents = simulation.aidCents;
          familyCentsAfterAid = simulation.familyCents;
          cseEligible = simulation.aidCents > 0;
          cseLabel = simulation.aidCents > 0 ? simulation.appliedSummary : 'Non éligible CSE';
        } else {
          cseLabel = 'Non éligible CSE';
        }
      }

      return {
        cartItemId: cartItem.id,
        stayTitle: stay.title,
        sessionId,
        organizerId: stay.organizer_id,
        sessionStartDate: session.start_date,
        sessionEndDate: session.end_date,
        basePriceCents,
        transportPriceCents,
        transportLabel,
        transportDisplayLine,
        insurancePriceCents,
        insuranceLabel,
        extraOptionPriceCents,
        optionsPriceCents,
        totalPriceCents,
        transportOptionId: pickStoredTransportOptionId(cartItem),
        insuranceOptionId: persistedInsuranceOptionId,
        extraOptionId: cartItem.selection.extraOptionId,
        extraOptionLabel,
        cseAidCents,
        familyCentsAfterAid,
        cseEligible,
        cseLabel
      };
    })
  );

  const totalCents = pricedItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
  const familyTotalCentsAfterAid = pricedItems.reduce(
    (sum, item) => sum + (item.familyCentsAfterAid ?? item.totalPriceCents),
    0
  );
  const cseTotalAidCents = pricedItems.reduce((sum, item) => sum + (item.cseAidCents ?? 0), 0);

  return {
    items: pricedItems,
    totalCents,
    familyTotalCentsAfterAid,
    cseTotalAidCents,
    currency: 'EUR'
  };
}

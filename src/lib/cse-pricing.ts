import { getServerSupabaseClient } from '@/lib/supabase/server';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import {
  evaluatePartnerCatalogEligibility,
  normalizePartnerCatalogRules,
  simulatePartnerAid
} from '@/lib/partner-catalog-rules';
import {
  isFamilyQuotientCurrent,
  parseStoredFamilyQuotient,
  resolveClientQfForAidSimulation,
  withCatalogQfScaleAidMode
} from '@/lib/partner-client-qf';
import { isMissingColumnError } from '@/lib/supabase-schema-errors';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';
import type { Stay, StaySessionOption } from '@/types/stay';

type SessionCseComputed = {
  sessionId: string;
  cseEligible: boolean;
  cseAidCents: number;
  familyCentsAfterAid: number;
  cseLabel: string | null;
};

export type UserCsePricingContext = {
  rules: PartnerCatalogRules;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
  familyQuotientCurrent: boolean;
  qfValue: number | null;
};

function sessionBasePriceCents(session: StaySessionOption) {
  if (session.partnerDiscountedPrice != null && Number.isFinite(session.partnerDiscountedPrice)) {
    return Math.max(0, Math.round(session.partnerDiscountedPrice * 100));
  }
  if (session.price != null && Number.isFinite(session.price)) {
    return Math.max(0, Math.round(session.price * 100));
  }
  return 0;
}

function sessionDurationDays(startDate: string, endDate: string) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );
}

export async function readUserCsePricingContext(userId: string): Promise<UserCsePricingContext | null> {
  const supabase = getServerSupabaseClient();
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('collectivity_id,family_quotient,family_quotient_expires_on')
    .eq('user_id', userId)
    .maybeSingle();

  if (clientError) {
    if (isMissingColumnError(clientError, 'family_quotient')) {
      return readUserCsePricingContextWithoutQf(userId);
    }
    return null;
  }

  const collectivityId = client?.collectivity_id ?? null;
  if (!collectivityId) return null;

  const { data: collectivity, error: collectivityError } = await supabase
    .from('collectivities')
    .select('catalog_rules_published,finance_mode')
    .eq('id', collectivityId)
    .maybeSingle();

  if (collectivityError && isMissingColumnError(collectivityError, 'catalog_rules_published')) {
    return null;
  }

  if (!collectivity?.catalog_rules_published) return null;
  if (normalizePartnerFinanceMode(collectivity.finance_mode) !== 'MANUAL') return null;

  const familyQuotient = parseStoredFamilyQuotient(client?.family_quotient);
  const familyQuotientExpiresOn = client?.family_quotient_expires_on?.trim()
    ? client.family_quotient_expires_on.trim().slice(0, 10)
    : null;
  const rules = withCatalogQfScaleAidMode(
    normalizePartnerCatalogRules(collectivity.catalog_rules_published)
  );

  return {
    rules,
    familyQuotient,
    familyQuotientExpiresOn,
    familyQuotientCurrent: isFamilyQuotientCurrent(familyQuotientExpiresOn),
    qfValue: resolveClientQfForAidSimulation({
      rules,
      familyQuotient,
      familyQuotientExpiresOn
    })
  };
}

async function readUserCsePricingContextWithoutQf(userId: string): Promise<UserCsePricingContext | null> {
  const supabase = getServerSupabaseClient();
  const { data: client } = await supabase
    .from('clients')
    .select('collectivity_id')
    .eq('user_id', userId)
    .maybeSingle();

  const collectivityId = client?.collectivity_id ?? null;
  if (!collectivityId) return null;

  const { data: collectivity } = await supabase
    .from('collectivities')
    .select('catalog_rules_published,finance_mode')
    .eq('id', collectivityId)
    .maybeSingle();

  if (!collectivity?.catalog_rules_published) return null;
  if (normalizePartnerFinanceMode(collectivity.finance_mode) !== 'MANUAL') return null;

  const rules = withCatalogQfScaleAidMode(
    normalizePartnerCatalogRules(collectivity.catalog_rules_published)
  );

  return {
    rules,
    familyQuotient: null,
    familyQuotientExpiresOn: null,
    familyQuotientCurrent: false,
    qfValue: resolveClientQfForAidSimulation({
      rules,
      familyQuotient: null,
      familyQuotientExpiresOn: null
    })
  };
}

export function applyCsePricingToStay(stay: Stay, context: UserCsePricingContext): Stay {
  const sessions = stay.bookingOptions?.sessions ?? [];
  if (sessions.length === 0) return stay;

  const { rules, qfValue } = context;
  const computed: SessionCseComputed[] = sessions.map((session) => {
    const sessionPriceCents = sessionBasePriceCents(session);
    const eligibility = evaluatePartnerCatalogEligibility({
      rules,
      stay: {
        age_min: stay.ageMin,
        age_max: stay.ageMax,
        categories: stay.categories,
        destination_country: stay.destinationCountry ?? null,
        destination_countries: stay.destinationCountries ?? null,
        transport_mode: stay.bookingOptions?.transportMode ?? 'NONE',
        required_documents_text: String(stay.rawContext?.documents_obligatoires ?? ''),
        education_project_path: null,
        supervision_text: String(stay.rawContext?.encadrement ?? '')
      },
      session: {
        start_date: session.startDate,
        end_date: session.endDate
      },
      priceCents: sessionPriceCents,
      organizer: {
        id: stay.organizerId,
        is_resacolo_member: true
      }
    });

    if (eligibility.status !== 'ELIGIBLE' || sessionPriceCents <= 0) {
      return {
        sessionId: session.id,
        cseEligible: false,
        cseAidCents: 0,
        familyCentsAfterAid: sessionPriceCents,
        cseLabel: 'Non éligible CSE'
      };
    }

    const simulation = simulatePartnerAid({
      rules,
      priceCents: sessionPriceCents,
      durationDays: sessionDurationDays(session.startDate, session.endDate),
      qfValue
    });

    return {
      sessionId: session.id,
      cseEligible: simulation.aidCents > 0,
      cseAidCents: simulation.aidCents,
      familyCentsAfterAid: simulation.familyCents,
      cseLabel: simulation.aidCents > 0 ? simulation.appliedSummary : 'Non éligible CSE'
    };
  });

  const sessionsWithCse = sessions.map((session) => {
    const row = computed.find((item) => item.sessionId === session.id);
    if (!row) return session;
    return {
      ...session,
      cseAidCents: row.cseAidCents,
      familyCentsAfterAid: row.familyCentsAfterAid,
      cseEligible: row.cseEligible,
      cseLabel: row.cseLabel
    };
  });

  const eligibleFamilies = sessionsWithCse
    .filter((session) => typeof session.familyCentsAfterAid === 'number' && session.cseEligible)
    .map((session) => Number(session.familyCentsAfterAid) / 100);
  const eligibleAids = sessionsWithCse
    .filter((session) => typeof session.cseAidCents === 'number' && session.cseEligible)
    .map((session) => Number(session.cseAidCents) / 100);

  return {
    ...stay,
    bookingOptions: stay.bookingOptions
      ? {
          ...stay.bookingOptions,
          sessions: sessionsWithCse
        }
      : stay.bookingOptions,
    csePriceFrom: eligibleFamilies.length > 0 ? Math.min(...eligibleFamilies) : null,
    cseAidFrom: eligibleAids.length > 0 ? Math.max(0, Math.min(...eligibleAids)) : null,
    cseLabel: eligibleFamilies.length > 0 ? 'Prix estimé après prise en charge CSE' : null
  };
}

export function applyCsePricingToStays(stays: Stay[], context: UserCsePricingContext) {
  return stays.map((stay) => applyCsePricingToStay(stay, context));
}

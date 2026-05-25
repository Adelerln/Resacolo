import { getServerSupabaseClient } from '@/lib/supabase/server';
import {
  evaluatePartnerCatalogEligibility,
  normalizePartnerCatalogRules,
  simulatePartnerAid
} from '@/lib/partner-catalog-rules';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';
import type { Stay } from '@/types/stay';

type SessionCseComputed = {
  sessionId: string;
  cseEligible: boolean;
  cseAidCents: number;
  familyCentsAfterAid: number;
  cseLabel: string | null;
};

function getSimulationQfValue(rules: PartnerCatalogRules) {
  return rules.financialRules.qfMax != null
    ? ((rules.financialRules.qfMin ?? 0) + rules.financialRules.qfMax) / 2
    : (rules.financialRules.qfMin ?? 1200);
}

export async function readUserPublishedCseRules(userId: string) {
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
    .select('id,catalog_rules_published')
    .eq('id', collectivityId)
    .maybeSingle();

  if (!collectivity?.catalog_rules_published) return null;
  return normalizePartnerCatalogRules(collectivity.catalog_rules_published);
}

export function applyCsePricingToStay(stay: Stay, rules: PartnerCatalogRules): Stay {
  const sessions = stay.bookingOptions?.sessions ?? [];
  if (sessions.length === 0) return stay;

  const qfValue = getSimulationQfValue(rules);
  const computed: SessionCseComputed[] = sessions.map((session) => {
    const sessionPriceCents = session.price != null ? Math.round(session.price * 100) : 0;
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
      durationDays: Math.max(
        1,
        Math.ceil(
          (new Date(`${session.endDate}T00:00:00Z`).getTime() -
            new Date(`${session.startDate}T00:00:00Z`).getTime()) /
            (24 * 60 * 60 * 1000)
        ) + 1
      ),
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
    cseLabel: eligibleFamilies.length > 0 ? 'Prix estimé après déduction CSE' : null
  };
}

export function applyCsePricingToStays(stays: Stay[], rules: PartnerCatalogRules) {
  return stays.map((stay) => applyCsePricingToStay(stay, rules));
}

'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserAction } from '@/lib/auth/session';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { parsePartnerCatalogRulesFromFormData } from '@/lib/partner-catalog-form';
import {
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules,
  parseAndValidatePartnerCatalogRules
} from '@/lib/partner-catalog-rules';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import {
  buildFeatureActivationMessage,
  isMissingAnyColumnError,
  isMissingColumnError
} from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

export type SaveFinancingSettingsState = {
  ok: boolean;
  message: string | null;
};

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function parsePercent(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, parsed));
}

function parseEurosToCents(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed * 100));
}

async function requirePartnerAction() {
  const session = await getCurrentUserAction();
  if (!session || session.role !== 'PARTENAIRE') {
    return null;
  }
  return session;
}

export async function saveFinancingSettingsAction(
  _prev: SaveFinancingSettingsState,
  formData: FormData
): Promise<SaveFinancingSettingsState> {
  const session = await requirePartnerAction();
  if (!session?.tenantId) {
    return { ok: false, message: 'Aucune collectivité liée à ce compte.' };
  }
  const accessRole = getPartnerAccessRoleFromSession(session);
  if (!canAccessPartnerSection(accessRole, 'financing')) {
    return { ok: false, message: 'Accès financement non autorisé.' };
  }

  const collectivityId = session.tenantId;
  const financeMode = normalizePartnerFinanceMode(String(formData.get('finance_mode') ?? 'TOTAL'));
  const financePercentValue =
    financeMode === 'PERCENT' ? parsePercent(formData.get('finance_percent_value')) : null;
  const financeFixedCents =
    financeMode === 'FIXED' ? parseEurosToCents(formData.get('finance_fixed_euros')) : null;

  const updatePayload: {
    finance_mode: string;
    finance_percent_value: number | null;
    finance_rules_text: string | null;
    updated_at: string;
    finance_fixed_cents?: number | null;
    catalog_rules_draft?: PartnerCatalogRules;
    catalog_rules_published?: PartnerCatalogRules;
    catalog_rules_published_at?: string;
  } = {
    finance_mode: financeMode,
    finance_percent_value: financePercentValue,
    finance_rules_text: normalizeOptionalString(formData.get('finance_rules_text')),
    updated_at: new Date().toISOString()
  };
  if (financeMode === 'FIXED') {
    updatePayload.finance_fixed_cents = financeFixedCents;
  }

  const supabase = getServerSupabaseClient();

  if (financeMode === 'MANUAL') {
    // Lecture ciblée (pas de select *) — seul le draft catalogue est nécessaire.
    const { data: existing, error: readError } = await supabase
      .from('collectivities')
      .select('catalog_rules_draft')
      .eq('id', collectivityId)
      .maybeSingle();
    if (readError) {
      return { ok: false, message: readError.message };
    }

    const existingRules = normalizePartnerCatalogRules(
      existing?.catalog_rules_draft ?? getDefaultPartnerCatalogRules()
    );
    const parsedFromForm = parsePartnerCatalogRulesFromFormData(formData);
    const nextRules = normalizePartnerCatalogRules({
      ...existingRules,
      financialRules: {
        ...existingRules.financialRules,
        ...parsedFromForm.financialRules
      },
      qfScale: parsedFromForm.qfScale
    });
    updatePayload.catalog_rules_draft = nextRules;
    try {
      const validated = parseAndValidatePartnerCatalogRules(nextRules, {
        skipFlatAidRateRequirement: true
      });
      updatePayload.catalog_rules_published = validated;
      updatePayload.catalog_rules_published_at = updatePayload.updated_at;
    } catch {
      // Garde le draft même si la validation publication échoue (barème incomplet).
    }
  }

  const { error } = await supabase.from('collectivities').update(updatePayload).eq('id', collectivityId);

  if (error) {
    const financeColumnMissing = isMissingAnyColumnError(error, [
      'finance_mode',
      'finance_percent_value',
      'finance_fixed_cents',
      'finance_rules_text'
    ]);

    if (financeColumnMissing) {
      const { error: legacyError } = await supabase
        .from('collectivities')
        .update({
          finance_rules_text: normalizeOptionalString(formData.get('finance_rules_text')),
          updated_at: new Date().toISOString()
        })
        .eq('id', collectivityId);

      if (legacyError) {
        if (isMissingColumnError(legacyError, 'finance_rules_text')) {
          return {
            ok: false,
            message: buildFeatureActivationMessage('La configuration de financement')
          };
        }
        return { ok: false, message: legacyError.message };
      }
    } else if (isMissingColumnError(error, 'finance_fixed_cents') && financeMode === 'FIXED') {
      return {
        ok: false,
        message:
          "Le mode Forfait n'est pas disponible sur cet environnement. Utilisez le mode Total ou Pourcentage."
      };
    } else if (
      isMissingAnyColumnError(error, ['finance_mode', 'finance_percent_value', 'finance_rules_text'])
    ) {
      return {
        ok: false,
        message: buildFeatureActivationMessage('La configuration de financement')
      };
    } else {
      return { ok: false, message: error.message };
    }
  }

  // Une seule revalidation : évite de recalculer catalogue + réservations à chaque save.
  revalidatePath('/partenaire/financement');
  if (financeMode === 'MANUAL') {
    revalidatePath('/partenaire/catalogue');
  }

  return { ok: true, message: 'Paramètres de financement enregistrés.' };
}

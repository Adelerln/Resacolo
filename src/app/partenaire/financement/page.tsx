import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { PartnerFinancementForm } from '@/components/partner/PartnerFinancementForm';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import { readPartnerCollectivity } from '@/lib/partner.server';
import {
  buildFeatureActivationMessage,
  isMissingAnyColumnError,
  isMissingColumnError
} from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
  }>;
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

function sanitizeRedirectQueryValue(value: string | undefined) {
  return value ? decodeURIComponent(value) : null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinancementPage({ searchParams }: PageProps) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const params = searchParams ? await searchParams : undefined;

  if (!canAccessPartnerSection(accessRole, 'financing')) {
    redirect('/partenaire');
  }

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Financement</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  async function saveFinancingSettings(formData: FormData) {
    'use server';

    const session = await requirePartner();
    const collectivityId = session.tenantId;
    const accessRole = getPartnerAccessRoleFromSession(session);
    if (!collectivityId) {
      redirect('/partenaire/financement?error=Aucune%20collectivite%20liee');
    }
    if (!canAccessPartnerSection(accessRole, 'financing')) {
      redirect('/partenaire');
    }

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
    const { error } = await supabase.from('collectivities').update(updatePayload).eq('id', collectivityId);

    if (error) {
      const message = String(error.message ?? '');
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
            const { error: minimalError } = await supabase
              .from('collectivities')
              .update({
                updated_at: new Date().toISOString()
              })
              .eq('id', collectivityId);

            if (minimalError) {
              redirect(`/partenaire/financement?error=${encodeURIComponent(minimalError.message)}`);
            }

            revalidatePath('/partenaire/financement');
            redirect('/partenaire/financement?saved=1');
          }

          redirect(`/partenaire/financement?error=${encodeURIComponent(legacyError.message)}`);
        }

        revalidatePath('/partenaire/financement');
        redirect('/partenaire/financement?saved=1');
      }

      if (
        isMissingColumnError(error, 'finance_fixed_cents') &&
        financeMode === 'FIXED'
      ) {
        redirect(
          '/partenaire/financement?error=Le%20mode%20Forfait%20n%27est%20pas%20disponible%20sur%20cet%20environnement.%20Utilisez%20le%20mode%20Total%20ou%20Pourcentage.'
        );
      }
      if (isMissingAnyColumnError(error, ['finance_mode', 'finance_percent_value', 'finance_rules_text'])) {
        redirect(
          `/partenaire/financement?error=${encodeURIComponent(
            buildFeatureActivationMessage('La configuration de financement')
          )}`
        );
      }
      redirect(`/partenaire/financement?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/partenaire/financement');
    revalidatePath('/partenaire/reservations');
    redirect('/partenaire/financement?saved=1');
  }

  const collectivity = await readPartnerCollectivity(collectivityId);
  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';
  const resetToken = `${params?.saved ?? ''}:${params?.error ?? ''}:${collectivity.updated_at}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Financement</h1>
        <p className="admin-page-subtitle mt-1">
          Définissez la prise en charge des séjours pour vos bénéficiaires.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}
      {isSaved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Paramètres de financement enregistrés.
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <PartnerFinancementForm
          initialMode={collectivity.finance_mode}
          initialPercentValue={collectivity.finance_percent_value}
          initialFixedEuros={
            typeof collectivity.finance_fixed_cents === 'number' ? collectivity.finance_fixed_cents / 100 : null
          }
          initialRulesText={collectivity.finance_rules_text}
          saveAction={saveFinancingSettings}
          resetToken={resetToken}
        />
      </div>
    </div>
  );
}

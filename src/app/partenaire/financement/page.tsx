import { redirect } from 'next/navigation';
import { PartnerFinancementForm } from '@/components/partner/PartnerFinancementForm';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules
} from '@/lib/partner-catalog-rules';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { saveFinancingSettingsAction } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
  }>;
};

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

  const supabase = getServerSupabaseClient();
  const { data: collectivity, error } = await supabase
    .from('collectivities')
    .select(
      'finance_mode,finance_percent_value,finance_fixed_cents,finance_rules_text,catalog_rules_draft,updated_at'
    )
    .eq('id', collectivityId)
    .maybeSingle();

  if (error || !collectivity) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Financement</h1>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error?.message || 'Impossible de charger les paramètres de financement.'}
        </p>
      </div>
    );
  }

  const catalogRules = normalizePartnerCatalogRules(
    collectivity.catalog_rules_draft ?? getDefaultPartnerCatalogRules()
  );
  const resetToken = `${params?.saved ?? ''}:${params?.error ?? ''}:${collectivity.updated_at ?? ''}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Financement</h1>
        <p className="admin-page-subtitle mt-1">
          Définissez la prise en charge des séjours pour vos bénéficiaires.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <PartnerFinancementForm
          initialMode={collectivity.finance_mode}
          initialPercentValue={collectivity.finance_percent_value}
          initialFixedEuros={
            typeof collectivity.finance_fixed_cents === 'number' ? collectivity.finance_fixed_cents / 100 : null
          }
          initialRulesText={collectivity.finance_rules_text}
          catalogRules={catalogRules}
          saveAction={saveFinancingSettingsAction}
          resetToken={resetToken}
        />
      </div>
    </div>
  );
}

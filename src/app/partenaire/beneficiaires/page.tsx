import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { PartnerBeneficiariesTable } from '@/components/partner/PartnerBeneficiariesTable';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  listPartnerBeneficiaries,
  readPartnerCollectivity,
  updatePartnerBeneficiaryFamilyQuotient
} from '@/lib/partner.server';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import { buildFeatureActivationMessage } from '@/lib/supabase-schema-errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseFamilyQuotientInput(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Le quotient familial (QF) doit être un nombre positif ou vide.');
  }
  return Math.round(parsed * 100) / 100;
}

function parseFamilyQuotientExpiresOnInput(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("La date d'expiration du QF est invalide.");
  }
  return raw;
}

function sanitizeRedirectQueryValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || null;
}

export default async function BeneficiairesPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const params = searchParams ? await searchParams : undefined;

  if (!canAccessPartnerSection(accessRole, 'beneficiaries')) {
    redirect('/partenaire');
  }

  if (!collectivityId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Bénéficiaires</h1>
        <p className="admin-page-subtitle mt-1">Aucune collectivité liée à ce compte.</p>
      </div>
    );
  }

  async function saveBeneficiaryFamilyQuotient(formData: FormData) {
    'use server';

    const nextSession = await requirePartner();
    const nextCollectivityId = nextSession.tenantId;
    const nextAccessRole = getPartnerAccessRoleFromSession(nextSession);

    if (!nextCollectivityId) {
      redirect('/partenaire/beneficiaires');
    }
    if (!canAccessPartnerSection(nextAccessRole, 'beneficiaries')) {
      redirect('/partenaire');
    }

    const beneficiaryUserId = String(formData.get('beneficiary_user_id') ?? '').trim();
    if (!beneficiaryUserId) {
      redirect('/partenaire/beneficiaires?error=Identifiant%20ayant-droit%20manquant');
    }

    try {
      const collectivity = await readPartnerCollectivity(nextCollectivityId);
      if (normalizePartnerFinanceMode(collectivity.finance_mode) !== 'MANUAL') {
        redirect('/partenaire/beneficiaires?error=Le%20QF%20n%E2%80%99est%20modifiable%20que%20pour%20le%20mode%20Calcul%20manuel.');
      }

      await updatePartnerBeneficiaryFamilyQuotient({
        collectivityId: nextCollectivityId,
        beneficiaryUserId,
        familyQuotient: parseFamilyQuotientInput(formData.get('family_quotient')),
        familyQuotientExpiresOn: parseFamilyQuotientExpiresOnInput(
          formData.get('family_quotient_expires_on')
        )
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’enregistrer le QF.';
      redirect(`/partenaire/beneficiaires?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/partenaire/beneficiaires');
    redirect('/partenaire/beneficiaires?saved=1');
  }

  const [collectivity, beneficiariesResult] = await Promise.all([
    readPartnerCollectivity(collectivityId),
    listPartnerBeneficiaries(collectivityId, session.userId)
  ]);
  const { beneficiaries, qfFieldsAvailable } = beneficiariesResult;
  const showFamilyQuotientFields = normalizePartnerFinanceMode(collectivity.finance_mode) === 'MANUAL';

  const tableRows = beneficiaries.map((beneficiary) => ({
    id: beneficiary.id,
    name: beneficiary.name,
    familyName: beneficiary.familyName,
    email: beneficiary.email,
    phone: beneficiary.phone,
    city: beneficiary.city,
    attachedAt: beneficiary.attachedAt,
    familyQuotient: beneficiary.familyQuotient,
    familyQuotientExpiresOn: beneficiary.familyQuotientExpiresOn
  }));

  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Bénéficiaires</h1>
        <p className="admin-page-subtitle mt-1">
          Ayants-droit rattachés à {collectivity.name} via le code{' '}
          <span className="font-semibold text-slate-800">{collectivity.code}</span>.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          La gestion des quotients familiaux est réservée aux partenaires dont la prise en charge se fait par calcul
          manuel (cf.{' '}
          <Link
            href="/partenaire/financement"
            className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
          >
            Financement
          </Link>
          ).
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
      {isSaved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          QF enregistré.
        </p>
      ) : null}
      {showFamilyQuotientFields && !qfFieldsAvailable ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {buildFeatureActivationMessage('Le quotient familial (QF) des ayants-droit')}
        </p>
      ) : null}
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Ayants-droit rattachés</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{beneficiaries.length}</p>
          <p className="mt-1 text-sm text-slate-500">Membres clients actuellement liés à votre collectivité.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Code de rattachement</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{collectivity.code}</p>
          <p className="mt-1 text-sm text-slate-500">Code à transmettre aux ayants-droit pour se rattacher.</p>
        </article>
      </section>

      <PartnerBeneficiariesTable
        beneficiaries={tableRows}
        qfFieldsAvailable={qfFieldsAvailable && showFamilyQuotientFields}
        saveFamilyQuotientAction={saveBeneficiaryFamilyQuotient}
      />
    </div>
  );
}

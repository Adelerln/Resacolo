import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import ErrorToast from '@/components/common/ErrorToast';
import SavedToast from '@/components/common/SavedToast';
import { PartnerBeneficiariesTable } from '@/components/partner/PartnerBeneficiariesTable';
import { PartnerBeneficiaryRosterImport } from '@/components/partner/PartnerBeneficiaryRosterImport';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import {
  listPartnerBeneficiaries,
  readPartnerCollectivity,
  updatePartnerBeneficiaryFamilyQuotient,
  updatePartnerBeneficiarySubEntity
} from '@/lib/partner.server';
import { normalizePartnerFinanceMode } from '@/lib/partner-offers';
import {
  isPartnerSubEntitiesEnabled,
  listBeneficiaryRoster,
  listPartnerSubEntities,
  parseBeneficiaryRosterCsv,
  upsertBeneficiaryRosterRows
} from '@/lib/partner-sub-entities.server';
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
  searchParams?: Promise<{ error?: string; saved?: string; imported?: string }>;
}) {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);
  const scopedSubEntityId = session.collectivitySubEntityId;
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
    const nextScopedSubEntityId = nextSession.collectivitySubEntityId;

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
        redirect(
          '/partenaire/beneficiaires?error=Le%20QF%20n%E2%80%99est%20modifiable%20que%20pour%20le%20mode%20Calcul%20manuel.'
        );
      }

      await updatePartnerBeneficiaryFamilyQuotient({
        collectivityId: nextCollectivityId,
        beneficiaryUserId,
        familyQuotient: parseFamilyQuotientInput(formData.get('family_quotient')),
        familyQuotientExpiresOn: parseFamilyQuotientExpiresOnInput(
          formData.get('family_quotient_expires_on')
        ),
        subEntityId: nextScopedSubEntityId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’enregistrer le QF.';
      redirect(`/partenaire/beneficiaires?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/partenaire/beneficiaires');
    revalidatePath('/partenaire/reservations');
    revalidatePath('/mon-compte');
    revalidatePath('/mon-compte/reservations');
    redirect('/partenaire/beneficiaires?saved=1');
  }

  async function saveBeneficiarySubEntity(formData: FormData) {
    'use server';

    const nextSession = await requirePartner();
    const nextCollectivityId = nextSession.tenantId;
    if (!nextCollectivityId || nextSession.collectivitySubEntityId) {
      redirect('/partenaire/beneficiaires');
    }

    const beneficiaryUserId = String(formData.get('beneficiary_user_id') ?? '').trim();
    const subEntityIdRaw = String(formData.get('sub_entity_id') ?? '').trim();
    if (!beneficiaryUserId) {
      redirect('/partenaire/beneficiaires?error=Identifiant%20ayant-droit%20manquant');
    }

    try {
      await updatePartnerBeneficiarySubEntity({
        collectivityId: nextCollectivityId,
        beneficiaryUserId,
        subEntityId: subEntityIdRaw || null
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d'assigner la sous-entité.";
      redirect(`/partenaire/beneficiaires?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/partenaire/beneficiaires');
    revalidatePath('/partenaire');
    redirect('/partenaire/beneficiaires?saved=1');
  }

  async function importBeneficiaryRoster(formData: FormData) {
    'use server';

    const nextSession = await requirePartner();
    const nextCollectivityId = nextSession.tenantId;
    const nextAccessRole = getPartnerAccessRoleFromSession(nextSession);
    if (!nextCollectivityId || !canAccessPartnerSection(nextAccessRole, 'beneficiaries')) {
      redirect('/partenaire');
    }

    const file = formData.get('roster_file');
    if (!(file instanceof File) || file.size === 0) {
      redirect('/partenaire/beneficiaires?error=Fichier%20CSV%20requis');
    }

    let subEntityId = String(formData.get('sub_entity_id') ?? '').trim() || null;
    if (nextSession.collectivitySubEntityId) {
      subEntityId = nextSession.collectivitySubEntityId;
    }

    try {
      const content = await file.text();
      const rows = parseBeneficiaryRosterCsv(content);
      if (rows.length === 0) {
        throw new Error('Aucune ligne valide trouvée dans le fichier CSV.');
      }
      const result = await upsertBeneficiaryRosterRows({
        collectivityId: nextCollectivityId,
        subEntityId,
        rows
      });
      revalidatePath('/partenaire/beneficiaires');
      redirect(`/partenaire/beneficiaires?imported=${result.upserted}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'importer le fichier.";
      redirect(`/partenaire/beneficiaires?error=${encodeURIComponent(message)}`);
    }
  }

  const subEntitiesEnabled = await isPartnerSubEntitiesEnabled(collectivityId);
  const [collectivity, beneficiariesResult, subEntities, roster] = await Promise.all([
    readPartnerCollectivity(collectivityId),
    listPartnerBeneficiaries(collectivityId, session.userId, scopedSubEntityId),
    subEntitiesEnabled ? listPartnerSubEntities(collectivityId) : Promise.resolve([]),
    listBeneficiaryRoster({ collectivityId, subEntityId: scopedSubEntityId })
  ]);
  const { beneficiaries, qfFieldsAvailable } = beneficiariesResult;
  const showFamilyQuotientFields = normalizePartnerFinanceMode(collectivity.finance_mode) === 'MANUAL';
  const subEntityNameById = new Map(subEntities.map((entity) => [entity.id, entity.name]));

  const tableRows = beneficiaries.map((beneficiary) => ({
    id: beneficiary.id,
    name: beneficiary.name,
    familyName: beneficiary.familyName,
    email: beneficiary.email,
    phone: beneficiary.phone,
    city: beneficiary.city,
    attachedAt: beneficiary.attachedAt,
    familyQuotient: beneficiary.familyQuotient,
    familyQuotientExpiresOn: beneficiary.familyQuotientExpiresOn,
    subEntityId: beneficiary.subEntityId,
    subEntityName: beneficiary.subEntityId
      ? subEntityNameById.get(beneficiary.subEntityId) ?? 'Sous-entité'
      : null
  }));

  const errorMessage = sanitizeRedirectQueryValue(params?.error);
  const isSaved = params?.saved === '1';
  const importedCount = sanitizeRedirectQueryValue(params?.imported);
  const pendingRoster = roster.filter((row) => !row.claimedUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Bénéficiaires</h1>
        <p className="admin-page-subtitle mt-1">
          Ayants-droit rattachés à {collectivity.name} via le code{' '}
          <span className="font-semibold text-slate-800">{collectivity.code}</span>
          {scopedSubEntityId
            ? ` · sous-entité ${subEntityNameById.get(scopedSubEntityId) ?? ''}`.trim()
            : ''}
          .
        </p>
        <p className="mt-2 text-sm text-slate-600">
          La gestion des quotients familiaux est réservée aux partenaires dont la prise en charge se
          fait par calcul manuel (cf.{' '}
          <Link
            href="/partenaire/financement"
            className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
          >
            Financement
          </Link>
          ).
        </p>
      </div>

      {errorMessage ? <ErrorToast message={errorMessage} /> : null}
      {isSaved ? <SavedToast message="Modifications enregistrées." /> : null}
      {importedCount ? (
        <SavedToast message={`${importedCount} ayant(s)-droit importé(s) dans le fichier pré-compte.`} />
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
          <p className="mt-1 text-sm text-slate-500">
            Membres clients actuellement liés à votre périmètre.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="admin-kpi-label">Code de rattachement</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{collectivity.code}</p>
          <p className="mt-1 text-sm text-slate-500">
            Code à transmettre aux ayants-droit pour se rattacher.
          </p>
        </article>
      </section>

      <PartnerBeneficiaryRosterImport
        importAction={importBeneficiaryRoster}
        subEntities={subEntities}
        lockedSubEntityId={scopedSubEntityId}
        showSubEntitySelect={subEntitiesEnabled && !scopedSubEntityId && subEntities.length > 0}
      />

      {pendingRoster.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Pré-comptes en attente ({pendingRoster.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Sous-entité</th>
                  <th className="px-4 py-3">QF</th>
                  <th className="px-4 py-3">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {pendingRoster.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{row.email}</td>
                    <td className="px-4 py-3 text-slate-700">{row.fullName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.subEntityId
                        ? subEntityNameById.get(row.subEntityId) ?? '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.familyQuotient != null ? String(row.familyQuotient) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.familyQuotientExpiresOn || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <PartnerBeneficiariesTable
        beneficiaries={tableRows}
        qfFieldsAvailable={qfFieldsAvailable && showFamilyQuotientFields}
        saveFamilyQuotientAction={saveBeneficiaryFamilyQuotient}
        subEntities={subEntities}
        canAssignSubEntity={subEntitiesEnabled && !scopedSubEntityId && subEntities.length > 0}
        saveSubEntityAction={saveBeneficiarySubEntity}
      />
    </div>
  );
}

import { redirect } from 'next/navigation';
import { PartnerBeneficiariesTable } from '@/components/partner/PartnerBeneficiariesTable';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { listPartnerBeneficiaries, readPartnerCollectivity } from '@/lib/partner.server';

export default async function BeneficiairesPage() {
  const session = await requirePartner();
  const collectivityId = session.tenantId;
  const accessRole = getPartnerAccessRoleFromSession(session);

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

  const [collectivity, beneficiaries] = await Promise.all([
    readPartnerCollectivity(collectivityId),
    listPartnerBeneficiaries(collectivityId, session.userId)
  ]);

  const tableRows = beneficiaries.map((beneficiary) => ({
    id: beneficiary.id,
    name: beneficiary.name,
    familyName: beneficiary.familyName,
    email: beneficiary.email,
    phone: beneficiary.phone,
    city: beneficiary.city,
    attachedAt: beneficiary.attachedAt
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Bénéficiaires</h1>
        <p className="admin-page-subtitle mt-1">
          Ayants-droit rattachés à {collectivity.name} via le code{' '}
          <span className="font-semibold text-slate-800">{collectivity.code}</span>.
        </p>
      </div>

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

      <PartnerBeneficiariesTable beneficiaries={tableRows} />
    </div>
  );
}

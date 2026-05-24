import { redirect } from 'next/navigation';
import { requirePartner } from '@/lib/auth/require';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { listPartnerBeneficiaries, readPartnerCollectivity } from '@/lib/partner.server';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Bénéficiaires</h1>
        <p className="admin-page-subtitle mt-1">
          Ayants-droit rattachés à {collectivity.name} via le code <span className="font-semibold text-slate-800">{collectivity.code}</span>.
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Rattaché le</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((beneficiary) => (
                <tr key={beneficiary.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{beneficiary.name}</td>
                  <td className="px-4 py-3 text-slate-600">{beneficiary.email}</td>
                  <td className="px-4 py-3 text-slate-600">{beneficiary.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{beneficiary.city}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(beneficiary.attachedAt)}</td>
                </tr>
              ))}
              {beneficiaries.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Aucun ayant-droit n&apos;est encore rattaché à votre collectivité.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function BeneficiairesPage() {
  const beneficiaries = [
    {
      id: 'benef-1',
      name: 'Camille Dupont',
      email: 'camille.dupont@mail.com',
      status: 'En attente',
      validUntil: '-',
      attachedAt: '12/02/2026'
    },
    {
      id: 'benef-2',
      name: 'Alex Martin',
      email: 'alex.martin@mail.com',
      status: 'Validé',
      validUntil: '31/12/2026',
      attachedAt: '18/01/2026'
    },
    {
      id: 'benef-3',
      name: 'Sofia Bernard',
      email: 'sofia.bernard@mail.com',
      status: 'Validé',
      validUntil: 'Pour toujours',
      attachedAt: '05/12/2025'
    },
    {
      id: 'benef-4',
      name: 'Nicolas Petit',
      email: 'nicolas.petit@mail.com',
      status: 'Refusé',
      validUntil: '-',
      attachedAt: '02/02/2026'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bénéficiaires</h1>
        <p className="text-sm text-slate-600">
          Validez les affiliations et définissez la durée d'accès.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rattaché le</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Validité</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {beneficiaries.map((beneficiary) => (
              <tr key={beneficiary.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{beneficiary.name}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.email}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.attachedAt}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.status}</td>
                <td className="px-4 py-3 text-slate-600">{beneficiary.validUntil}</td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

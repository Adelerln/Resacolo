export default function FinancementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Financement</h1>
        <p className="text-sm text-slate-600">
          Définissez la prise en charge des séjours pour vos bénéficiaires.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <form className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Mode de financement
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option>Prise en charge totale</option>
              <option>Pas de financement</option>
              <option>Quote-part en %</option>
              <option>Quote-part fixe</option>
              <option>Calcul manuel</option>
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Pourcentage pris en charge
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Ex: 40"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Montant fixe (EUR)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Ex: 150"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Règles personnalisées
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Ex: prise en charge 50% pour les revenus < 30k."
            />
          </label>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer les règles
          </button>
        </form>
      </div>
    </div>
  );
}

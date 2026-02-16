export default function MarqueBlanchePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Marque blanche</h1>
        <p className="text-sm text-slate-600">
          Personnalisez l'espace partenaire avec votre identité visuelle.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <form className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Logo du partenaire
            <input type="file" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Couleur principale
            <input type="color" className="mt-1 h-10 w-24 rounded border border-slate-200" defaultValue="#0f766e" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Texte d'accueil
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Ex: Bienvenue sur l'espace CSE Horizon."
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            URL de redirection (optionnel)
            <input
              type="url"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="https://cse-horizon.fr"
            />
          </label>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer la marque blanche
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

type PartnerBeneficiaryRosterImportProps = {
  importAction: (formData: FormData) => void | Promise<void>;
  subEntities: Array<{ id: string; name: string }>;
  lockedSubEntityId?: string | null;
  showSubEntitySelect: boolean;
};

export function PartnerBeneficiaryRosterImport({
  importAction,
  subEntities,
  lockedSubEntityId = null,
  showSubEntitySelect
}: PartnerBeneficiaryRosterImportProps) {
  return (
    <form
      action={importAction}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      encType="multipart/form-data"
    >
      <div>
        <h2 className="admin-section-title">Importer des ayants-droit (CSV)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Colonnes attendues : email, nom (optionnel), QF, expiration QF (AAAA-MM-JJ). Séparateur{' '}
          <span className="font-semibold">;</span> ou <span className="font-semibold">,</span>. Les
          personnes sans compte seront rattachées automatiquement à l&apos;inscription.
        </p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(
            'email;nom;qf;expiration\nexemple@domaine.fr;Dupont;1200;2027-12-31\n'
          )}`}
          download="modele-ayants-droit-resacolo.csv"
          className="mt-2 inline-flex text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
        >
          Télécharger un modèle CSV
        </a>
      </div>
      {showSubEntitySelect ? (
        <label className="block text-sm font-medium text-slate-700">
          Sous-entité cible
          <select
            name="sub_entity_id"
            defaultValue={lockedSubEntityId ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Sans sous-entité</option>
            {subEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </label>
      ) : lockedSubEntityId ? (
        <input type="hidden" name="sub_entity_id" value={lockedSubEntityId} />
      ) : null}
      <label className="block text-sm font-medium text-slate-700">
        Fichier CSV
        <input
          type="file"
          name="roster_file"
          accept=".csv,text/csv"
          required
          className="mt-1 block w-full text-sm text-slate-600"
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Importer
        </button>
      </div>
    </form>
  );
}

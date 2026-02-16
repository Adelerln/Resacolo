export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Séjours</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">24</div>
          <p className="mt-1 text-xs text-slate-500">Dont 6 en validation</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Réservations</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">118</div>
          <p className="mt-1 text-xs text-slate-500">Saison Été 2026</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Utilisateurs</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">12</div>
          <p className="mt-1 text-xs text-slate-500">Admins + partenaires</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">À traiter</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
            4 séjours en attente de validation.
          </div>
          <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
            9 réservations à qualifier.
          </div>
        </div>
      </div>
    </div>
  );
}

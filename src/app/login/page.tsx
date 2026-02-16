import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default function LoginPage() {
  if (process.env.MOCK_UI === '1') {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Preview UI</h1>
          <p className="mt-2 text-sm text-slate-600">
            Mode maquette actif. Choisis un espace pour visualiser les ecrans.
          </p>
          <div className="mt-6 grid gap-3">
            <a href="/admin" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Ouvrir Admin
            </a>
            <a href="/organizer" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              Ouvrir Organisateur
            </a>
            <a href="/partner" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">
              Ouvrir Partenaire
            </a>
          </div>
        </div>
      </div>
    );
  }
  const session = getSession();
  if (session) {
    if (session.role === 'ADMIN') redirect('/admin');
    if (session.role === 'ORGANISATEUR') redirect('/organizer');
    redirect('/partner');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">
          Accedez aux espaces Resacolo.
        </p>
        <form className="mt-6 space-y-4" action="/api/auth/login" method="post">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe
            <input
              name="password"
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}

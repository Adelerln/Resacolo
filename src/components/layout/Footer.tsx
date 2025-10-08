import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-slate-800">Colonies de vacances</p>
          <p className="mt-1 max-w-lg">La plateforme de référence pour explorer les colonies de vacances du collectif.</p>
        </div>
        <div className="flex gap-6">
          <Link href="/mentions-legales" className="hover:text-brand-600">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="hover:text-brand-600">
            Politique de confidentialité
          </Link>
          <Link href="/cgu" className="hover:text-brand-600">
            Conditions générales
          </Link>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Tous droits réservés.</p>
      </div>
    </footer>
  );
}

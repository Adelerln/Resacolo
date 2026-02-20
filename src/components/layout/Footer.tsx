import Link from 'next/link';

const quickLinks = [
  { href: '/sejours', label: 'Séjours' },
  { href: '/notre-concept', label: 'À propos' },
  { href: '/ressources', label: 'Ressources' },
  { href: '/contact', label: 'Contact' }
];

const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Politique de confidentialité' },
  { href: '/cgu', label: 'Conditions Générales d’Utilisation' },
  { href: '/cgv', label: 'Conditions Générales de Ventes' }
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 text-2xl font-semibold text-slate-900">
              <span className="font-display text-3xl uppercase text-brand-500">
                RESA<span className="text-slate-950">COLO</span>
              </span>
              <span className="inline-flex h-5 w-5 flex-none rounded-full bg-accent-400" />
            </Link>
            <p className="text-sm leading-relaxed text-slate-600">
              Resacolo rassemble les colonies de vacances imaginées par des organisateurs engagés pour faire grandir les
              enfants en toute confiance.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Navigation</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-brand-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Légal</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-brand-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-500">contact@resacolo.com</p>
            <p className="text-sm text-slate-500">+33 1 23 45 67 89</p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Resacolo. Tous droits réservés.</p>
          <div className="flex gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <span>Collectif indépendant</span>
            <span>—</span>
            <span>Colos responsables</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

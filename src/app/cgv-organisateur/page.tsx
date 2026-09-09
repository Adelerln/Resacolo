export const metadata = {
  title: 'CGV Organisateur | Resacolo'
};

export default function CgvOrganisateurPlaceholderPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-6 py-16">
      <h1 className="font-display text-2xl font-bold text-slate-900">CGV organisateur</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Aucun document CGV n&apos;est disponible via ce lien. Les conditions générales de vente doivent être
        téléversées par l&apos;organisateur au format PDF depuis sa fiche organisme, puis téléchargées depuis le
        récapitulatif de commande.
      </p>
    </main>
  );
}

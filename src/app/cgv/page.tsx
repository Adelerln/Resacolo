export default function CGVPage() {
  return (
    <div className="bg-white">
      <section className="bg-[#6ec7ff]">
        <div className="section-container relative py-10 sm:py-12 lg:py-14">
          <div className="relative z-[1] max-w-[58rem]">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-white/80 sm:text-[0.75rem]">
              Informations légales
            </p>
            <h1 className="mt-5 max-w-[20ch] font-display text-4xl font-bold leading-[1.08] text-white sm:max-w-[22ch] sm:text-5xl lg:max-w-[24ch] lg:text-[4rem]">
              Conditions Générales de Vente des organisateurs
            </h1>
            <div className="mt-7 max-w-[56rem] whitespace-pre-line text-sm font-bold leading-[1.6] text-white/95 sm:text-[0.95rem]">
              <p>
                Consultez ici les règles applicables aux demandes de réservation transmises via
                Resacolo et les principes encadrant la relation entre client et organisateur.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container py-12 sm:py-14 lg:py-16">
        <div className="max-w-none space-y-8 text-justify text-sm leading-7 text-slate-600">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">1. Objet</h2>
              <p>
                Le site resacolo.com (ci-après « le Site ») a pour but de faciliter la mise en relation entre les
                utilisateurs (ci-après « le Client ») et les organisateurs de colonies de vacances (ci-après
                « l’Organisateur »). En tant que plateforme de transmission de demandes de réservation, le Site permet
                au Client de sélectionner un séjour et de transmettre sa demande à l’Organisateur choisi. Il est
                important de noter que le Site ne prend pas en charge les transactions financières et ne participe pas
                directement à l’organisation ou au déroulement des séjours.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">2. Réservation et Paiement</h2>
              <p>
                Le processus de réservation commence sur le Site, où le Client peut choisir un séjour parmi une liste
                proposée par différents Organisateurs. Une fois la réservation effectuée sur le Site, celle-ci est
                transmise à l’Organisateur pour traitement. Le Client recevra ensuite une confirmation directement de
                l’Organisateur, qui sera responsable de finaliser les détails de la réservation et de mettre en place
                les modalités de paiement.
              </p>
              <p>
                Le Site ne collecte aucun paiement et n’intervient pas dans le processus financier. Le règlement des
                séjours se fait directement entre le Client et l’Organisateur, selon les méthodes de paiement
                proposées par ce dernier (virement bancaire, carte de crédit, etc.). Pour plus d’informations, les
                Conditions Générales de Vente spécifiques à chaque Organisateur sont accessibles via le tableau mis à
                disposition sur cette page.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">3. Annulation et Modification</h2>
              <p>
                Les conditions d’annulation ou de modification de la réservation sont fixées par chaque Organisateur.
                Il est donc essentiel que le Client consulte attentivement les CGV spécifiques à l’Organisateur avant
                de valider toute réservation. Le Site n’est pas responsable des modifications ou des annulations et ne
                peut intervenir dans ces procédures.
              </p>
              <p>
                Toute demande d’annulation ou de modification doit être adressée directement à l’Organisateur,
                conformément à ses propres conditions. L’Organisateur reste libre de facturer des frais d’annulation ou
                de modification, selon les termes de son contrat.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">4. Responsabilité</h2>
              <p>
                Le Site agit uniquement en tant qu’intermédiaire entre le Client et l’Organisateur. En ce sens, il ne
                peut être tenu pour responsable de l’exécution ou de la qualité des séjours proposés. Le rôle du Site
                se limite à la transmission des informations nécessaires à la réservation, et il décline toute
                responsabilité en cas de litige concernant la gestion du séjour, les conditions d’hébergement, les
                activités proposées, ou encore la sécurité durant le séjour.
              </p>
              <p>
                De plus, le Site ne saurait être tenu responsable des problèmes liés au paiement entre le Client et
                l’Organisateur, y compris en cas de retard, d’échec de paiement ou de remboursement.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">5. Protection des Données</h2>
              <p>
                Le traitement des données personnelles du Client est effectué conformément à la Politique de
                confidentialité du Site. Les informations collectées lors du processus de réservation sont uniquement
                partagées avec l’Organisateur concerné afin d’assurer la bonne exécution de la réservation. Le Site
                s’engage à ne pas partager les données personnelles des utilisateurs avec des tiers non autorisés et à
                respecter la législation en vigueur en matière de protection des données.
              </p>
              <p>
                Pour plus d’informations sur la protection de vos données personnelles et vos droits, vous pouvez
                consulter le site de la CNIL.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">6. Loi applicable</h2>
              <p>
                Les présentes Conditions Générales de Vente sont régies par la législation française, notamment le
                Code de la consommation et le Code civil.
              </p>
              <p>
                En cas de litige, les parties s’efforceront de trouver une solution amiable. Si aucune solution
                amiable n’est trouvée, le litige sera porté devant les tribunaux français compétents. Le Client peut
                également recourir à un médiateur de la consommation conformément aux articles L.612-1 et suivants du
                Code de la consommation.
              </p>
              <p>
                Toute question liée à la protection des données personnelles est régie par le Règlement Général sur la
                Protection des Données (RGPD) et la loi Informatique et Libertés en vigueur en France.
              </p>
            </section>
          </div>

          <p>
            <strong>Version en vigueur :</strong> 20 février 2026
          </p>
        </div>
      </section>
    </div>
  );
}

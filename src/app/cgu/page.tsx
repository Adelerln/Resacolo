import Link from 'next/link';

export const metadata = {
  title: 'Conditions Générales d’Utilisation | Resacolo',
  description:
    'Conditions générales d’utilisation du site www.resacolo.com : accès, données personnelles, propriété intellectuelle et responsabilités.'
};

export default function CGUPage() {
  return (
    <div className="bg-white">
      <section className="bg-[#6ec7ff]">
        <div className="section-container relative py-10 sm:py-12 lg:py-14">
          <div className="relative z-[1] max-w-[58rem]">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-white/80 sm:text-[0.75rem]">
              Informations légales
            </p>
            <h1 className="mt-5 max-w-[18ch] font-display text-4xl font-bold leading-[1.08] text-white sm:max-w-[20ch] sm:text-5xl lg:max-w-[22ch] lg:text-[4rem]">
              Conditions Générales d’utilisation
            </h1>
            <div className="mt-7 max-w-[56rem] whitespace-pre-line text-sm font-bold leading-[1.6] text-white/95 sm:text-[0.95rem]">
              <p>
                Conditions générales d’utilisation du site www.resacolo.com. Elles encadrent l’accès et
                l’usage des services proposés par la plateforme Resacolo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container py-12 sm:py-14 lg:py-16">
        <div className="max-w-none space-y-8 text-justify text-sm leading-7 text-slate-600">
          <p>
            Les présentes Conditions Générales d’Utilisation (ci-après les « CGU ») ont pour objet
            l’encadrement juridique des modalités de mise à disposition des services du site{' '}
            <strong>www.resacolo.com</strong> (ci-après le « Site ») et de leur utilisation par
            l’Utilisateur.
          </p>
          <p>
            Tout accès au Site vaut acceptation des présentes CGU, qui constituent le contrat entre le
            Site et l’Utilisateur.
          </p>

          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">1. Objet</h2>
              <p>
                Les présentes CGU définissent les conditions d’accès et d’utilisation des services
                proposés sur le Site. Elles doivent être acceptées par tout Utilisateur souhaitant
                y accéder.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  En cas de non-acceptation des présentes CGU, l’Utilisateur doit renoncer à
                  l’accès aux services proposés par le Site.
                </li>
                <li>
                  Resacolo se réserve le droit de modifier unilatéralement et à tout moment le
                  contenu des présentes CGU.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">2. Mentions légales</h2>
              <p>
                L’édition du Site est assurée par la société <strong>Resacolo SASU</strong>, au
                capital de 1&nbsp;000&nbsp;€, immatriculée au RCS de Draguignan sous le numéro{' '}
                <strong>913 250 178</strong>, dont le siège social est situé au 472 avenue de
                Cannes, 06210 Mandelieu-la-Napoule.
              </p>
              <p>
                Adresse e-mail :{' '}
                <a href="mailto:contact@resacolo.com" className="font-semibold text-brand-600 hover:text-brand-700">
                  contact@resacolo.com
                </a>
                .
              </p>
              <p>
                L’hébergeur du Site est la société <strong>OVH</strong>, dont le siège social est
                situé au 2 rue Kellermann, 59100 Roubaix.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">3. Accès au site</h2>
              <p>Le Site permet à l’Utilisateur un accès gratuit aux services suivants :</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>consultation d’informations sur les séjours ;</li>
                <li>demandes de réservation ;</li>
                <li>mise en relation avec des organisateurs.</li>
              </ul>
              <p>
                Le Site est accessible gratuitement en tout lieu à tout Utilisateur disposant d’un
                accès à Internet. Tous les frais supportés par l’Utilisateur pour accéder au service
                (matériel informatique, logiciels, connexion Internet, etc.) restent à sa charge.
              </p>
              <p>
                L’Utilisateur non membre n’a pas accès aux services réservés aux membres. Pour y
                accéder, il doit s’identifier à l’aide de son identifiant et de son mot de passe.
              </p>
              <p>
                Le Site met en œuvre tous les moyens à sa disposition pour assurer un accès de
                qualité à ses services. L’obligation étant de moyens, le Site ne s’engage pas à
                atteindre un résultat déterminé.
              </p>
              <p>
                Tout événement dû à un cas de force majeure entraînant un dysfonctionnement du
                réseau ou du serveur n’engage pas la responsabilité de Resacolo.
              </p>
              <p>
                L’accès aux services du Site peut à tout moment faire l’objet d’une interruption,
                d’une suspension ou d’une modification sans préavis, notamment pour maintenance ou
                pour tout autre motif. L’Utilisateur s’oblige à ne réclamer aucune indemnisation
                suite à une telle interruption, suspension ou modification.
              </p>
              <p>
                L’Utilisateur peut contacter le Site par messagerie électronique à l’adresse{' '}
                <a href="mailto:contact@resacolo.com" className="font-semibold text-brand-600 hover:text-brand-700">
                  contact@resacolo.com
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">4. Collecte des données</h2>
              <p>
                Le Site assure à l’Utilisateur une collecte et un traitement d’informations
                personnelles dans le respect de la vie privée, conformément à la loi n°&nbsp;78-17
                du 6 janvier 1978 relative à l’informatique, aux fichiers et aux libertés, ainsi
                qu’au Règlement général sur la protection des données (RGPD).
              </p>
              <p>
                En vertu des articles 39 et 40 de la loi du 6 janvier 1978, l’Utilisateur dispose
                d’un droit d’accès, de rectification, de suppression et d’opposition concernant ses
                données personnelles. Ce droit s’exerce :
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>via son espace personnel sur le Site ;</li>
                <li>via le formulaire de contact ;</li>
                <li>
                  par e-mail à{' '}
                  <a href="mailto:contact@resacolo.com" className="font-semibold text-brand-600 hover:text-brand-700">
                    contact@resacolo.com
                  </a>
                  .
                </li>
              </ul>
              <p>
                Pour plus d’informations, l’Utilisateur est invité à consulter la{' '}
                <Link href="/confidentialite" className="font-semibold text-brand-600 hover:text-brand-700">
                  Politique de confidentialité
                </Link>{' '}
                du Site.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">5. Propriété intellectuelle</h2>
              <p>
                Les marques, logos, signes ainsi que tous les contenus du Site (textes, images,
                sons, etc.) font l’objet d’une protection par le Code de la propriété
                intellectuelle, et plus particulièrement par le droit d’auteur.
              </p>
              <p>
                L’Utilisateur doit solliciter l’autorisation préalable du Site pour toute
                reproduction, publication ou copie des différents contenus. Il s’engage à une
                utilisation des contenus dans un cadre strictement privé ; toute utilisation à des
                fins commerciales ou publicitaires est strictement interdite.
              </p>
              <p>
                Toute représentation totale ou partielle du Site par quelque procédé que ce soit,
                sans l’autorisation expresse de l’exploitant, constituerait une contrefaçon
                sanctionnée par les articles L.&nbsp;335-2 et suivants du Code de la propriété
                intellectuelle.
              </p>
              <p>
                Conformément à l’article L.&nbsp;122-5 du Code de la propriété intellectuelle,
                l’Utilisateur qui reproduit, copie ou publie un contenu protégé doit citer l’auteur
                et sa source.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">6. Responsabilité</h2>
              <p>
                Les sources des informations diffusées sur le Site sont réputées fiables, mais le
                Site ne garantit pas qu’il soit exempt de défauts, d’erreurs ou d’omissions.
              </p>
              <p>
                Les informations communiquées sont présentées à titre indicatif et général, sans
                valeur contractuelle. Malgré des mises à jour régulières, Resacolo ne peut être
                tenue responsable de la modification des dispositions administratives et juridiques
                survenant après la publication. De même, Resacolo ne peut être tenue responsable de
                l’utilisation et de l’interprétation des informations contenues sur le Site.
              </p>
              <p>
                L’Utilisateur s’assure de garder son mot de passe secret. Toute divulgation du mot
                de passe, quelle qu’en soit la forme, est interdite. Il assume les risques liés à
                l’utilisation de son identifiant et de son mot de passe. Le Site décline toute
                responsabilité à ce titre.
              </p>
              <p>
                Resacolo ne peut être tenue responsable d’éventuels virus qui pourraient infecter
                l’ordinateur ou tout matériel informatique de l’internaute suite à une utilisation,
                un accès ou un téléchargement provenant du Site.
              </p>
              <p>
                La responsabilité du Site ne peut être engagée en cas de force majeure ou du fait
                imprévisible et insurmontable d’un tiers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">7. Liens hypertextes</h2>
              <p>
                Des liens hypertextes peuvent être présents sur le Site. L’Utilisateur est informé
                qu’en cliquant sur ces liens, il quitte le Site. Resacolo n’a pas de contrôle sur
                les pages web vers lesquelles aboutissent ces liens et ne saurait en aucun cas être
                responsable de leur contenu.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">8. Cookies</h2>
              <p>
                L’Utilisateur est informé que, lors de ses visites sur le Site, un cookie peut
                s’installer automatiquement sur son logiciel de navigation.
              </p>
              <p>
                Les cookies sont de petits fichiers stockés temporairement sur le disque dur de
                l’ordinateur de l’Utilisateur par son navigateur. Ils sont nécessaires au bon
                fonctionnement du Site. Les cookies ne contiennent pas d’information personnelle et
                ne permettent pas d’identifier quelqu’un. Un cookie contient un identifiant unique,
                généré aléatoirement et donc anonyme. Certains cookies expirent à la fin de la
                visite de l’Utilisateur, d’autres demeurent.
              </p>
              <p>
                Les informations contenues dans les cookies sont utilisées pour améliorer le Site.
                En naviguant sur le Site, l’Utilisateur les accepte. Il peut désactiver ces cookies
                via les paramètres de son logiciel de navigation.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">9. Publication par l’Utilisateur</h2>
              <p>
                Le Site peut permettre aux membres de publier des contenus (avis, photos, etc.).
              </p>
              <p>
                Dans ses publications, le membre s’engage à respecter les règles de la nétiquette
                ainsi que les règles de droit en vigueur.
              </p>
              <p>
                Le Site peut exercer une modération sur les publications et se réserve le droit de
                refuser leur mise en ligne, sans avoir à s’en justifier auprès du membre.
              </p>
              <p>
                Le membre reste titulaire de l’intégralité de ses droits de propriété
                intellectuelle. Toutefois, en publiant un contenu sur le Site, il cède à la société
                éditrice le droit non exclusif et gratuit de représenter, reproduire, adapter,
                modifier, diffuser et distribuer sa publication, directement ou par un tiers
                autorisé, dans le monde entier, sur tout support (numérique ou physique), pour la
                durée de la propriété intellectuelle. Le membre cède notamment le droit d’utiliser
                sa publication sur Internet et sur les réseaux de téléphonie mobile.
              </p>
              <p>
                La société éditrice s’engage à faire figurer le nom du membre à proximité de chaque
                utilisation de sa publication.
              </p>
              <p>
                Tout contenu mis en ligne par l’Utilisateur est de sa seule responsabilité.
                L’Utilisateur s’engage à ne pas mettre en ligne de contenus pouvant porter atteinte
                aux intérêts de tierces personnes. Tout recours en justice engagé par un tiers lésé
                contre le Site sera pris en charge par l’Utilisateur.
              </p>
              <p>
                Le contenu de l’Utilisateur peut être à tout moment et pour quelque motif que ce
                soit supprimé ou modifié par le Site, sans préavis.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">
                10. Droit applicable et juridiction compétente
              </h2>
              <p>
                La législation française s’applique aux présentes CGU. En cas d’absence de
                résolution amiable d’un litige né entre les parties, les tribunaux français seront
                seuls compétents pour en connaître.
              </p>
              <p>
                Pour toute question relative à l’application des présentes CGU, vous pouvez
                contacter l’éditeur aux coordonnées indiquées à l’article&nbsp;2.
              </p>
            </section>
          </div>

          <p>
            <strong>Version en vigueur :</strong> 16 septembre 2026
          </p>
        </div>
      </section>
    </div>
  );
}

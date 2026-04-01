'use client';

import Image from 'next/image';
import { useState } from 'react';

const tabs = [
  {
    id: 1,
    iconSrc: '/image/concept/pictos_concept/etape-bien-choisir-sa-colo_Plandetravail1.png',
    label: 'Un concept innovant',
    title: 'Un concept innovant',
    content: (
      <>
        <p>
          La plateforme RESACOLO a été créée par des organisateurs passionnés dans le but de
          promouvoir et de diffuser conjointement une offre centralisée de colonies et séjours de
          vacances.
        </p>
        <p>
          Chaque membre, adhérent de l’association ResoColo, dispose de la reconnaissance de ses
          pairs à travers la maîtrise d’un savoir-faire et le partage de valeurs communes.
        </p>
      </>
    )
  },
  {
    id: 2,
    iconSrc: '/image/concept/pictos_concept/etape-bien-choisir-sa-colo_Plandetravail2.png',
    label: 'Une expertise qualifiée',
    title: 'Une expertise qualifiée',
    content: (
      <>
        <p>
          Le recrutement des équipes d’encadrement est organisé avec soin et pertinence, adaptant
          le profil des équipes et leurs qualifications à la particularité de la colonie de
          vacances et du public accueilli.
        </p>
        <p>
          Chaque organisateur met en place un suivi 24h/24 et 7j/7 des séjours pour un
          accompagnement optimal des encadrants.
        </p>
        <p>
          En France comme à l’étranger, les séjours sont élaborés de A à Z par chaque membre. Les
          éventuels prestataires pour les activités notamment, sont sélectionnés avec intérêts pour
          une saine intégration de leurs prestations au séjour. Nombre de ces partenaires sont
          aujourd’hui fidélisés grâce à la qualité de leurs interventions et aux évaluations
          positives des participants en ayant bénéficié.
        </p>
        <p>
          L’ensemble des programmes est évalué et amélioré pour s’adapter au mieux aux attentes des
          participants mais également au cadre et au contexte propre à chaque colonie de vacances.
        </p>
      </>
    )
  },
  {
    id: 3,
    iconSrc: '/image/concept/pictos_concept/etape-bien-choisir-sa-colo_Plandetravail3.png',
    label: 'Une relation de confiance',
    title: 'Une relation de confiance',
    content: (
      <>
        <p>
          En choisissant RESACOLO, vous bénéficiez d’une réservation en circuit court, réalisée
          directement avec l’organisateur du séjour !
        </p>
        <p>
          Nombre de partenaires (collectivités, Comités d’Entreprise, associations) nous font déjà
          confiance. Différentes destinations ou thématiques de séjours font l’objet de partenariats
          et participent ainsi au référencement et à la notoriété d’une offre de qualité.
        </p>
        <p>
          Les organismes référencés sur la plateforme et leurs personnels permanents sont en lien
          direct avec les partenaires, les équipes d’encadrement et les familles de l’inscription
          jusqu’au retour du groupe et à l’évaluation du séjour.
        </p>
        <p>
          <strong>Nous choisir c’est choisir la transparence et la tranquilité d’esprit !</strong>
        </p>
      </>
    )
  }
];

export function PourquoiChoisirTabs() {
  const [activeId, setActiveId] = useState(1);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const renderPanelContent = (tab: (typeof tabs)[number]) => (
    <>
      <div className="relative mb-5">
        <span
          className="pointer-events-none absolute right-0 -top-16 hidden select-none font-serif text-[120px] leading-none text-accent-100/55 rotate-180 sm:block lg:-top-24 lg:text-[160px]"
          aria-hidden
        >
          ❝
        </span>
        <h3 className="mb-4 font-display text-xl font-semibold text-slate-900">
          {tab.title}
        </h3>
        <div className="h-0.5 w-full bg-slate-300" aria-hidden />
      </div>
      <div className="space-y-4 text-left font-medium leading-relaxed text-slate-600 sm:text-justify">
        {tab.content}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      <div className="flex flex-col gap-2 lg:min-w-[220px] lg:justify-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={`
              flex items-center gap-4 rounded-xl px-4 py-4 text-left transition
              ${activeId === tab.id ? 'bg-white py-5 shadow-md' : 'bg-transparent hover:bg-slate-50'}
            `}
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <Image
                src={tab.iconSrc}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            </span>
            <span className="font-bold text-slate-800">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-transparent p-4 shadow-none sm:p-6 lg:p-10">
        <div className="relative grid min-h-full">
          {tabs.map((tab) => (
            <div
              key={`measure-${tab.id}`}
              className="invisible col-start-1 row-start-1 pointer-events-none"
              aria-hidden
            >
              {renderPanelContent(tab)}
            </div>
          ))}
          <div className="col-start-1 row-start-1 flex flex-col justify-center">
            {renderPanelContent(active)}
          </div>
        </div>
      </div>
    </div>
  );
}

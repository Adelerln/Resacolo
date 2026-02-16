'use client';

import { useState } from 'react';

const tabs = [
  {
    id: 1,
    label: 'Un concept Innovant',
    title: 'Un concept innovant',
    content:
      "La plateforme RESACOLO a été créée par des organisateurs passionnés, pour mettre en valeur leur savoir-faire et faciliter l'accès des familles à une offre collective riche et variée de colonies de vacances. Innovation, mutualisation et transparence sont au cœur de notre démarche."
  },
  {
    id: 2,
    label: 'Une expertise qualifiée',
    title: 'Une expertise qualifiée',
    content:
      "Les membres du collectif ResaColo sont des professionnels de l'Enfance-Jeunesse reconnus. Leur expertise, leur engagement et leur connaissance du terrain garantissent des séjours conçus avec exigence et conformes aux cadres réglementaires. Chaque organisateur partage les mêmes valeurs d'épanouissement et de sécurité."
  },
  {
    id: 3,
    label: 'Une relation de confiance',
    title: 'Une relation de confiance',
    content:
      "ResaColo privilégie la relation directe entre les familles et les organisateurs, sans intermédiaire superflu. Cette confiance repose sur la transparence des informations, la qualité des séjours proposés et l'engagement du collectif à valoriser un métier et des compétences au service des enfants et des jeunes."
  }
];

export function PourquoiChoisirTabs() {
  const [activeId, setActiveId] = useState(1);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
      <div className="flex flex-col gap-2 lg:min-w-[240px]">
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
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: '#3B82F6' }}
            >
              {tab.id}
            </span>
            <span className="font-medium text-slate-800">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:p-10">
        <span
          className="pointer-events-none absolute -left-2 top-4 text-[180px] font-serif leading-none text-amber-100/80 select-none"
          aria-hidden
        >
          ❝
        </span>
        <div className="relative">
          <h3 className="mb-4 font-display text-xl font-semibold text-slate-900">
            {active.title}
          </h3>
          <p className="leading-relaxed text-slate-600">{active.content}</p>
        </div>
      </div>
    </div>
  );
}

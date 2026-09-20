import type { Stay } from '@/types/stay';

export type SeoLandingDefinition = {
  slug: string;
  /** H1 visible */
  h1: string;
  title: string;
  description: string;
  keywords: string[];
  /** Court texte SEO indexable */
  intro: string;
  /** Filtres catalogue préremplis */
  catalogQuery: string;
  match: (stay: Stay) => boolean;
};

function includesAny(haystack: string, needles: string[]) {
  const value = haystack.toLowerCase();
  return needles.some((needle) => value.includes(needle.toLowerCase()));
}

function stayHaystack(stay: Stay) {
  return [
    stay.title,
    stay.summary,
    stay.description,
    stay.region,
    stay.location,
    stay.seasonName,
    stay.destinationRegion,
    stay.destinationCountry,
    stay.destinationCity,
    stay.seo?.primaryKeyword,
    stay.seo?.targetRegion,
    stay.seo?.targetCity,
    ...(stay.categories ?? []),
    ...(stay.seo?.secondaryKeywords ?? []),
    ...(stay.seo?.searchIntents ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Hub + landings d’intention pour requêtes « colonie / séjour enfants ». */
export const SEO_LANDINGS: SeoLandingDefinition[] = [
  {
    slug: 'ete',
    h1: 'Colonies de vacances d’été',
    title: 'Colonies de vacances d’été pour enfants',
    description:
      'Trouvez une colonie de vacances d’été pour enfants et ados : mer, montagne, nature ou villes. Comparez dates, âges et tarifs sur Resacolo.',
    keywords: ['colonie été', 'colo été', 'colonie de vacances été', 'séjour été enfants'],
    intro:
      'L’été est la période phare des colonies de vacances. Resacolo regroupe des séjours pour enfants et adolescents partout en France et à l’étranger, avec des organisateurs du collectif.',
    catalogQuery: '/sejours?periods=ete',
    match: (stay) =>
      includesAny(stayHaystack(stay), ['été', 'ete', 'juillet', 'août', 'aout', 'summer']) ||
      includesAny(stay.seasonName ?? '', ['été', 'ete'])
  },
  {
    slug: 'mer',
    h1: 'Colonies de vacances à la mer',
    title: 'Colonies de vacances mer et littoral',
    description:
      'Réservez une colonie de vacances à la mer : littoral atlantique, Méditerranée, activités nautiques. Séjours enfants et ados sur Resacolo.',
    keywords: ['colonie mer', 'colo mer', 'séjour mer enfants', 'colonie littoral'],
    intro:
      'Une colo à la mer, c’est baignade encadrée, découvertes du littoral et activités nautiques selon l’âge. Parcourez les séjours mer proposés par les organisateurs Resacolo.',
    catalogQuery: '/sejours?q=mer',
    match: (stay) =>
      includesAny(stayHaystack(stay), ['mer', 'plage', 'littoral', 'océan', 'ocean', 'méditerranée', 'atlantique', 'nautique'])
  },
  {
    slug: 'montagne',
    h1: 'Colonies de vacances à la montagne',
    title: 'Colonies de vacances montagne',
    description:
      'Colonies de vacances à la montagne pour enfants et ados : randonnée, nature, grands espaces. Comparez les séjours sur Resacolo.',
    keywords: ['colonie montagne', 'colo montagne', 'séjour montagne enfants'],
    intro:
      'Les séjours montagne offrent grands espaces, randonnées et vie de groupe au grand air. Retrouvez les colonies montagne du collectif Resacolo.',
    catalogQuery: '/sejours?q=montagne',
    match: (stay) => includesAny(stayHaystack(stay), ['montagne', 'alpes', 'pyrénées', 'pyrenees', 'vosges', 'jura'])
  },
  {
    slug: 'ski',
    h1: 'Colonies de vacances au ski',
    title: 'Colonies de vacances ski et neige',
    description:
      'Partir en colonie de vacances au ski : cours, neige et vie de groupe. Séjours enfants et ados à réserver sur Resacolo.',
    keywords: ['colonie ski', 'colo ski', 'séjour ski enfants', 'colonie neige'],
    intro:
      'Ski, snowboard et vacances à la neige en colonie : des formules adaptées à l’âge et au niveau. Explorez les séjours ski sur Resacolo.',
    catalogQuery: '/sejours?q=ski',
    match: (stay) => includesAny(stayHaystack(stay), ['ski', 'neige', 'snowboard', 'hiver'])
  },
  {
    slug: 'europe',
    h1: 'Colonies de vacances en Europe',
    title: 'Colonies de vacances et séjours en Europe',
    description:
      'Colonies de vacances et séjours linguistiques ou découverte en Europe pour enfants et ados. Réservez sur Resacolo.',
    keywords: ['colonie europe', 'séjour europe enfants', 'colo angleterre', 'colo espagne'],
    intro:
      'Voyager en Europe en colonie, c’est découvrir une langue ou une culture autrement. Retrouvez les séjours Europe des organisateurs Resacolo.',
    catalogQuery: '/sejours?q=europe',
    match: (stay) =>
      includesAny(stayHaystack(stay), [
        'europe',
        'espagne',
        'angleterre',
        'irlande',
        'italie',
        'allemagne',
        'portugal',
        'gréce',
        'grece',
        'abroad',
        'étranger',
        'etranger'
      ]) || stay.destinationType === 'fixed_abroad'
  },
  {
    slug: 'enfants',
    h1: 'Séjours et colonies pour enfants',
    title: 'Séjours pour enfants et colonies de vacances',
    description:
      'Trouvez un séjour pour enfants ou une colonie de vacances adaptée à l’âge de votre enfant. Catalogue Resacolo, organisateurs du collectif.',
    keywords: ['séjour enfants', 'colonie enfants', 'colo enfants', 'vacances enfants'],
    intro:
      'Resacolo simplifie la recherche d’un séjour pour enfants : filtrez par âge, période et destination, puis réservez auprès d’organisateurs de colonies.',
    catalogQuery: '/sejours',
    match: () => true
  },
  {
    slug: 'ados',
    h1: 'Colonies de vacances pour ados',
    title: 'Colonies de vacances et séjours pour adolescents',
    description:
      'Colonies de vacances pour ados et séjours adolescents : autonomie, activités et destinations. Comparez les offres sur Resacolo.',
    keywords: ['colonie ado', 'colo ado', 'séjour ado', 'colonie adolescents', 'vacances ados'],
    intro:
      'Les colonies pour adolescents proposent plus d’autonomie et des activités adaptées aux 12–17 ans. Parcourez les séjours ados du collectif Resacolo.',
    catalogQuery: '/sejours?q=ado',
    match: (stay) =>
      includesAny(stayHaystack(stay), ['ado', 'ados', 'adolescent', 'adolescents', 'teen']) ||
      ((stay.ageMax ?? 0) >= 13 && (stay.ageMin ?? 0) >= 11)
  },
  {
    slug: 'toussaint',
    h1: 'Colonies de vacances à la Toussaint',
    title: 'Colonies de vacances Toussaint',
    description:
      'Réservez une colonie de vacances pendant les vacances de la Toussaint : séjours courts pour enfants et ados sur Resacolo.',
    keywords: ['colonie toussaint', 'colo toussaint', 'vacances toussaint enfants', 'séjour octobre'],
    intro:
      'Les vacances de la Toussaint sont idéales pour une colo courte. Retrouvez les séjours proposés sur cette période par les organisateurs Resacolo.',
    catalogQuery: '/sejours?periods=toussaint',
    match: (stay) =>
      includesAny(stayHaystack(stay), ['toussaint', 'octobre', 'automne']) ||
      includesAny(stay.seasonName ?? '', ['toussaint', 'automne'])
  },
  {
    slug: 'hiver',
    h1: 'Colonies de vacances d’hiver',
    title: 'Colonies de vacances hiver et neige',
    description:
      'Colonies de vacances d’hiver pour enfants et ados : neige, montagne ou séjours découverte. Comparez sur Resacolo.',
    keywords: ['colonie hiver', 'colo hiver', 'vacances hiver enfants', 'séjour février'],
    intro:
      'L’hiver, partez en colo à la neige ou en séjour découverte. Explorez les colonies d’hiver du collectif Resacolo.',
    catalogQuery: '/sejours?periods=hiver',
    match: (stay) =>
      includesAny(stayHaystack(stay), ['hiver', 'février', 'fevrier', 'neige', 'ski']) ||
      includesAny(stay.seasonName ?? '', ['hiver'])
  },
  {
    slug: 'printemps',
    h1: 'Colonies de vacances de printemps',
    title: 'Colonies de vacances printemps',
    description:
      'Colonies de vacances au printemps pour enfants et ados : nature, mer ou découverte. Réservez sur Resacolo.',
    keywords: ['colonie printemps', 'colo printemps', 'vacances de printemps enfants'],
    intro:
      'Le printemps offre des séjours plus courts, souvent en pleine nature. Découvrez les colonies de printemps sur Resacolo.',
    catalogQuery: '/sejours?periods=printemps',
    match: (stay) =>
      includesAny(stayHaystack(stay), ['printemps', 'avril', 'mai', 'pâques', 'paques']) ||
      includesAny(stay.seasonName ?? '', ['printemps'])
  },
  {
    slug: 'linguistique',
    h1: 'Séjours linguistiques et colonies à l’étranger',
    title: 'Séjours linguistiques pour enfants et ados',
    description:
      'Séjours linguistiques et colonies à l’étranger pour apprendre une langue autrement. Offres enfants et ados sur Resacolo.',
    keywords: [
      'séjour linguistique',
      'colonie linguistique',
      'colo angleterre',
      'séjour langue enfants'
    ],
    intro:
      'Un séjour linguistique combine immersion, activités et vie de groupe. Retrouvez les formules proposées par les organisateurs Resacolo.',
    catalogQuery: '/sejours?q=linguistique',
    match: (stay) =>
      includesAny(stayHaystack(stay), [
        'linguistique',
        'langue',
        'english',
        'anglais',
        'espagnol',
        'immersion',
        'language'
      ]) || stay.destinationType === 'fixed_abroad'
  }
];

export function getSeoLandingBySlug(slug: string) {
  return SEO_LANDINGS.find((landing) => landing.slug === slug) ?? null;
}

export function filterStaysForLanding(stays: Stay[], landing: SeoLandingDefinition) {
  return stays.filter((stay) => landing.match(stay));
}

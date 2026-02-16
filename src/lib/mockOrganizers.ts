export interface MockOrganizer {
  slug: string;
  name: string;
  creationYear: number;
  publicAgeRange: string;
  logoUrl?: string;
  description?: string;
  website?: string;
}

export const mockOrganizers: MockOrganizer[] = [
  {
    slug: 'aventures-vacances-energie',
    name: 'AVENTURES VACANCES ÉNERGIE',
    creationYear: 2014,
    publicAgeRange: '4-17 ans',
    website: 'https://www.aventures-vacances-energie.com/'
  },
  {
    slug: 'cei',
    name: 'CEI',
    creationYear: 1947,
    publicAgeRange: '6-25 ans',
    website: 'https://www.cei-voyage.fr/'
  },
  {
    slug: 'cesl',
    name: 'CESL',
    creationYear: 1985,
    publicAgeRange: '4-17 ans',
    website: 'https://www.cesl.fr/'
  },
  {
    slug: 'chic-planet-colos',
    name: "CHIC PLANET' COLOS",
    creationYear: 1996,
    publicAgeRange: '4-17 ans',
    website: 'https://colos.chic-planet.fr/'
  },
  {
    slug: 'eole-loisirs',
    name: 'Eole Loisirs',
    creationYear: 1990,
    publicAgeRange: '4-17 ans',
    website: 'https://www.eole-loisirs.com/'
  },
  {
    slug: 'eterpa',
    name: 'Eterpa',
    creationYear: 1988,
    publicAgeRange: '6-17 ans',
    website: 'https://www.eterpa.fr/'
  },
  {
    slug: 'les-colos-du-bonheur',
    name: 'Les Colos du Bonheur',
    creationYear: 2005,
    publicAgeRange: '4-17 ans',
    website: 'https://www.colosdubonheur.fr/'
  }
];

export function getOrganizerBySlug(slug: string): MockOrganizer | undefined {
  return mockOrganizers.find((o) => o.slug === slug);
}

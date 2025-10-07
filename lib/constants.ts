import { OrganizerInfo } from '@/types/stay';

export const ORGANIZERS: OrganizerInfo[] = [
  {
    name: 'Aventures Vacances Énergie',
    website: 'https://www.aventures-vacances-energie.com/'
  },
  { name: 'CEI', website: 'https://www.cei-voyage.fr/' },
  { name: 'CESL', website: 'https://www.cesl.fr/' },
  { name: "Chic Planet' Colos", website: 'https://colos.chic-planet.fr/' },
  { name: 'Eole Loisirs', website: 'https://www.eole-loisirs.com/' },
  { name: 'Equifun', website: 'https://equifun.net/' },
  { name: 'Les Colos du Bonheur', website: 'https://www.colosdubonheur.fr/' },
  { name: 'Les Vacances du Zèbre', website: 'https://www.le-zebre.com/' },
  { name: 'Planète Aventures', website: 'https://www.planeteaventures.fr/' },
  { name: 'Poneys des 4 Saisons', website: 'https://www.poneys-des-quatre-saisons.fr/' },
  { name: 'Thalie', website: 'https://www.thalie.eu/' },
  { name: 'Zigo Tours', website: 'https://www.zigotours.com/' }
];

export const FILTER_LABELS = {
  categories: {
    nature: 'Nature',
    sport: 'Sport',
    culture: 'Culture',
    langues: 'Langues',
    mer: 'Mer',
    montagne: 'Montagne',
    'multi-activites': 'Multi-activités',
    solidarite: 'Solidarité',
    science: 'Sciences',
    arts: 'Arts'
  },
  audiences: {
    '6-9': '6-9 ans',
    '10-12': '10-12 ans',
    '13-15': '13-15 ans',
    '16-17': '16-17 ans'
  },
  durations: {
    'mini-sejour': 'Mini-séjour',
    semaine: '1 semaine',
    quinzaine: '2 semaines',
    long: '3 semaines et +'
  },
  periods: {
    hiver: 'Hiver',
    printemps: 'Printemps',
    ete: 'Été',
    automne: 'Automne',
    toussaint: 'Toussaint'
  },
  transport: {
    'depart-paris': 'Départ Paris',
    'depart-region': 'Départ régions',
    'sans-transport': 'Sans transport'
  }
} as const;

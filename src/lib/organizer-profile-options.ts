export type OrganizerSeasonKey = 'printemps' | 'ete' | 'automne' | 'hiver' | 'fin-annee';

export type OrganizerStayTypeKey =
  | 'artistique'
  | 'campagne'
  | 'equestre'
  | 'etranger'
  | 'itinerant'
  | 'linguistique'
  | 'mer'
  | 'montagne'
  | 'scientifique'
  | 'sport';

export type OrganizerActivityKey =
  | 'musique-chant'
  | 'animaux'
  | 'aquatiques'
  | 'aventure-plein-air'
  | 'conduite-accompagnee'
  | 'cuisine'
  | 'equitation'
  | 'langues'
  | 'nautiques'
  | 'parc-dattractions'
  | 'culture-decouverte'
  | 'escape-game'
  | 'informatique'
  | 'sciences'
  | 'sports-collectifs-individuels'
  | 'sport-eaux-vives'
  | 'sports-hiver-neige'
  | 'sports-glisse'
  | 'sports-mecaniques'
  | 'cirque'
  | 'danse'
  | 'dessin-manga'
  | 'graff'
  | 'loisirs-creatifs'
  | 'magie'
  | 'mode'
  | 'photo-cinema'
  | 'theatre';

type OrganizerOption<T extends string> = {
  key: T;
  label: string;
  iconPath: string;
};

export const ORGANIZER_SEASON_OPTIONS: OrganizerOption<OrganizerSeasonKey>[] = [
  {
    key: 'printemps',
    label: "Vacances de Printemps",
    iconPath: '/image/sejours/pictos_saisons/printemps.png'
  },
  {
    key: 'ete',
    label: "Vacances d'Été",
    iconPath: '/image/sejours/pictos_saisons/ete.png'
  },
  {
    key: 'automne',
    label: "Vacances d'Automne",
    iconPath: '/image/sejours/pictos_saisons/automne.png'
  },
  {
    key: 'hiver',
    label: "Vacances d'Hiver",
    iconPath: '/image/sejours/pictos_saisons/hiver-findannee.png'
  },
  {
    key: 'fin-annee',
    label: "Vacances de Fin d'année",
    iconPath: '/image/sejours/pictos_saisons/hiver-findannee.png'
  }
];

export const ORGANIZER_STAY_TYPE_OPTIONS: OrganizerOption<OrganizerStayTypeKey>[] = [
  { key: 'artistique', label: 'Artistique', iconPath: '/image/sejours/pictos_sejours/artistique.png' },
  { key: 'campagne', label: 'Campagne', iconPath: '/image/sejours/pictos_sejours/campagne.png' },
  { key: 'equestre', label: 'Équestre', iconPath: '/image/sejours/pictos_sejours/equestre.png' },
  { key: 'etranger', label: 'Étranger', iconPath: '/image/sejours/pictos_sejours/etranger.png' },
  { key: 'itinerant', label: 'Itinérant', iconPath: '/image/sejours/pictos_sejours/itinerant.png' },
  { key: 'linguistique', label: 'Linguistique', iconPath: '/image/sejours/pictos_sejours/linguistique.png' },
  { key: 'mer', label: 'Mer', iconPath: '/image/sejours/pictos_sejours/mer.png' },
  { key: 'montagne', label: 'Montagne', iconPath: '/image/sejours/pictos_sejours/montagnes.png' },
  { key: 'scientifique', label: 'Scientifique', iconPath: '/image/sejours/pictos_sejours/scientifique.png' },
  { key: 'sport', label: 'Sport', iconPath: '/image/sejours/pictos_sejours/sport.png' }
];

export const ORGANIZER_ACTIVITY_OPTIONS: OrganizerOption<OrganizerActivityKey>[] = [
  { key: 'musique-chant', label: 'Musique - Chant', iconPath: '/image/sejours/pictos_activites/musique-chant.png' },
  { key: 'animaux', label: 'Animaux', iconPath: '/image/sejours/pictos_activites/animaux.png' },
  { key: 'aquatiques', label: 'Aquatiques', iconPath: '/image/sejours/pictos_activites/activites-aquatiques.png' },
  { key: 'aventure-plein-air', label: 'Aventure - plein-air', iconPath: '/image/sejours/pictos_activites/aventure-plein-air.png' },
  { key: 'conduite-accompagnee', label: 'Conduite accompagnée', iconPath: '/image/sejours/pictos_activites/conduite-accompagnee.png' },
  { key: 'cuisine', label: 'Cuisine', iconPath: '/image/sejours/pictos_activites/cuisine.png' },
  { key: 'equitation', label: 'Équitation', iconPath: '/image/sejours/pictos_activites/equitation.png' },
  { key: 'langues', label: 'Langues', iconPath: '/image/sejours/pictos_activites/langues.png' },
  { key: 'nautiques', label: 'Nautiques', iconPath: '/image/sejours/pictos_activites/activite-nautiques.png' },
  { key: 'parc-dattractions', label: "Parc d'attractions", iconPath: '/image/sejours/pictos_activites/parc-dattractions.png' },
  { key: 'culture-decouverte', label: 'Culture et découverte', iconPath: '/image/sejours/pictos_activites/culture-decouverte.png' },
  { key: 'escape-game', label: 'Escape Game', iconPath: '/image/sejours/pictos_activites/escape-game.png' },
  { key: 'informatique', label: 'Informatique', iconPath: '/image/sejours/pictos_activites/informatique.png' },
  { key: 'sciences', label: 'Sciences', iconPath: '/image/sejours/pictos_activites/sciences.png' },
  { key: 'sports-collectifs-individuels', label: 'Sports collectifs - individuels', iconPath: '/image/sejours/pictos_activites/sports-collectifs-individuels.png' },
  { key: 'sport-eaux-vives', label: "Sports d'eaux vives", iconPath: '/image/sejours/pictos_activites/sport-eaux-vives.png' },
  { key: 'sports-hiver-neige', label: "Sports d'Hiver - Neige", iconPath: '/image/sejours/pictos_activites/neige-sporthiver.png' },
  { key: 'sports-glisse', label: 'Sports de glisse', iconPath: '/image/sejours/pictos_activites/sport-glisse.png' },
  { key: 'sports-mecaniques', label: 'Sports mécaniques', iconPath: '/image/sejours/pictos_activites/sports-mecaniques.png' },
  { key: 'cirque', label: 'Cirque', iconPath: '/image/sejours/pictos_activites/chapiteau-de-cirque.png' },
  { key: 'danse', label: 'Danse', iconPath: '/image/sejours/pictos_activites/danse.png' },
  { key: 'dessin-manga', label: 'Dessin - Manga', iconPath: '/image/sejours/pictos_activites/dessiner.png' },
  { key: 'graff', label: 'Graff', iconPath: '/image/sejours/pictos_activites/graff.png' },
  { key: 'loisirs-creatifs', label: 'Loisirs créatifs', iconPath: '/image/sejours/pictos_activites/loisirs-creatifs.png' },
  { key: 'magie', label: 'Magie', iconPath: '/image/sejours/pictos_activites/la-magie.png' },
  { key: 'mode', label: 'Mode', iconPath: '/image/sejours/pictos_activites/mode.png' },
  { key: 'photo-cinema', label: 'Photo-Cinéma', iconPath: '/image/sejours/pictos_activites/photo-cinema.png' },
  { key: 'theatre', label: 'Théâtre', iconPath: '/image/sejours/pictos_activites/theatre.png' }
];

/** Picto + libellé court pour la pastille saison sur une carte séjour (nom issu de la table `seasons`). */
export function resolveStaySeasonPicto(
  seasonName: string | null | undefined
): { iconPath: string; badgeText: string } {
  const raw = seasonName?.trim() ?? '';
  const lower = raw.toLowerCase();

  const badgeText = (() => {
    if (!raw) return 'SAISON';
    if (lower.includes('été') || lower.includes('ete')) return 'ÉTÉ';
    if (lower.includes('hiver')) return 'HIVER';
    if (lower.includes('printemps')) return 'PRINTEMPS';
    if (lower.includes('automne')) return 'AUTOMNE';
    if (lower.includes('toussaint')) return 'TOUSSAINT';
    return raw.toLocaleUpperCase('fr-FR').slice(0, 14);
  })();

  let key: OrganizerSeasonKey = 'ete';
  if (lower.includes('printemps')) key = 'printemps';
  else if (lower.includes('automne') || lower.includes('toussaint')) key = 'automne';
  else if (lower.includes('hiver') || lower.includes('noël') || lower.includes('noel')) key = 'hiver';
  else if (lower.includes('été') || lower.includes('ete')) key = 'ete';
  else if (lower.includes('fin') && (lower.includes('année') || lower.includes('annee'))) key = 'fin-annee';

  const opt =
    ORGANIZER_SEASON_OPTIONS.find((option) => option.key === key) ??
    ORGANIZER_SEASON_OPTIONS.find((option) => option.key === 'ete')!;

  return { iconPath: opt.iconPath, badgeText };
}

export function sanitizeOrganizerOptionValues<T extends string>(
  values: FormDataEntryValue[],
  options: readonly OrganizerOption<T>[]
) {
  const allowed = new Set(options.map((option) => option.key));
  const result: T[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    if (!allowed.has(value as T)) continue;
    if (result.includes(value as T)) continue;
    result.push(value as T);
  }

  return result;
}

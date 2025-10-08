export type StayCategory =
  | 'nature'
  | 'sport'
  | 'culture'
  | 'langues'
  | 'mer'
  | 'montagne'
  | 'multi-activites'
  | 'solidarite'
  | 'science'
  | 'arts';

export type StayAudience = '6-9' | '10-12' | '13-15' | '16-17';

export type StayDuration = 'mini-sejour' | 'semaine' | 'quinzaine' | 'long';

export interface StayFilters {
  categories: StayCategory[];
  audiences: StayAudience[];
  durations: StayDuration[];
  periods: ('hiver' | 'printemps' | 'ete' | 'automne' | 'toussaint')[];
  priceRange: [number, number] | null;
  transport: ('depart-paris' | 'depart-region' | 'sans-transport')[];
}

export interface OrganizerInfo {
  name: string;
  website: string;
  logoUrl?: string;
  description?: string;
}

export interface Stay {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  organizer: OrganizerInfo;
  location: string;
  country: string;
  ageRange: string;
  duration: string;
  priceFrom: number | null;
  period: string[];
  categories: StayCategory[];
  highlights: string[];
  coverImage?: string;
  filters: StayFilters;
  sourceUrl?: string;
  rawContext?: Record<string, unknown>;
  updatedAt: string;
}

export interface StaySearchParams {
  q?: string;
  audiences?: StayAudience[];
  categories?: StayCategory[];
  durations?: StayDuration[];
  periods?: ('hiver' | 'printemps' | 'ete' | 'automne' | 'toussaint')[];
  priceMax?: number;
  organizer?: string;
}

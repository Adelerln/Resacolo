export type StayCategory =
  | 'mer'
  | 'montagne'
  | 'campagne'
  | 'artistique'
  | 'equestre'
  | 'linguistique'
  | 'scientifique'
  | 'sportif'
  | 'itinerant'
  | 'etranger';

export type StayAudience = '6-9' | '10-12' | '13-15' | '16-17';

export type StayDuration = 'mini-sejour' | 'semaine' | 'quinzaine' | 'long';

export interface StayFilters {
  categories: StayCategory[];
  audiences: StayAudience[];
  durations: StayDuration[];
  periods: ('hiver' | 'printemps' | 'ete' | 'automne' | 'toussaint')[];
  priceRange: [number, number] | null;
  transport: ('Aller/Retour similaire' | 'Aller/Retour différencié' | 'Sans transport')[];
}

export interface OrganizerInfo {
  name: string;
  website: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
}

export interface StayTransportOption {
  id: string;
  departureCity: string;
  returnCity: string;
  amount: number;
}

export interface StayInsuranceOption {
  id: string;
  label: string;
  amount: number | null;
  percentValue: number | null;
  pricingMode: string;
}

export interface StayExtraOption {
  id: string;
  label: string;
  amount: number;
}

export interface StaySessionOption {
  id: string;
  startDate: string;
  endDate: string;
  price: number | null;
  status: string;
  transportOptions: StayTransportOption[];
}

export interface StayBookingOptions {
  transportMode: string;
  sessions: StaySessionOption[];
  insuranceOptions: StayInsuranceOption[];
  extraOptions: StayExtraOption[];
}

export interface StaySeo {
  primaryKeyword?: string;
  secondaryKeywords: string[];
  targetCity?: string;
  targetRegion?: string;
  searchIntents: string[];
  title?: string;
  metaDescription?: string;
  introText?: string;
  h1Variant?: string;
  internalLinkAnchorSuggestions?: string[];
  slugCandidate?: string;
  score?: number;
  checks?: Array<{
    code: string;
    level: 'ok' | 'warning' | 'info';
    message: string;
  }>;
  generatedAt?: string;
  generationSource?: string;
}

export interface Stay {
  id: string;
  title: string;
  slug: string;
  canonicalSlug: string;
  legacySlugs?: string[];
  summary: string;
  description: string;
  seasonId: string;
  seasonName: string;
  organizerId: string;
  organizer: OrganizerInfo;
  location: string;
  region: string;
  country: string;
  ageMin: number | null;
  ageMax: number | null;
  ageRange: string;
  duration: string;
  priceFrom: number | null;
  period: string[];
  categories: StayCategory[];
  highlights: string[];
  activitiesText?: string;
  programText?: string;
  transportText?: string;
  coverImage?: string;
  filters: StayFilters;
  bookingOptions?: StayBookingOptions;
  seo?: StaySeo;
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

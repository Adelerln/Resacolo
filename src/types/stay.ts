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
  transportOptions: StayTransportOption[];
}

export interface StayBookingOptions {
  transportMode: string;
  sessions: StaySessionOption[];
  insuranceOptions: StayInsuranceOption[];
  extraOptions: StayExtraOption[];
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
  bookingOptions?: StayBookingOptions;
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

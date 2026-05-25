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
  /** Si défini, option limitée à cette session ; sinon valable pour toutes les sessions du séjour. */
  sessionId?: string | null;
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
  cseAidCents?: number;
  familyCentsAfterAid?: number;
  cseEligible?: boolean;
  cseLabel?: string | null;
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

export interface StayCenterLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface StayAccommodation {
  id: string;
  name: string;
  accommodationType: string | null;
  locationLabel: string | null;
  mapEmbedSrc?: string | null;
  addressText?: string | null;
  postalCode?: string | null;
  city?: string | null;
  departmentCode?: string | null;
  regionText?: string | null;
  country?: string | null;
  description: string;
  bedInfo: string;
  bathroomInfo: string;
  cateringInfo: string;
  accessibilityInfo: string;
  imageUrls: string[];
  /** Liens vidéo (YouTube, Vimeo, etc.) associés au lieu d’hébergement. */
  videoUrls?: string[];
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
  displayLocation?: string;
  region: string;
  country: string;
  destinationType?: 'fixed_france' | 'fixed_abroad' | 'itinerant' | null;
  destinationCity?: string | null;
  destinationPostalCode?: string | null;
  destinationDepartmentCode?: string | null;
  destinationRegion?: string | null;
  destinationCountry?: string | null;
  destinationItineraryLabel?: string | null;
  destinationCountries?: string[];
  ageMin: number | null;
  ageMax: number | null;
  ageRange: string;
  duration: string;
  priceFrom: number | null;
  csePriceFrom?: number | null;
  cseAidFrom?: number | null;
  cseLabel?: string | null;
  period: string[];
  categories: StayCategory[];
  highlights: string[];
  activitiesText?: string;
  programText?: string;
  transportText?: string;
  coverImage?: string;
  galleryImages?: string[];
  videoUrls?: string[];
  filters: StayFilters;
  bookingOptions?: StayBookingOptions;
  centerLocations?: StayCenterLocation[];
  accommodations?: StayAccommodation[];
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

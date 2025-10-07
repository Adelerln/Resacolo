import { FILTER_LABELS, ORGANIZERS } from '@/lib/constants';
import type { StayAudience, StayCategory, StayDuration, StayFilters as StayFiltersMeta } from '@/types/stay';

type StayPeriod = StayFiltersMeta['periods'][number];
type StayTransport = StayFiltersMeta['transport'][number];

export const filterGroups = {
  categories: Object.entries(FILTER_LABELS.categories).map(([value, label]) => ({ value: value as StayCategory, label })),
  audiences: Object.entries(FILTER_LABELS.audiences).map(([value, label]) => ({ value: value as StayAudience, label })),
  durations: Object.entries(FILTER_LABELS.durations).map(([value, label]) => ({ value: value as StayDuration, label })),
  periods: Object.entries(FILTER_LABELS.periods).map(([value, label]) => ({ value: value as StayPeriod, label })),
  transport: Object.entries(FILTER_LABELS.transport).map(([value, label]) => ({ value: value as StayTransport, label })),
  organizers: ORGANIZERS.map((organizer) => ({ value: organizer.name, label: organizer.name }))
};

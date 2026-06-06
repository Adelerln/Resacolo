import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_STAY_CATALOG_FILTERS,
  applyStayCatalogFilters,
  buildStayCatalogFilterOptions,
  parseStayCatalogFiltersFromSearchParams,
  serializeStayCatalogFiltersToSearchParams
} from '@/lib/stay-catalog-filters';
import type { Stay } from '@/types/stay';

function createStay(input: {
  id: string;
  title: string;
  departureCity: string;
  paymentAids?: Array<'ancv_paper' | 'ancv_connect' | 'caf_vouchers'>;
}): Stay {
  return {
    id: input.id,
    title: input.title,
    slug: input.id,
    canonicalSlug: input.id,
    summary: 'summary',
    description: 'description',
    seasonId: 'season-1',
    seasonName: 'Été',
    organizerId: 'org-1',
    organizer: { name: 'Org', website: 'https://example.org' },
    location: 'France',
    region: 'France',
    country: 'France',
    ageMin: 10,
    ageMax: 13,
    ageRange: '10-13 ans',
    duration: '7 jours',
    priceFrom: 500,
    period: ['ete'],
    categories: ['mer'],
    highlights: [],
    paymentAids: input.paymentAids ?? [],
    filters: {
      categories: ['mer'],
      audiences: ['10-12'],
      durations: ['semaine'],
      periods: ['ete'],
      priceRange: null,
      transport: ['Aller/Retour similaire']
    },
    bookingOptions: {
      transportMode: 'Aller/Retour similaire',
      sessions: [
        {
          id: `session-${input.id}`,
          startDate: '2026-07-01',
          endDate: '2026-07-10',
          price: 500,
          status: 'OPEN',
          transportOptions: [
            {
              id: `transport-${input.id}`,
              departureCity: input.departureCity,
              returnCity: input.departureCity,
              amount: 50
            }
          ]
        }
      ],
      insuranceOptions: [],
      extraOptions: []
    },
    updatedAt: '2026-05-29T00:00:00.000Z'
  };
}

test('buildStayCatalogFilterOptions merges departure city technical variants', () => {
  const stays = [
    createStay({ id: 'stay-1', title: 'Séjour 1', departureCity: 'PARIS' }),
    createStay({ id: 'stay-2', title: 'Séjour 2', departureCity: 'Paris → Paris' })
  ];

  const options = buildStayCatalogFilterOptions(stays);
  assert.equal(options.departureCities.length, 1);
  assert.equal(options.departureCities[0]?.count, 2);
  assert.equal(options.departureCities[0]?.label, 'Paris');
});

test('applyStayCatalogFilters matches stays across departure city variants', () => {
  const stays = [
    createStay({ id: 'stay-1', title: 'Séjour 1', departureCity: 'PARIS' }),
    createStay({ id: 'stay-2', title: 'Séjour 2', departureCity: 'Paris -> Paris' })
  ];

  const options = buildStayCatalogFilterOptions(stays);
  const selectedDeparture = options.departureCities[0]?.value;
  assert.ok(selectedDeparture);

  const filtered = applyStayCatalogFilters(stays, {
    ...EMPTY_STAY_CATALOG_FILTERS,
    departureCities: [selectedDeparture]
  });

  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((stay) => stay.id).sort(),
    ['stay-1', 'stay-2']
  );
});

test('buildStayCatalogFilterOptions counts payment aids', () => {
  const stays = [
    createStay({ id: 'stay-1', title: 'Séjour 1', departureCity: 'PARIS', paymentAids: ['ancv_paper'] }),
    createStay({ id: 'stay-2', title: 'Séjour 2', departureCity: 'Lyon', paymentAids: ['ancv_connect', 'caf_vouchers'] })
  ];
  const options = buildStayCatalogFilterOptions(stays);
  assert.equal(options.paymentAids.length, 3);
});

test('category filters round-trip through URL without expanding partial matches', () => {
  const options = buildStayCatalogFilterOptions([
    {
      ...createStay({ id: 'stay-1', title: 'Séjour mer', departureCity: 'Paris' }),
      categories: ['mer']
    },
    {
      ...createStay({ id: 'stay-2', title: 'Séjour sportif', departureCity: 'Lyon' }),
      categories: ['sportif']
    }
  ]);

  const state = {
    ...EMPTY_STAY_CATALOG_FILTERS,
    categories: ['sportif']
  };
  const params = serializeStayCatalogFiltersToSearchParams(state);
  const parsed = parseStayCatalogFiltersFromSearchParams(params, options);

  assert.deepEqual(parsed.categories, ['sportif']);
});

test('payment aids filters serialize and parse from URL', () => {
  const state = {
    ...EMPTY_STAY_CATALOG_FILTERS,
    paymentAids: ['ancv_connect', 'caf_vouchers'] as Array<'ancv_connect' | 'caf_vouchers'>
  };
  const params = serializeStayCatalogFiltersToSearchParams(state);
  const parsed = parseStayCatalogFiltersFromSearchParams(params, {
    ...buildStayCatalogFilterOptions([]),
    paymentAids: [
      { value: 'ancv_paper', label: 'ANCV', count: 0 },
      { value: 'ancv_connect', label: 'ANCV Connect', count: 0 },
      { value: 'caf_vouchers', label: 'Bons CAF', count: 0 }
    ]
  });
  assert.deepEqual(parsed.paymentAids, ['ancv_connect', 'caf_vouchers']);
});

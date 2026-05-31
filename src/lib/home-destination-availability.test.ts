import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveHomeDestinationAvailability } from '@/lib/home-destination-availability';
import type { Stay } from '@/types/stay';

function createStay(input: Partial<Stay> & { id: string; title: string }): Stay {
  const { id, title, ...rest } = input;
  return {
    ...rest,
    id,
    title,
    slug: id,
    canonicalSlug: id,
    summary: 'summary',
    description: 'description',
    seasonId: 'season-1',
    seasonName: 'Été',
    organizerId: 'org-1',
    organizer: { name: 'Org', website: 'https://example.org' },
    location: input.location ?? '',
    region: input.region ?? '',
    country: input.country ?? '',
    ageMin: 10,
    ageMax: 14,
    ageRange: '10-14 ans',
    duration: '7 jours',
    priceFrom: 1000,
    period: ['ete'],
    categories: [],
    highlights: [],
    filters: {
      categories: [],
      audiences: [],
      durations: [],
      periods: [],
      priceRange: null,
      transport: []
    },
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

test('deriveHomeDestinationAvailability activates france region from legacy region text', () => {
  const stays = [
    createStay({
      id: 'stay-fr',
      title: 'Séjour France',
      destinationType: null,
      destinationRegion: null,
      region: 'Provence-Alpes-Côte d\'Azur'
    })
  ];
  const result = deriveHomeDestinationAvailability(stays);
  assert.ok(result.activeFranceRegionIds.includes('FRPAC'));
  assert.equal(result.hasFranceDestinations, true);
});

test('deriveHomeDestinationAvailability activates foreign country from legacy location text', () => {
  const stays = [
    createStay({
      id: 'stay-abroad',
      title: 'Séjour Ouzbékistan',
      destinationType: null,
      destinationCountry: null,
      region: 'Étranger',
      location: 'Circuit en Ouzbékistan avec étapes à Tachkent.'
    })
  ];
  const result = deriveHomeDestinationAvailability(stays);
  assert.ok(result.activeCountryNames.includes('Ouzbékistan'));
});

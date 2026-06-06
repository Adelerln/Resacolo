import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAccommodationLocationDisplayLabel,
  formatFrenchPlaceName,
  normalizeAccommodationAddress,
  resolveAccommodationLocationMode,
  validateAccommodationFormLocation
} from '@/lib/accommodation-location';

test('formatFrenchPlaceName capitalizes each segment after spaces and hyphens', () => {
  assert.equal(formatFrenchPlaceName('moncoutant-sur-sèvre'), 'Moncoutant-Sur-Sèvre');
  assert.equal(formatFrenchPlaceName('nouvelle-aquitaine'), 'Nouvelle-Aquitaine');
});

test('normalizeAccommodationAddress keeps readable department names', () => {
  const normalized = normalizeAccommodationAddress({
    city: 'Moncoutant-sur-Sèvre',
    departmentCode: 'Deux-Sèvres',
    regionText: 'Nouvelle-Aquitaine',
    country: 'france'
  });

  assert.equal(normalized.city, 'Moncoutant-Sur-Sèvre');
  assert.equal(normalized.departmentCode, 'Deux-Sèvres');
  assert.equal(normalized.regionText, 'Nouvelle-Aquitaine');
  assert.equal(normalized.country, 'France');
});

test('normalizeAccommodationAddress preserves INSEE department codes', () => {
  const normalized = normalizeAccommodationAddress({
    departmentCode: '79'
  });

  assert.equal(normalized.departmentCode, '79');
});

test('resolveAccommodationLocationMode maps mixte to itinerant', () => {
  assert.equal(
    resolveAccommodationLocationMode({ accommodationType: 'mixte' }),
    'itinerant'
  );
  assert.equal(
    resolveAccommodationLocationMode({ accommodationType: 'mixte|centre,camping' }),
    'itinerant'
  );
});

test('validateAccommodationFormLocation enforces itinerant fields', () => {
  assert.equal(
    validateAccommodationFormLocation({
      accommodationType: 'mixte',
      locationMode: 'itinerant',
      itinerantZone: '',
      address: { country: 'Guatemala' }
    }),
    'Renseigne le libellé du circuit pour un hébergement itinérant.'
  );
  assert.equal(
    validateAccommodationFormLocation({
      accommodationType: 'mixte',
      locationMode: 'itinerant',
      itinerantZone: 'Circuit Guatemala',
      address: { country: 'Guatemala' }
    }),
    null
  );
});

test('buildAccommodationLocationDisplayLabel formats itinerant circuits', () => {
  assert.equal(
    buildAccommodationLocationDisplayLabel({
      accommodationType: 'mixte',
      locationMode: 'itinerant',
      itinerantZone: 'Circuit Guatemala',
      country: 'Guatemala'
    }),
    'Circuit Guatemala (Guatemala)'
  );
});

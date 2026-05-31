import assert from 'node:assert/strict';
import test from 'node:test';
import { extractCountryFromText, resolveStayDestination } from '@/lib/stay-destination-resolver';

test('extractCountryFromText detects aliases in long text', () => {
  const country = extractCountryFromText(
    'Circuit en Ouzbékistan avec étapes à Tachkent, Samarkand, Boukhara.'
  );
  assert.equal(country, 'Ouzbékistan');
});

test('resolveStayDestination falls back to abroad from location text', () => {
  const resolved = resolveStayDestination({
    destinationType: null,
    destinationRegion: null,
    destinationCountry: null,
    destinationCountries: [],
    destinationItineraryLabel: null,
    regionText: 'Étranger',
    locationText: 'Tokyo, Japon'
  });

  assert.equal(resolved.destinationType, 'fixed_abroad');
  assert.equal(resolved.destinationCountry, 'Japon');
});

test('resolveStayDestination preserves structured destination priority', () => {
  const resolved = resolveStayDestination({
    destinationType: 'fixed_france',
    destinationRegion: 'Nouvelle-Aquitaine',
    destinationCountry: null,
    destinationCountries: [],
    destinationItineraryLabel: null,
    regionText: null,
    locationText: 'Tokyo, Japon'
  });

  assert.equal(resolved.destinationType, 'fixed_france');
  assert.equal(resolved.destinationRegion, 'Nouvelle-Aquitaine');
  assert.equal(resolved.destinationCountry, 'France');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogCountryOptions,
  extractCatalogCountryLabelsFromStay,
  isCatalogCountryLabel,
  syncKnownSiteCountriesWithRules
} from '@/lib/partner-catalog-countries';
import { getDefaultPartnerCatalogRules } from '@/lib/partner-catalog-rules';

test('isCatalogCountryLabel rejects French regions and departments', () => {
  assert.equal(isCatalogCountryLabel('France'), true);
  assert.equal(isCatalogCountryLabel('Guatemala'), true);
  assert.equal(isCatalogCountryLabel('Normandie'), false);
  assert.equal(isCatalogCountryLabel('Dordogne'), false);
  assert.equal(isCatalogCountryLabel('Le Croisic'), false);
});

test('extractCatalogCountryLabelsFromStay resolves France stays to France only', () => {
  assert.deepEqual(
    extractCatalogCountryLabelsFromStay({
      destination_type: 'fixed_france',
      destination_country: 'Moncoutant',
      destination_city: 'Moncoutant',
      destination_region: 'Nouvelle-Aquitaine'
    }),
    ['France']
  );
});

test('extractCatalogCountryLabelsFromStay ignores city names masquerading as countries', () => {
  const denylist = new Set(['annecy', 'moncoutant', 'villard-de-lans']);
  assert.deepEqual(
    extractCatalogCountryLabelsFromStay(
      {
        destination_type: 'fixed_abroad',
        destination_country: 'Annecy',
        destination_city: 'Annecy'
      },
      denylist
    ),
    []
  );
});

test('extractCatalogCountryLabelsFromStay keeps foreign countries', () => {
  assert.deepEqual(
    extractCatalogCountryLabelsFromStay({
      destination_type: 'itinerant',
      destination_country: 'Guatemala',
      destination_countries: ['Guatemala'],
      destination_itinerary_label: 'Circuit Guatemala'
    }),
    ['Guatemala']
  );
});

test('buildCatalogCountryOptions only exposes cleaned site countries', () => {
  const rules = getDefaultPartnerCatalogRules();
  rules.blockingRules.countriesAllowed = ['Annecy', 'France'];
  rules.meta.knownSiteCountries = ['Annecy', 'Moncoutant', 'France', 'Guatemala'];

  assert.deepEqual(buildCatalogCountryOptions(['France', 'Guatemala', 'Japon'], rules), [
    'France',
    'Guatemala',
    'Japon'
  ]);
});

test('syncKnownSiteCountriesWithRules drops stale commune labels', () => {
  const rules = getDefaultPartnerCatalogRules();
  rules.blockingRules.countriesAllowed = ['Annecy', 'France'];
  rules.blockingRules.countriesExcluded = ['Moncoutant'];
  rules.meta.knownSiteCountries = ['Annecy', 'Moncoutant', 'France', 'Guatemala'];

  const synced = syncKnownSiteCountriesWithRules(rules, ['France', 'Guatemala', 'Japon']);

  assert.deepEqual(synced.meta.knownSiteCountries, ['France', 'Guatemala', 'Japon']);
  assert.deepEqual(synced.blockingRules.countriesAllowed, ['France']);
  assert.deepEqual(synced.blockingRules.countriesExcluded, []);
});

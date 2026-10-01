import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBanMunicipalitySelection } from '@/lib/ban-address';

test('parseBanMunicipalitySelection extracts postal code, department code, region and country', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Moncoutant-sur-Sèvre',
    postcode: '79320',
    context: '79, Deux-Sèvres, Nouvelle-Aquitaine'
  });

  assert.deepEqual(parsed, {
    city: 'Moncoutant-sur-Sèvre',
    postalCode: '79320',
    department: '79',
    region: 'Nouvelle-Aquitaine',
    country: 'France'
  });
});

test('parseBanMunicipalitySelection prefers context department code over truncated depcode', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Pointe-à-Pitre',
    postcode: '97110',
    context: '971, Guadeloupe',
    depcode: '97'
  });

  assert.deepEqual(parsed, {
    city: 'Pointe-à-Pitre',
    postalCode: '97110',
    department: '971',
    region: 'Guadeloupe',
    country: 'France'
  });
});

test('parseBanMunicipalitySelection maps overseas two-part context into region', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Saint-Denis',
    postcode: '97400',
    context: '974, La Réunion',
    depcode: '97'
  });

  assert.equal(parsed?.department, '974');
  assert.equal(parsed?.region, 'La Réunion');
});

test('parseBanMunicipalitySelection keeps Corsica department codes', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Bastia',
    postcode: '20200',
    context: '2B, Haute-Corse, Corse',
    depcode: '2B'
  });

  assert.equal(parsed?.department, '2B');
  assert.equal(parsed?.region, 'Corse');
});

test('parseBanMunicipalitySelection does not treat department name as region', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Campan',
    postcode: '65710',
    context: '65, Hautes-Pyrénées, Occitanie',
    depcode: '65'
  });

  assert.equal(parsed?.department, '65');
  assert.equal(parsed?.region, 'Occitanie');
});

test('parseBanMunicipalitySelection ignores non-canonical department-only region fallback', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Campan',
    postcode: '65710',
    context: '65, Hautes-Pyrénées',
    depcode: '65'
  });

  assert.equal(parsed?.department, '65');
  assert.equal(parsed?.region, null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBanMunicipalitySelection } from '@/lib/ban-address';

test('parseBanMunicipalitySelection extracts postal code, department, region and country', () => {
  const parsed = parseBanMunicipalitySelection({
    city: 'Moncoutant-sur-Sèvre',
    postcode: '79320',
    context: '79, Deux-Sèvres, Nouvelle-Aquitaine'
  });

  assert.deepEqual(parsed, {
    city: 'Moncoutant-sur-Sèvre',
    postalCode: '79320',
    department: 'Deux-Sèvres',
    region: 'Nouvelle-Aquitaine',
    country: 'France'
  });
});

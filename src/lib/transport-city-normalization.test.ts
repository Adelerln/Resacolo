import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalTransportCityKey,
  formatTransportCityLabel,
  normalizeTransportCityRaw
} from '@/lib/transport-city-normalization';

test('canonicalTransportCityKey merges casing and spacing variants', () => {
  assert.equal(canonicalTransportCityKey('Paris'), 'paris');
  assert.equal(canonicalTransportCityKey(' PARIS '), 'paris');
  assert.equal(canonicalTransportCityKey('PaRiS'), 'paris');
});

test('normalizeTransportCityRaw removes repeated arrow chains', () => {
  assert.equal(normalizeTransportCityRaw('Bordeaux → Bordeaux → BORDEAUX'), 'Bordeaux');
  assert.equal(normalizeTransportCityRaw('Bordeaux -> Bordeaux'), 'Bordeaux');
});

test('canonicalTransportCityKey normalizes accents and spaces', () => {
  assert.equal(canonicalTransportCityKey('  Aix-en-Provence  '), 'aix en provence');
  assert.equal(canonicalTransportCityKey('AIX EN PROVENCE'), 'aix en provence');
});

test('normalizeTransportCityRaw removes technical suffixes and parenthetical noise', () => {
  assert.equal(normalizeTransportCityRaw('Paris (75)'), 'Paris');
  assert.equal(normalizeTransportCityRaw('Lyon - Gare Part-Dieu'), 'Lyon');
});

test('accents are ignored for matching but preserved for display', () => {
  assert.equal(canonicalTransportCityKey('Evry'), canonicalTransportCityKey('Évry'));
  assert.equal(formatTransportCityLabel('ÉVRY'), 'Évry');
  assert.equal(formatTransportCityLabel('Aéroport de Lyon'), 'Aéroport de Lyon');
});

test('empty values are ignored cleanly', () => {
  assert.equal(canonicalTransportCityKey(''), '');
  assert.equal(canonicalTransportCityKey(null), '');
  assert.equal(formatTransportCityLabel(undefined), '');
});

test('Champagne-Ardenne TGV variants collapse to one canonical city', () => {
  const left = 'Champagne -Ardennes Tgv';
  const right = 'Champagne Ardenne Tgv';

  assert.equal(canonicalTransportCityKey(left), canonicalTransportCityKey(right));
  assert.equal(canonicalTransportCityKey(left), 'champagne ardenne tgv');
  assert.equal(formatTransportCityLabel(left), 'Champagne-Ardenne TGV');
  assert.equal(formatTransportCityLabel(right), 'Champagne-Ardenne TGV');
});

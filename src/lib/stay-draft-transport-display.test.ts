import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeOnSiteTransportLabel,
  collapseTransportVariantsForDraft,
  isOnSiteTransportLabel
} from '@/lib/stay-draft-transport-display';

test('isOnSiteTransportLabel detects sur place / centre / sans transport', () => {
  assert.equal(isOnSiteTransportLabel('Sur place'), true);
  assert.equal(isOnSiteTransportLabel('Sans transport'), true);
  assert.equal(isOnSiteTransportLabel('Dépose Centre'), true);
  assert.equal(isOnSiteTransportLabel('Reprise Centre'), true);
  assert.equal(isOnSiteTransportLabel('RDV sur place'), true);
  assert.equal(isOnSiteTransportLabel('Paris'), false);
});

test('canonicalizeOnSiteTransportLabel maps variants to canonical labels', () => {
  assert.equal(canonicalizeOnSiteTransportLabel('sans transport'), 'Sur place');
  assert.equal(canonicalizeOnSiteTransportLabel('Rendez-vous sur place'), 'Sur place');
  assert.equal(canonicalizeOnSiteTransportLabel('Dépose sur le centre'), 'Dépose Centre');
  assert.equal(canonicalizeOnSiteTransportLabel('Reprise au centre'), 'Reprise Centre');
  assert.equal(canonicalizeOnSiteTransportLabel('Lyon'), null);
});

test('collapseTransportVariantsForDraft keeps on-site option at 0€', () => {
  const collapsed = collapseTransportVariantsForDraft([
    {
      departure_city: 'Sur place',
      return_city: 'Sur place',
      amount_cents: 0,
      currency: 'EUR',
      pricing_method: 'session_delta',
      confidence: 'high'
    },
    {
      departure_city: 'Paris',
      return_city: 'Paris',
      amount_cents: 8900,
      currency: 'EUR',
      pricing_method: 'session_delta',
      confidence: 'high'
    }
  ]);
  assert.equal(collapsed.length, 2);
  assert.ok(collapsed.some((row) => row.departure_city === 'Sur place' && row.amount_cents === 0));
  assert.ok(collapsed.some((row) => row.departure_city === 'Paris' && row.amount_cents === 8900));
});

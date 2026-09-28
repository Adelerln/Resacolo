import assert from 'node:assert/strict';
import test from 'node:test';
import { findReplacementTransport } from './transport-recovery';

const selection = {
  stayId: 'stay', sessionId: 'session', departureCity: 'Paris', returnCity: 'Paris',
  leg: 'roundtrip' as const
};
const option = {
  id: 'new-id', stay_id: 'stay', session_id: null,
  departure_city: 'PARIS → PARIS', return_city: 'PARIS → PARIS', amount_cents: 19000
};

test('retrouve le transport recréé avec son nouvel identifiant et son tarif serveur', () => {
  assert.equal(findReplacementTransport([option], selection), option);
});

test('ne remplace pas par un autre séjour, une autre session ou une autre ville', () => {
  for (const patch of [
    { stay_id: 'other' }, { session_id: 'other' }, { return_city: 'Lyon' }
  ]) {
    assert.equal(findReplacementTransport([{ ...option, ...patch }], selection), null);
  }
});

test('refuse les correspondances ambiguës et les villes absentes', () => {
  assert.equal(findReplacementTransport([option, { ...option, id: 'duplicate' }], selection), null);
  assert.equal(findReplacementTransport([option], { ...selection, departureCity: null }), null);
  assert.equal(findReplacementTransport([], selection), null);
});

test('résout indépendamment les trajets aller et retour', () => {
  assert.equal(findReplacementTransport([option], {
    ...selection, returnCity: 'Lyon', leg: 'outbound'
  }), option);
  assert.equal(findReplacementTransport([option], {
    ...selection, departureCity: 'Lyon', leg: 'return'
  }), option);
});

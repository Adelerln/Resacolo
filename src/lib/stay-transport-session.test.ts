import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTransportOptionsForSession } from '@/lib/stay-transport-session';

test('filterTransportOptionsForSession returns direct session matches first', () => {
  const options = [
    {
      id: 'global',
      departureCity: 'Paris',
      returnCity: 'Paris',
      amount: 100,
      sessionId: null
    }
  ];
  const filtered = filterTransportOptionsForSession(options, 'session-1', ['session-1']);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'global');
});

test('filterTransportOptionsForSession falls back when session_id are orphaned', () => {
  const options = [
    {
      id: 't1',
      departureCity: 'Sur place',
      returnCity: 'Sur place',
      amount: 0,
      sessionId: 'old-session-a'
    },
    {
      id: 't2',
      departureCity: 'Paris',
      returnCity: 'Paris',
      amount: 100,
      sessionId: 'old-session-b'
    }
  ];

  const filtered = filterTransportOptionsForSession(options, 'new-session-1', [
    'new-session-1',
    'new-session-2'
  ]);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0]?.departureCity, 'Sur place');
  assert.equal(filtered[1]?.departureCity, 'Paris');
});

test('filterTransportOptionsForSession falls back when transport is bound to archived sessions only', () => {
  const options = [
    {
      id: 't1',
      departureCity: 'Sur place',
      returnCity: 'Sur place',
      amount: 0,
      sessionId: 'archived-session'
    },
    {
      id: 't2',
      departureCity: 'Paris',
      returnCity: 'Paris',
      amount: 100,
      sessionId: 'archived-session'
    }
  ];

  const filtered = filterTransportOptionsForSession(
    options,
    'open-session-1',
    ['archived-session', 'open-session-1'],
    ['open-session-1']
  );
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0]?.departureCity, 'Sur place');
  assert.equal(filtered[1]?.departureCity, 'Paris');
});

test('filterTransportOptionsForSession mirrors uniform per-session rows on every bookable session', () => {
  const options = [
    {
      id: 't1-s1',
      departureCity: 'Sur place',
      returnCity: 'Sur place',
      amount: 0,
      sessionId: 'session-1'
    },
    {
      id: 't2-s1',
      departureCity: 'Paris',
      returnCity: 'Paris',
      amount: 100,
      sessionId: 'session-1'
    },
    {
      id: 't1-s2',
      departureCity: 'Sur place',
      returnCity: 'Sur place',
      amount: 0,
      sessionId: 'session-2'
    },
    {
      id: 't2-s2',
      departureCity: 'Paris',
      returnCity: 'Paris',
      amount: 100,
      sessionId: 'session-2'
    }
  ];

  const filtered = filterTransportOptionsForSession(options, 'session-2', ['session-1', 'session-2'], [
    'session-1',
    'session-2'
  ]);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0]?.departureCity, 'Sur place');
  assert.equal(filtered[1]?.departureCity, 'Paris');
});

test('filterTransportOptionsForSession reuses transport when only some sessions have rows in database', () => {
  const options = [
    {
      id: 't1-s1',
      departureCity: 'Sur place',
      returnCity: 'Sur place',
      amount: 0,
      sessionId: 'session-1'
    },
    {
      id: 't2-s1',
      departureCity: 'Paris',
      returnCity: 'Paris',
      amount: 100,
      sessionId: 'session-1'
    }
  ];

  const filtered = filterTransportOptionsForSession(options, 'session-2', ['session-1', 'session-2'], [
    'session-1',
    'session-2'
  ]);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0]?.departureCity, 'Sur place');
  assert.equal(filtered[1]?.departureCity, 'Paris');
});

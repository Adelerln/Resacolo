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

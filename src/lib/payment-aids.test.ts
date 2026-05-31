import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPaymentAidsFromText, normalizePaymentAids } from '@/lib/payment-aids';

test('normalizePaymentAids keeps only known canonical values', () => {
  assert.deepEqual(
    normalizePaymentAids(['ancv_paper', 'foo', 'caf_vouchers', 'ancv_paper']),
    ['ancv_paper', 'caf_vouchers']
  );
});

test('detectPaymentAidsFromText detects ANCV Connect, ANCV and CAF keywords', () => {
  const aids = detectPaymentAidsFromText({
    description: 'Paiement ANCV Connect possible et bons CAF acceptés.',
    programText: 'Nous prenons aussi les chèques vacances.'
  });
  assert.ok(aids.includes('ancv_connect'));
  assert.ok(aids.includes('caf_vouchers'));
});


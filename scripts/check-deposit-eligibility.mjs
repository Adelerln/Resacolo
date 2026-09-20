/**
 * Smoke checks for deposit J-30 rules (no app server required).
 * Run: node scripts/check-deposit-eligibility.mjs
 */
import assert from 'node:assert/strict';

const DEPOSIT_MIN_DAYS_BEFORE_DEPARTURE = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntilIsoDate(isoDate, from = new Date()) {
  if (!isoDate?.trim()) return null;
  const start = new Date(`${isoDate.trim().slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(start.getTime())) return null;
  const fromNoon = new Date(from);
  fromNoon.setHours(12, 0, 0, 0);
  return Math.floor((start.getTime() - fromNoon.getTime()) / MS_PER_DAY);
}

function isAidOrOfflinePaymentMode(paymentMode) {
  return paymentMode === 'CV_PAPER' || paymentMode === 'CV_CONNECT' || paymentMode === 'DEFERRED';
}

function isCardDepositAllowed(input) {
  if (isAidOrOfflinePaymentMode(input.paymentMode)) return true;
  if (input.vacafNumber?.trim()) return true;
  const days = daysUntilIsoDate(input.earliestSessionStartDate, input.from);
  if (days == null) return true;
  return days >= DEPOSIT_MIN_DAYS_BEFORE_DEPARTURE;
}

const from = new Date('2026-06-01T12:00:00Z');
assert.equal(daysUntilIsoDate('2026-07-01', from), 30);
assert.equal(daysUntilIsoDate('2026-06-15', from), 14);
assert.equal(isCardDepositAllowed({ earliestSessionStartDate: '2026-07-01', paymentMode: 'DEPOSIT_200', from }), true);
assert.equal(isCardDepositAllowed({ earliestSessionStartDate: '2026-06-15', paymentMode: 'DEPOSIT_200', from }), false);
assert.equal(isCardDepositAllowed({ earliestSessionStartDate: '2026-06-15', paymentMode: 'CV_CONNECT', from }), true);
assert.equal(
  isCardDepositAllowed({
    earliestSessionStartDate: '2026-06-15',
    paymentMode: 'DEPOSIT_200',
    vacafNumber: '1234567',
    from
  }),
  true
);

console.log('deposit-eligibility checks OK');

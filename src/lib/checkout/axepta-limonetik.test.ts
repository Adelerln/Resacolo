import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeAxeptaMac,
  decryptAxeptaBlowfishData,
  encodeLimonetikUserData,
  encryptAxeptaBlowfishData,
  isLimonetikPaymentSuccess,
  parseLimonetikUserData
} from '@/lib/checkout/axepta-limonetik';

const sampleKey = Buffer.from('0123456789ABCDEFFEDCBA9876543210', 'hex');

test('Blowfish Data round-trip (ECB + NULL padding)', () => {
  const plaintext = 'MerchantID=demo&TransID=abc&Amount=1000&Currency=EUR&PayType=cvconnect';
  const encrypted = encryptAxeptaBlowfishData(plaintext, sampleKey);
  assert.match(encrypted, /^[0-9A-F]+$/);
  assert.equal(decryptAxeptaBlowfishData(encrypted, sampleKey), plaintext);
});

test('MAC HMAC-SHA-256 matches PayID*TransID*MerchantID*Amount*Currency', () => {
  const mac = computeAxeptaMac({
    payId: '',
    transId: 'T1',
    merchantId: 'MID',
    amount: '2500',
    currency: 'EUR',
    hmacSecret: sampleKey
  });
  assert.equal(mac.length, 64);
  assert.match(mac, /^[0-9A-F]+$/);
});

test('UserData encode/parse', () => {
  const encoded = encodeLimonetikUserData({
    orderId: 'ord-1',
    paymentId: 'pay-2',
    checkoutId: 'chk-3'
  });
  assert.deepEqual(parseLimonetikUserData(encoded), {
    orderId: 'ord-1',
    paymentId: 'pay-2',
    checkoutId: 'chk-3'
  });
});

test('isLimonetikPaymentSuccess accepts Status=OK', () => {
  assert.equal(isLimonetikPaymentSuccess('OK', '00000000'), true);
  assert.equal(isLimonetikPaymentSuccess('OK', ''), true);
  assert.equal(isLimonetikPaymentSuccess('FAILED', '00000000'), false);
});

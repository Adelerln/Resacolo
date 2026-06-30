import assert from 'node:assert/strict';
import test from 'node:test';
import { __testables__, resolveCanonicalHostRedirect } from '@/lib/site-host';

const originalCanonicalHost = process.env.CANONICAL_HOST;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalRedirectFlag = process.env.ENABLE_CANONICAL_HOST_REDIRECTS;

test.after(() => {
  process.env.CANONICAL_HOST = originalCanonicalHost;
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  process.env.ENABLE_CANONICAL_HOST_REDIRECTS = originalRedirectFlag;
});

test('resolveCanonicalHostRedirect always normalizes www.resacolo.com', () => {
  delete process.env.ENABLE_CANONICAL_HOST_REDIRECTS;
  assert.equal(resolveCanonicalHostRedirect('www.resacolo.com'), 'resacolo.com');
  assert.equal(resolveCanonicalHostRedirect('WWW.resacolo.com'), 'resacolo.com');
});

test('resolveCanonicalHostRedirect ignores resacolo.vercel.app by default', () => {
  delete process.env.ENABLE_CANONICAL_HOST_REDIRECTS;
  assert.equal(resolveCanonicalHostRedirect('resacolo.vercel.app'), null);
});

test('resolveCanonicalHostRedirect can send resacolo.vercel.app to canonical host when enabled', () => {
  process.env.ENABLE_CANONICAL_HOST_REDIRECTS = '1';
  process.env.CANONICAL_HOST = 'resacolo.com';
  assert.equal(resolveCanonicalHostRedirect('resacolo.vercel.app'), 'resacolo.com');
});

test('resolveCanonicalHostRedirect does not touch preview deployments', () => {
  process.env.ENABLE_CANONICAL_HOST_REDIRECTS = '1';
  process.env.CANONICAL_HOST = 'resacolo.com';
  assert.equal(resolveCanonicalHostRedirect('resacolo-git-feature-abc.vercel.app'), null);
});

test('resolveCanonicalHostRedirect cannot fix www.resacolo.vercel.app at app level', () => {
  delete process.env.ENABLE_CANONICAL_HOST_REDIRECTS;
  assert.equal(resolveCanonicalHostRedirect('www.resacolo.vercel.app'), null);
  assert.equal(__testables__.ALWAYS_REDIRECT_HOSTS['www.resacolo.com'], 'resacolo.com');
});

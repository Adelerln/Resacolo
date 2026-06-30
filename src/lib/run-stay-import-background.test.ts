import assert from 'node:assert/strict';
import test from 'node:test';
import { __testables__ } from '@/lib/run-stay-import-background';

test('getFetchBlockedStatus returns blocked HTTP status', () => {
  assert.equal(__testables__.getFetchBlockedStatus(new Error('Le fetch a échoué (HTTP 403).')), 403);
  assert.equal(__testables__.getFetchBlockedStatus(new Error('Le fetch a échoué (HTTP 429).')), 429);
  assert.equal(__testables__.getFetchBlockedStatus(new Error('Le fetch a échoué (HTTP 500).')), null);
});

test('shouldUseBrowserFallbackAfterFetch detects bot challenge markup', () => {
  assert.equal(
    __testables__.shouldUseBrowserFallbackAfterFetch('<html><title>Just a moment...</title></html>'),
    true
  );
  assert.equal(__testables__.shouldUseBrowserFallbackAfterFetch('<html><body>ok</body></html>'), true);
  assert.equal(
    __testables__.shouldUseBrowserFallbackAfterFetch(
      '<html><body>' + 'contenu '.repeat(80) + '</body></html>'
    ),
    false
  );
});

test('buildBrowserFallbackErrorMessage distinguishes runtime cases', () => {
  assert.equal(
    __testables__.buildBrowserFallbackErrorMessage({
      fetchStatus: 403,
      browserRuntimeStatus: 'unavailable_executable',
      fallbackError: null
    }),
    'Le site source bloque le fetch serveur (HTTP 403). Le fallback navigateur n’est pas disponible en production.'
  );
  assert.equal(
    __testables__.buildBrowserFallbackErrorMessage({
      fetchStatus: 403,
      browserRuntimeStatus: 'navigation_blocked',
      fallbackError: null
    }),
    'Le site source bloque le fetch serveur (HTTP 403). Le site source bloque aussi le navigateur.'
  );
});

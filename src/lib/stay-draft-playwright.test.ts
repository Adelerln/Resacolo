import assert from 'node:assert/strict';
import test from 'node:test';
import { __testables__ } from '@/lib/stay-draft-playwright';

test('classifyBrowserLaunchFailure detects missing executable', () => {
  assert.equal(
    __testables__.classifyBrowserLaunchFailure(
      new Error("browserType.launch: Executable doesn't exist at /tmp/chromium")
    ),
    'unavailable_executable'
  );
});

test('classifyBrowserLaunchFailure detects navigation failures', () => {
  assert.equal(
    __testables__.classifyBrowserLaunchFailure(
      new Error('page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at https://example.com')
    ),
    'navigation_blocked'
  );
});

test('classifyBrowserLaunchFailure falls back to launch_failed', () => {
  assert.equal(
    __testables__.classifyBrowserLaunchFailure(new Error('unknown crash')),
    'launch_failed'
  );
});

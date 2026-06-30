import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isStayImportAlreadyRunning,
  shouldKickOffStayImport
} from '@/lib/stay-import-progress';

test('shouldKickOffStayImport returns true for created step', () => {
  assert.equal(
    shouldKickOffStayImport({
      import_progress: { step: 'created', completed: false }
    }),
    true
  );
});

test('isStayImportAlreadyRunning detects fetching step', () => {
  assert.equal(
    isStayImportAlreadyRunning({
      import_progress: { step: 'fetching', completed: false }
    }),
    true
  );
});

test('isStayImportAlreadyRunning ignores queued step', () => {
  assert.equal(
    isStayImportAlreadyRunning({
      import_progress: { step: 'queued', completed: false }
    }),
    false
  );
});

test('shouldKickOffStayImport relaunches failed imports', () => {
  assert.equal(
    shouldKickOffStayImport({
      import_progress: { step: 'failed', completed: true, error: 'timeout' }
    }),
    true
  );
});

test('shouldKickOffStayImport relaunches completed zigotours imports without dated sessions', () => {
  assert.equal(
    shouldKickOffStayImport(
      {
        import_progress: { step: 'completed', completed: true }
      },
      { datedSessionCount: 0, sourceUrl: 'https://www.zigotours.com/tarifsejour/419' }
    ),
    true
  );
  assert.equal(
    shouldKickOffStayImport(
      {
        import_progress: { step: 'completed', completed: true }
      },
      { datedSessionCount: 2, sourceUrl: 'https://www.zigotours.com/tarifsejour/419' }
    ),
    false
  );
});

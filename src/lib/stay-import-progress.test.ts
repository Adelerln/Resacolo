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

test('shouldKickOffStayImport relaunches failed imports', () => {
  assert.equal(
    shouldKickOffStayImport({
      import_progress: { step: 'failed', completed: true, error: 'timeout' }
    }),
    true
  );
});

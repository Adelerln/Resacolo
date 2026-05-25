import assert from 'node:assert/strict';
import test from 'node:test';
import { __testables__ } from '@/lib/auth/roles';

test('mapStaffRole maps admin historical roles to ADMIN', () => {
  assert.equal(__testables__.mapStaffRole(['ADMIN_RESACOLO']), 'ADMIN');
  assert.equal(__testables__.mapStaffRole(['PLATFORM_ADMIN']), 'ADMIN');
  assert.equal(__testables__.mapStaffRole(['SUPPORT']), 'ADMIN');
});

test('mapStaffRole keeps ADMIN_SALES priority over ADMIN-like', () => {
  assert.equal(__testables__.mapStaffRole(['SALES_ADMIN']), 'ADMIN_SALES');
  assert.equal(__testables__.mapStaffRole(['ADMIN_SALES', 'ADMIN_RESACOLO']), 'ADMIN_SALES');
});

test('mapStaffRole keeps MNEMOS as highest priority', () => {
  assert.equal(__testables__.mapStaffRole(['MNEMOS_SUPPORT']), 'MNEMOS');
  assert.equal(__testables__.mapStaffRole(['MNEMOS_SUPPORT', 'SALES_ADMIN']), 'MNEMOS');
});

test('unknown staff role remains unresolved', () => {
  assert.equal(__testables__.mapStaffRole(['FOO_BAR']), null);
});

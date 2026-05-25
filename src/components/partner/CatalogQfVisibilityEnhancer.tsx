'use client';

import { useEffect } from 'react';

export default function CatalogQfVisibilityEnhancer() {
  useEffect(() => {
    const aidModeSelect = document.querySelector<HTMLSelectElement>('select[name="aid_mode"]');
    const qfBlock = document.getElementById('partner-finance-qf-block') as HTMLDetailsElement | null;
    const percentField = document.getElementById('partner-finance-base-percent');
    const fixedField = document.getElementById('partner-finance-base-fixed');
    if (!aidModeSelect || !qfBlock || !percentField || !fixedField) return;

    const sync = () => {
      const mode = aidModeSelect.value;
      const qfVisible = mode === 'QF_SCALE';
      const percentVisible = mode === 'PERCENT';
      const fixedVisible = mode === 'FIXED';

      qfBlock.classList.toggle('hidden', !qfVisible);
      qfBlock.classList.toggle('border-amber-300', qfVisible);
      qfBlock.classList.toggle('bg-amber-50/60', qfVisible);
      qfBlock.classList.toggle('ring-1', qfVisible);
      qfBlock.classList.toggle('ring-amber-200', qfVisible);
      qfBlock.classList.toggle('shadow-sm', qfVisible);
      qfBlock.classList.toggle('border-slate-200', !qfVisible);
      qfBlock.classList.toggle('bg-white', !qfVisible);
      qfBlock.open = qfVisible;

      percentField.classList.toggle('hidden', !percentVisible);
      fixedField.classList.toggle('hidden', !fixedVisible);
    };

    sync();
    aidModeSelect.addEventListener('change', sync);
    return () => {
      aidModeSelect.removeEventListener('change', sync);
    };
  }, []);

  return null;
}

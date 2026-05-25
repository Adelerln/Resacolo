'use client';

import { useEffect, useRef, useState } from 'react';

function serializeFormData(form: HTMLFormElement) {
  const entries = Array.from(new FormData(form).entries()).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : value.name
  ]);

  entries.sort(([keyA, valueA], [keyB, valueB]) => {
    if (keyA === keyB) return String(valueA).localeCompare(String(valueB), 'fr');
    return keyA.localeCompare(keyB, 'fr');
  });

  return JSON.stringify(entries);
}

export default function UnsavedChangesGuard({
  formId,
  message = 'Vous avez des modifications non enregistrées. Voulez-vous quitter sans enregistrer ?'
}: {
  formId: string;
  message?: string;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);
  const hasUserInteractedRef = useRef(false);
  const skipNextPopRef = useRef(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    initialSnapshotRef.current = serializeFormData(form);
    hasUserInteractedRef.current = false;
    setIsDirty(false);

    const syncDirtyState = () => {
      const initialSnapshot = initialSnapshotRef.current;
      if (!initialSnapshot) return;
      setIsDirty(serializeFormData(form) !== initialSnapshot);
    };

    const handlePotentialUserChange = () => {
      hasUserInteractedRef.current = true;
      syncDirtyState();
    };

    const settleTimeout = window.setTimeout(() => {
      if (!hasUserInteractedRef.current) {
        initialSnapshotRef.current = serializeFormData(form);
        setIsDirty(false);
      }
    }, 400);

    form.addEventListener('input', handlePotentialUserChange);
    form.addEventListener('change', handlePotentialUserChange);
    form.addEventListener('reset', handlePotentialUserChange);

    return () => {
      window.clearTimeout(settleTimeout);
      form.removeEventListener('input', handlePotentialUserChange);
      form.removeEventListener('change', handlePotentialUserChange);
      form.removeEventListener('reset', handlePotentialUserChange);
    };
  }, [formId]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href || href.startsWith('#')) return;
      if (anchor.target === '_blank') return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePopState = () => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        return;
      }
      if (!window.confirm(message)) {
        skipNextPopRef.current = true;
        history.pushState(null, '', window.location.href);
      }
    };

    // Empêche le "Back" de quitter sans confirmation.
    history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty, message]);

  return null;
}


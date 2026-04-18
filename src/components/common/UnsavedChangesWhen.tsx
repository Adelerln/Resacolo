'use client';

import { useEffect, useRef } from 'react';

const DEFAULT_MESSAGE =
  'Vous avez des modifications non enregistrées. Voulez-vous quitter sans enregistrer ?';

/**
 * Alerte navigateur + confirmation sur liens internes + tentative de retour arrière
 * lorsque `when` est vrai (ex. formulaire ou brouillon modifié).
 */
export default function UnsavedChangesWhen({
  when,
  message = DEFAULT_MESSAGE
}: {
  when: boolean;
  message?: string;
}) {
  const skipNextPopRef = useRef(false);

  useEffect(() => {
    if (!when) return;

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

    history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [when, message]);

  return null;
}

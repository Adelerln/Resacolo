'use client';

import { useEffect } from 'react';

type StayTransportCardEffectsProps = {
  formId: string;
  scrollContainerId: string;
  trigger?: string;
};

export default function StayTransportCardEffects({
  formId,
  scrollContainerId,
  trigger
}: StayTransportCardEffectsProps) {
  useEffect(() => {
    if (!trigger) return;

    const frame = window.requestAnimationFrame(() => {
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) {
        form.reset();
      }

      const scrollContainer = document.getElementById(scrollContainerId);
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [formId, scrollContainerId, trigger]);

  return null;
}

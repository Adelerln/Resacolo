'use client';

import { useEffect, useState } from 'react';

type FlashToastProps = {
  message: string;
  variant?: 'success' | 'error';
  /** Query params to strip from the URL after display. */
  clearParams?: string[];
  durationMs?: number;
};

export default function FlashToast({
  message,
  variant = 'success',
  clearParams,
  durationMs
}: FlashToastProps) {
  const [visible, setVisible] = useState(true);
  const [entered, setEntered] = useState(false);
  const paramsToClear =
    clearParams ??
    (variant === 'error'
      ? ['error']
      : ['saved', 'success', 'cancelled', 'coverageSaved', 'access_saved', 'billing_success', 'password_updated']);
  const timeoutMs = durationMs ?? (variant === 'error' ? 6000 : 4000);

  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of paramsToClear) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const enterFrame = window.requestAnimationFrame(() => setEntered(true));
    const timeout = window.setTimeout(() => setVisible(false), timeoutMs);
    return () => {
      window.cancelAnimationFrame(enterFrame);
      window.clearTimeout(timeout);
    };
  }, [paramsToClear, timeoutMs]);

  if (!visible) return null;

  const isSuccess = variant === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-[200] w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)] transition duration-300 ease-out sm:bottom-6 sm:right-6 ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-rose-200 bg-rose-50 text-rose-900'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            isSuccess ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
          aria-hidden
        >
          {isSuccess ? '✓' : '!'}
        </span>
        <p className="min-w-0 flex-1 leading-snug">{message}</p>
      </div>
    </div>
  );
}

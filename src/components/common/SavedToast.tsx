'use client';

import { useEffect, useState } from 'react';

type SavedToastProps = {
  message: string;
};

export default function SavedToast({ message }: SavedToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('saved')) {
      url.searchParams.delete('saved');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
      {message}
    </div>
  );
}

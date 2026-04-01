'use client';

import { useEffect, useState } from 'react';

type ErrorToastProps = {
  message: string;
};

export default function ErrorToast({ message }: ErrorToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('error')) {
      url.searchParams.delete('error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md">
      {message}
    </div>
  );
}

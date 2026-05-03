'use client';

import { useEffect, useRef, useState } from 'react';

type DraftReferenceCopyFieldProps = {
  value: string;
  labelClassName?: string;
  codeClassName?: string;
  buttonClassName?: string;
};

async function copyText(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function DraftReferenceCopyField({
  value,
  labelClassName = 'mt-2 text-xs font-semibold uppercase tracking-wide',
  codeClassName = 'text-slate-900',
  buttonClassName = 'border-slate-300 text-slate-700 hover:bg-slate-100'
}: DraftReferenceCopyFieldProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const resetCopyStateLater = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, 1400);
  };

  const handleCopy = async () => {
    try {
      await copyText(value);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    resetCopyStateLater();
  };

  return (
    <div>
      <p className={labelClassName}>Référence du brouillon</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className={`inline-flex rounded-md bg-white/80 px-2 py-1 font-mono text-xs ${codeClassName}`}>
          {value}
        </p>
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className={`inline-flex min-h-[28px] items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold transition ${buttonClassName}`}
        >
          {copyState === 'copied' ? 'Copié' : copyState === 'error' ? 'Erreur' : 'Copier'}
        </button>
      </div>
    </div>
  );
}

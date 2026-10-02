'use client';

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import {
  sanitizeStayRichText,
  sanitizeStayRichTextFromPaste
} from '@/lib/stay-rich-text';
import { cn } from '@/lib/utils';

type StayRichTextEditorProps = {
  label: string;
  value: string;
  onChange: (nextHtml: string) => void;
  rows?: number;
  className?: string;
  hint?: string;
  required?: boolean;
  hasError?: boolean;
};

const TOOLBAR_ACTIONS = [
  { label: 'G', command: 'bold' as const, title: 'Gras (Ctrl+G)', shortcutKey: 'g' },
  { label: '•', command: 'insertUnorderedList' as const, title: 'Liste à puces', shortcutKey: null }
];

function isModKey(event: KeyboardEvent<HTMLDivElement>) {
  return event.metaKey || event.ctrlKey;
}

export default function StayRichTextEditor({
  label,
  value,
  onChange,
  rows = 6,
  className,
  hint,
  required = false,
  hasError = false
}: StayRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef(sanitizeStayRichText(value));
  const [activeCommands, setActiveCommands] = useState<Record<string, boolean>>({
    bold: false,
    insertUnorderedList: false
  });

  const syncActiveCommands = useCallback(() => {
    setActiveCommands({
      bold: document.queryCommandState('bold'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList')
    });
  }, []);

  const emitChange = useCallback(() => {
    const nextHtml = sanitizeStayRichText(editorRef.current?.innerHTML ?? '');
    if (nextHtml === lastEmittedRef.current) {
      syncActiveCommands();
      return;
    }
    lastEmittedRef.current = nextHtml;
    onChange(nextHtml);
    syncActiveCommands();
  }, [onChange, syncActiveCommands]);

  useEffect(() => {
    const nextHtml = sanitizeStayRichText(value);
    if (!editorRef.current) return;
    if (nextHtml === lastEmittedRef.current && editorRef.current.innerHTML === nextHtml) {
      return;
    }
    // Évite d’écraser la sélection pendant la frappe.
    if (document.activeElement === editorRef.current && nextHtml === lastEmittedRef.current) {
      return;
    }
    if (editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml || '';
    }
    lastEmittedRef.current = nextHtml;
  }, [value]);

  function applyCommand(command: (typeof TOOLBAR_ACTIONS)[number]['command']) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isModKey(event) || event.altKey) return;
    const key = event.key.toLowerCase();
    const action = TOOLBAR_ACTIONS.find((item) => item.shortcutKey === key);
    if (!action) return;
    event.preventDefault();
    applyCommand(action.command);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const cleanHtml = sanitizeStayRichTextFromPaste(
      clipboard.getData('text/html'),
      clipboard.getData('text/plain')
    );
    if (!cleanHtml) return;
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, cleanHtml);
    emitChange();
  }

  const filled = Boolean(sanitizeStayRichText(value).replace(/<[^>]+>/g, '').trim());
  const minHeightClass =
    rows <= 4 ? 'min-h-[7rem]' : rows <= 5 ? 'min-h-[9rem]' : rows <= 6 ? 'min-h-[11rem]' : 'min-h-[13rem]';

  return (
    <label className={cn('block text-sm font-medium text-slate-700', className)}>
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <div
        className={cn(
          'mt-1 overflow-hidden rounded-lg border bg-white',
          hasError
            ? 'border-rose-300 ring-1 ring-rose-200'
            : filled
              ? 'border-slate-300'
              : 'border-slate-200'
        )}
      >
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.command}
              type="button"
              title={action.title}
              aria-label={action.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand(action.command)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-semibold transition',
                activeCommands[action.command]
                  ? 'border-[#6DC7FE] bg-[#6DC7FE] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          suppressHydrationWarning
          onInput={emitChange}
          onBlur={emitChange}
          onKeyDown={handleKeyDown}
          onKeyUp={syncActiveCommands}
          onMouseUp={syncActiveCommands}
          onFocus={syncActiveCommands}
          onPaste={handlePaste}
          data-placeholder={!value.trim() ? ' ' : undefined}
          className={cn(
            minHeightClass,
            'w-full bg-slate-50 px-3 py-3 text-sm font-normal leading-6 text-slate-700 outline-none',
            '[&_b]:font-semibold [&_li]:my-0.5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold',
            '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'
          )}
        />
      </div>
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

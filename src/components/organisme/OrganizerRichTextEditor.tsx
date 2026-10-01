'use client';

import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import {
  sanitizeOrganizerRichText,
  sanitizeOrganizerRichTextFromPaste
} from '@/lib/organizer-rich-text';

type OrganizerRichTextEditorProps = {
  name: string;
  label: string;
  initialValue?: string | null;
};

const TOOLBAR_ACTIONS = [
  { label: 'B', command: 'bold' as const },
  { label: 'I', command: 'italic' as const },
  { label: 'U', command: 'underline' as const },
  { label: '•', command: 'insertUnorderedList' as const, title: 'Liste à puces' }
];

export default function OrganizerRichTextEditor({
  name,
  label,
  initialValue
}: OrganizerRichTextEditorProps) {
  const initialSanitizedValue = sanitizeOrganizerRichText(initialValue);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [htmlValue, setHtmlValue] = useState(initialSanitizedValue);
  const [activeCommands, setActiveCommands] = useState<Record<string, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false
  });

  const syncFromEditor = useCallback(() => {
    const nextHtml = sanitizeOrganizerRichText(editorRef.current?.innerHTML ?? '');
    setHtmlValue((current) => {
      if (current === nextHtml) return current;
      return nextHtml;
    });
    setActiveCommands({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList')
    });
  }, []);

  const clearInheritedInlineFormats = useCallback(() => {
    for (const command of ['bold', 'italic', 'underline'] as const) {
      if (document.queryCommandState(command)) {
        document.execCommand(command, false);
      }
    }
  }, []);

  useEffect(() => {
    const nextHtml = initialSanitizedValue;
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
    setHtmlValue(nextHtml);
  }, [initialSanitizedValue]);

  useEffect(() => {
    if (!hiddenInputRef.current) return;
    hiddenInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    hiddenInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
  }, [htmlValue]);

  useEffect(() => {
    const form = hiddenInputRef.current?.form;
    if (!form) return;

    const handleSubmit = () => {
      syncFromEditor();
    };

    const handleFormData = (event: Event) => {
      if (!(event instanceof FormDataEvent)) return;
      event.formData.set(name, sanitizeOrganizerRichText(editorRef.current?.innerHTML ?? htmlValue));
    };

    form.addEventListener('submit', handleSubmit, true);
    form.addEventListener('formdata', handleFormData);
    return () => {
      form.removeEventListener('submit', handleSubmit, true);
      form.removeEventListener('formdata', handleFormData);
    };
  }, [htmlValue, name, syncFromEditor]);

  function applyCommand(command: (typeof TOOLBAR_ACTIONS)[number]['command']) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncFromEditor();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const cleanHtml = sanitizeOrganizerRichTextFromPaste(
      clipboard.getData('text/html'),
      clipboard.getData('text/plain')
    );
    if (!cleanHtml) return;

    editorRef.current?.focus();
    document.execCommand('insertHTML', false, cleanHtml);
    clearInheritedInlineFormats();
    syncFromEditor();
  }

  return (
    <div className="block text-sm font-medium text-slate-700">
      <div>{label}</div>
      <div className="mt-1 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.command}
              type="button"
              title={'title' in action ? action.title : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand(action.command)}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                activeCommands[action.command]
                  ? 'border-[#6DC7FE] bg-[#6DC7FE] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div
          id={`${name}-editor`}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          suppressHydrationWarning
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          onKeyUp={syncFromEditor}
          onMouseUp={syncFromEditor}
          onFocus={syncFromEditor}
          onPaste={handlePaste}
          className="min-h-[220px] w-full rounded-b-lg bg-slate-100 px-3 py-3 text-sm font-normal leading-6 text-slate-700 outline-none [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
      <input
        ref={hiddenInputRef}
        name={name}
        type="hidden"
        value={htmlValue}
        data-track-dirty="true"
        data-dirty-target={`${name}-editor`}
        aria-hidden="true"
        tabIndex={-1}
        onChange={() => undefined}
      />
    </div>
  );
}

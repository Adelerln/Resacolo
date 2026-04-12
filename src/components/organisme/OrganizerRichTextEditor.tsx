'use client';

import { useEffect, useRef, useState } from 'react';
import { sanitizeOrganizerRichText } from '@/lib/organizer-rich-text';

type OrganizerRichTextEditorProps = {
  name: string;
  label: string;
  initialValue?: string | null;
};

const TOOLBAR_ACTIONS = [
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' }
] as const;

export default function OrganizerRichTextEditor({
  name,
  label,
  initialValue
}: OrganizerRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState(() => sanitizeOrganizerRichText(initialValue));
  const [activeCommands, setActiveCommands] = useState<Record<string, boolean>>({
    bold: false,
    italic: false,
    underline: false
  });

  useEffect(() => {
    const nextHtml = sanitizeOrganizerRichText(initialValue);
    setHtml(nextHtml);
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [initialValue]);

  function syncFromEditor() {
    const nextHtml = sanitizeOrganizerRichText(editorRef.current?.innerHTML ?? '');
    setHtml(nextHtml);
    syncToolbarState();
  }

  function syncToolbarState() {
    setActiveCommands({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline')
    });
  }

  function applyCommand(command: (typeof TOOLBAR_ACTIONS)[number]['command']) {
    editorRef.current?.focus();
    document.execCommand(command, false);
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
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromEditor}
          onKeyUp={() => {
            syncToolbarState();
          }}
          onMouseUp={() => {
            syncToolbarState();
          }}
          onFocus={() => {
            syncToolbarState();
          }}
          className="min-h-[220px] w-full rounded-b-lg bg-slate-100 px-3 py-3 text-sm font-normal leading-6 text-slate-700 outline-none"
        />
      </div>
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

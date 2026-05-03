'use client';

import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const MENU_WIDTH_PX = 288; // tailwind w-72
const MENU_GAP_PX = 8;

type AccommodationLinkedStaysDropdownProps = {
  stayTitles: string[];
};

export default function AccommodationLinkedStaysDropdown({
  stayTitles
}: AccommodationLinkedStaysDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      let left = rect.left;
      if (left + MENU_WIDTH_PX > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - MENU_WIDTH_PX - 8);
      }
      setMenuStyle({
        top: rect.bottom + MENU_GAP_PX,
        left
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const menu =
    open && menuStyle && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        className="fixed z-[100] w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
        style={{ top: menuStyle.top, left: menuStyle.left }}
      >
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {stayTitles.map((title) => (
            <li
              key={title}
              role="option"
              className="rounded-lg px-2.5 py-2 text-xs font-medium leading-snug text-slate-700 hover:bg-slate-50"
            >
              {title}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {stayTitles.length} séjour
        {stayTitles.length > 1 ? 's' : ''}
        <span className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

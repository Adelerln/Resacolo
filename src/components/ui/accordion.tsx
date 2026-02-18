'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccordionType = 'single' | 'multiple';

type AccordionContextValue = {
  type: AccordionType;
  collapsible: boolean;
  openValues: string[];
  toggleValue: (value: string) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const ItemContext = React.createContext<{ value: string } | null>(null);

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: AccordionType;
  collapsible?: boolean;
}

export function Accordion({
  className,
  type = 'single',
  collapsible = false,
  children,
  ...props
}: AccordionProps) {
  const [openValues, setOpenValues] = React.useState<string[]>([]);

  const toggleValue = React.useCallback(
    (value: string) => {
      setOpenValues((previous) => {
        const isOpen = previous.includes(value);
        if (type === 'single') {
          if (isOpen) {
            return collapsible ? [] : previous;
          }
          return [value];
        }
        if (isOpen) {
          return previous.filter((item) => item !== value);
        }
        return [...previous, value];
      });
    },
    [collapsible, type]
  );

  return (
    <AccordionContext.Provider value={{ type, collapsible, openValues, toggleValue }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function AccordionItem({ className, value, children, ...props }: AccordionItemProps) {
  return (
    <ItemContext.Provider value={{ value }}>
      <div className={cn('border-b border-slate-200', className)} {...props}>
        {children}
      </div>
    </ItemContext.Provider>
  );
}

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const accordion = React.useContext(AccordionContext);
    const item = React.useContext(ItemContext);
    if (!accordion || !item) return null;

    const isOpen = accordion.openValues.includes(item.value);

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex w-full items-center justify-between py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-800 transition hover:text-[#3B82F6]',
          className
        )}
        onClick={() => accordion.toggleValue(item.value)}
        aria-expanded={isOpen}
        {...props}
      >
        {children}
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>
    );
  }
);

AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const accordion = React.useContext(AccordionContext);
    const item = React.useContext(ItemContext);
    if (!accordion || !item) return null;

    const isOpen = accordion.openValues.includes(item.value);

    return (
      <div
        ref={ref}
        className={cn(
          'overflow-hidden text-sm text-slate-600 transition-all duration-200',
          isOpen ? 'max-h-96 pb-4 opacity-100' : 'max-h-0 opacity-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AccordionContent.displayName = 'AccordionContent';

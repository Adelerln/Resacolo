'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={routeKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`wipe-${routeKey}`}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: 0.82, ease: [0.25, 0.1, 0.25, 1] }}
          className="pointer-events-none fixed inset-0 z-[140] origin-left bg-white"
        />
      </AnimatePresence>

      <motion.div
        key={`progress-${routeKey}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.82, ease: [0.25, 0.1, 0.25, 1] }}
        className="pointer-events-none fixed inset-x-0 top-0 z-[150] h-1 origin-left bg-gradient-to-r from-brand-400 via-brand-500 to-accent-400"
      />
    </>
  );
}

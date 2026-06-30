'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const WIPE_DURATION = 0.5;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0.985, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0.995, y: -2 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`wipe-${pathname}`}
          initial={{ opacity: 0.08 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: WIPE_DURATION, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-0 z-[140] bg-white"
        />
      </AnimatePresence>

      <motion.div
        key={`progress-${pathname}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, opacity: [1, 1, 0] }}
        transition={{
          scaleX: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: WIPE_DURATION, times: [0, 0.75, 1] }
        }}
        className="pointer-events-none fixed inset-x-0 top-0 z-[150] h-[3px] origin-left bg-gradient-to-r from-brand-400 via-brand-500 to-accent-400"
      />
    </>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const WIPE_DURATION = 0.82;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [barVisible, setBarVisible] = useState(true);
  useEffect(() => {
    setBarVisible(true);
    const t = setTimeout(() => setBarVisible(false), WIPE_DURATION * 1000);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
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
          key={`wipe-${pathname}`}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: WIPE_DURATION, ease: [0.25, 0.1, 0.25, 1] }}
          className="pointer-events-none fixed inset-0 z-[140] origin-left bg-white"
        />
      </AnimatePresence>

      {/* Barre visible pendant la transition, disparaît quand le wipe est terminé */}
      <motion.div
        key={`progress-${pathname}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, opacity: barVisible ? 1 : 0 }}
        transition={{
          scaleX: { duration: 0.2 },
          opacity: { duration: 0.25 }
        }}
        className="pointer-events-none fixed inset-x-0 top-0 z-[150] h-1 origin-left bg-gradient-to-r from-brand-400 via-brand-500 to-accent-400"
      />
    </>
  );
}

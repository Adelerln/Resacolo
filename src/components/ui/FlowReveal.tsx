'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { ReactNode } from 'react';

type FlowRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

export function FlowReveal({ children, className, delay = 0, y = 20 }: FlowRevealProps) {
  return (
    <motion.div
      className={clsx('opacity-0', className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

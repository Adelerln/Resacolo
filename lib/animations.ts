import { type Variants } from "framer-motion";

export const staggerContainer = (stagger: number = 0.12, delay: number = 0) => ({
  hidden: {},
  show: {
    transition: {
      delayChildren: delay,
      staggerChildren: stagger,
    },
  },
});

export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 32,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export const mosaicTileMotion: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.65,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
};

export const hoverTilt = {
  whileHover: {
    rotateX: -4,
    rotateY: 4,
    scale: 1.03,
    transition: { type: "spring", stiffness: 260, damping: 18 },
  },
  whileTap: { scale: 0.97 },
};

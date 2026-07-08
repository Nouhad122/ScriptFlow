import type { Variants } from 'motion/react'

export const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

export const containerVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

// Pair with containerVariants on the parent. No initial/animate needed on the
// item — the parent propagates both.
export const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

export const fadeVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}

export const scaleInVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.72 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.34, 1.2, 0.64, 1] },
  },
}

export const slideFromRightVariants: Variants = {
  hidden:  { x: '100%' },
  visible: { x: 0,      transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } },
  exit:    { x: '100%', transition: { duration: 0.22, ease: 'easeIn' } },
}

export const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
}

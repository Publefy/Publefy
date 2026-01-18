import { useReducedMotion } from "framer-motion";

/**
 * Float animation utility with reduced-motion support
 * Amplitude: 6-10px, Duration: 3.5s-6s
 */
export function useFloatAnimation(
  amplitude: number = 8,
  duration: number = 4.5,
  delay: number = 0
) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return undefined;
  }

  return {
    y: [0, -amplitude, 0],
    transition: {
      duration,
      repeat: Infinity,
      ease: [0.42, 0, 0.58, 1] as const, // easeInOut cubic bezier
      delay,
    },
  };
}

/**
 * Stagger delay calculator for sequential animations
 */
export function getStaggerDelay(index: number, baseDelay: number = 0.1): number {
  return index * baseDelay;
}


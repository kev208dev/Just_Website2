/**
 * Motion tokens shared by GSAP timelines and the WebGL experience.
 * Mirrors the CSS custom properties in styles/tokens.css.
 */
export const duration = {
  micro: 0.2,
  standard: 0.5,
  cinematic: 1.1,
} as const;

export const ease = {
  out: 'expo.out',
  inOut: 'power3.inOut',
  soft: 'power2.out',
} as const;

/** Exponential ease-out, matching cubic-bezier(0.16, 1, 0.3, 1) closely enough for per-frame math. */
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Frame-rate independent exponential damping factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

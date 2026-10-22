/**
 * Motion tokens shared by CSS (see tokens.css) and GSAP.
 *  - micro:     150–250ms  (hover, state changes)
 *  - standard:  350–600ms  (UI reveals, swaps)
 *  - cinematic: 800–1400ms (page / scene transitions)
 */
import type { TransitionDirectionalAnimations } from "astro";

export const DURATION = {
  micro: 0.2,
  standard: 0.48,
  cinematic: 1.1,
} as const;

/** One easing family across the site. */
export const EASE = {
  out: "expo.out",
  inOut: "expo.inOut",
  standard: "power3.out",
  css: "cubic-bezier(0.16, 1, 0.3, 1)",
  cssInOut: "cubic-bezier(0.76, 0, 0.24, 1)",
} as const;

/** Root page transition: the old page lifts away, the new one is unmasked from below. */
export const pageTransition: TransitionDirectionalAnimations = {
  forwards: {
    old: { name: "jt-out", duration: "380ms", easing: EASE.cssInOut, fillMode: "both" },
    new: { name: "jt-in", duration: "820ms", easing: EASE.css, delay: "120ms", fillMode: "both" },
  },
  backwards: {
    old: { name: "jt-out", duration: "380ms", easing: EASE.cssInOut, fillMode: "both" },
    new: { name: "jt-fade-in", duration: "560ms", easing: EASE.css, delay: "80ms", fillMode: "both" },
  },
};

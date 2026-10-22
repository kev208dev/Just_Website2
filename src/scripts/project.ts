import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(ScrollTrigger);

export function initProject() {
  const root = document.querySelector<HTMLElement>('[data-project]');
  if (!root) return;
  // The inline script in the page already flagged html.from-gallery before first paint.
  try {
    sessionStorage.removeItem('just:from-gallery');
  } catch {
    /* storage unavailable */
  }
  if (prefersReducedMotion()) return;

  // The hero key visual sinks slightly as the title band rises over it.
  const hero = root.querySelector<HTMLElement>('[data-project-hero] figure');
  if (hero && matchMedia('(min-aspect-ratio: 1/1)').matches) {
    gsap.to(hero, {
      yPercent: 14,
      ease: 'none',
      scrollTrigger: { trigger: '[data-project-hero]', start: 'top top', end: 'bottom top', scrub: true },
    });
  }
}

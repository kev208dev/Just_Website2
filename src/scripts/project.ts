import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(ScrollTrigger);

const TRANSITION_KEY = 'just:from-gallery';

export function initProject() {
  const root = document.querySelector<HTMLElement>('[data-project]');
  if (!root) return;

  // The inline script in the page already flagged html.from-gallery before first paint.
  try {
    sessionStorage.removeItem(TRANSITION_KEY);
  } catch {
    /* storage unavailable */
  }

  if (prefersReducedMotion()) return;

  const heroImg = root.querySelector<HTMLElement>('[data-project-hero] img');
  if (heroImg) {
    gsap.to(heroImg, {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: { trigger: '[data-project-hero]', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -4, scale: 1.08 },
      {
        yPercent: 4,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

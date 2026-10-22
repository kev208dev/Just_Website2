import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(ScrollTrigger);

/** Boot the hero sculpture once the page is idle, so text paints first. */
function initHeroStage(reduced: boolean) {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
  if (!hero || !stage) return;

  const boot = async () => {
    const { supportsWebGL } = await import('../components/three/ExperienceCanvas');
    if (!supportsWebGL() || new URLSearchParams(location.search).get('mode') === '2d') return;
    try {
      const { LogoStage } = await import('../components/three/brand/LogoStage');
      const host = document.createElement('div');
      host.className = 'hero__canvas';
      host.style.cssText = 'position:absolute;inset:0;opacity:0';
      stage.append(host);
      const logo = new LogoStage(host, { reduced, onReady: () => requestAnimationFrame(() => hero.classList.add('is-live')) });
      (window as unknown as { __justHero?: unknown }).__justHero = logo;
      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => logo.setProgress(self.progress),
      });
    } catch (error) {
      console.error('[JUST] hero 3D failed; keeping the still image.', error);
    }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(() => void boot(), { timeout: 500 });
  else setTimeout(() => void boot(), 40);
}

export function initHome() {
  const reduced = prefersReducedMotion();
  initHeroStage(reduced);

  // Manifesto: obsidian → ivory as it takes over the viewport.
  const manifesto = document.querySelector<HTMLElement>('[data-manifesto]');
  if (manifesto) {
    ScrollTrigger.create({
      trigger: manifesto,
      start: 'top 55%',
      end: 'bottom 30%',
      toggleClass: { targets: manifesto, className: 'is-light' },
    });
  }

  if (reduced) return;

  // Headline drifts up and apart as the sculpture turns away.
  gsap.to('[data-hero-title]', {
    yPercent: -18,
    opacity: 0.2,
    ease: 'none',
    scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Gentle drift of each key visual against its title; the image itself is never cropped.
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((fig) => {
    gsap.fromTo(
      fig,
      { y: 40 },
      {
        y: -40,
        ease: 'none',
        scrollTrigger: { trigger: fig.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });

  document.querySelectorAll<HTMLElement>('.manifesto .ml > span').forEach((line, i) => {
    gsap.from(line, {
      yPercent: 100,
      duration: 1.2,
      ease: 'expo.out',
      delay: i * 0.08,
      scrollTrigger: { trigger: line.parentElement, start: 'top 85%' },
    });
  });
}

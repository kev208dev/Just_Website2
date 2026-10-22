import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(ScrollTrigger);

/** Split a paragraph into word spans, keeping inline <em> emphasis. */
function splitWords(el: HTMLElement) {
  const walk = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').split(/(\s+)/).map((part) => {
        if (!part.trim()) return document.createTextNode(part);
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = part;
        return span;
      });
    }
    if (node instanceof HTMLElement) {
      const clone = node.cloneNode(false) as HTMLElement;
      Array.from(node.childNodes).flatMap(walk).forEach((n) => clone.appendChild(n));
      return [clone];
    }
    return [];
  };
  const parts = Array.from(el.childNodes).flatMap(walk);
  el.replaceChildren(...parts);
  return Array.from(el.querySelectorAll<HTMLElement>('.w'));
}

export function initAbout() {
  const text = document.querySelector<HTMLElement>('[data-words]');
  if (text && !prefersReducedMotion()) {
    const words = splitWords(text);
    ScrollTrigger.create({
      trigger: text,
      start: 'top 80%',
      end: 'bottom 45%',
      scrub: true,
      onUpdate: (self) => {
        const lit = Math.round(self.progress * words.length);
        words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
      },
    });
  }

  // Count-up for the stats once visible.
  if (prefersReducedMotion()) return;
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const textNode = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (!textNode || !Number.isFinite(target)) return;
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: 'expo.out',
          onUpdate: () => (textNode.textContent = Math.round(obj.v).toLocaleString('ko-KR')),
        }),
    });
  });
}

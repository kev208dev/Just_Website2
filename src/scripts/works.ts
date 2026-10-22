import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(Flip);

export function initWorks() {
  const root = document.querySelector<HTMLElement>('[data-works]');
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>('.work-item'));
  const filterBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const viewBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-view-btn]'));
  const preview = root.querySelector<HTMLElement>('[data-list-preview]')!;
  const previewImg = preview.querySelector('img')!;
  const reduced = prefersReducedMotion();
  const targets = () => root.querySelectorAll('.work-item, .work-item__title, .work-item__meta');

  const morph = (change: () => void) => {
    if (reduced) return change();
    const state = Flip.getState(targets());
    change();
    // Make sure revealed media is visible after layout changes.
    root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    Flip.from(state, {
      duration: 0.8,
      ease: 'expo.inOut',
      nested: true,
      absolute: false,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }),
      onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.3 }),
    });
  };

  filterBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter!;
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      morph(() => items.forEach((it) => it.classList.toggle('is-hidden', f !== 'all' && it.dataset.category !== f)));
    }),
  );

  const setView = (view: string) => {
    if (root.dataset.view === view) return;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === view)));
    morph(() => (root.dataset.view = view));
    try {
      localStorage.setItem('just:work-view', view);
    } catch {
      /* ignore */
    }
  };
  viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.viewBtn!)));
  try {
    const saved = localStorage.getItem('just:work-view');
    if (saved === 'list') {
      root.dataset.view = 'list';
      viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === 'list')));
    }
  } catch {
    /* ignore */
  }

  // List view: image preview trails the cursor.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let x = 0;
  let y = 0;
  let px = 0;
  let py = 0;
  let raf = 0;
  const loop = () => {
    px += (x - px) * (reduced ? 1 : 0.16);
    py += (y - py) * (reduced ? 1 : 0.16);
    const tilt = reduced ? 0 : Math.max(Math.min((x - px) * 0.05, 8), -8);
    preview.style.transform = `translate3d(${px + 28}px, ${py - 40}px, 0) translate(0, -50%) rotate(${tilt}deg)`;
    raf = requestAnimationFrame(loop);
  };
  root.addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
  });
  items.forEach((it) => {
    const link = it.querySelector<HTMLAnchorElement>('a')!;
    link.addEventListener('pointerenter', () => {
      if (root.dataset.view !== 'list') return;
      previewImg.src = link.dataset.preview!;
      if (!raf) {
        px = x;
        py = y;
        raf = requestAnimationFrame(loop);
      }
      preview.classList.add('is-on');
    });
    link.addEventListener('pointerleave', () => preview.classList.remove('is-on'));
  });
  root.addEventListener('pointerleave', () => {
    preview.classList.remove('is-on');
    cancelAnimationFrame(raf);
    raf = 0;
  });
}

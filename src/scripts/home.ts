import type { GalleryItem } from '../components/three/GalleryCard3D';
import type { GalleryHandle } from '../components/three/GalleryController';
import { prefersReducedMotion } from '../lib/motion';

const TRANSITION_KEY = 'just:from-gallery';

export function initHome() {
  const root = document.querySelector<HTMLElement>('[data-home]');
  if (!root) return;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const items: GalleryItem[] = JSON.parse(root.querySelector('[data-gallery-items]')!.textContent || '[]');
  const reduced = prefersReducedMotion();

  const hover = root.querySelector<HTMLElement>('[data-hover]')!;
  const hoverTitle = root.querySelector<HTMLElement>('[data-hover-title]')!;
  const hoverCat = root.querySelector<HTMLElement>('[data-hover-cat]')!;
  const activeNum = root.querySelector<HTMLElement>('[data-active-num]')!;
  const activeTitle = root.querySelector<HTMLElement>('[data-active-title]')!;
  const activeLink = root.querySelector<HTMLAnchorElement>('[data-active-link]')!;
  const live = root.querySelector<HTMLElement>('[data-live]')!;
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode]'));
  const indexLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-focus-item]'));
  const transitionTitle = root.querySelector<HTMLElement>('[data-transition-title]')!;
  const transitionCat = root.querySelector<HTMLElement>('[data-transition-cat]')!;
  const hint = root.querySelector<HTMLElement>('[data-hint]')!;

  if (matchMedia('(hover: none)').matches) hint.textContent = 'Swipe to explore';

  const forceFlat = new URLSearchParams(location.search).get('mode') === '2d';

  const fallback = (reason: string) => {
    root.classList.add('is-fallback');
    root.dataset.fallback = reason;
  };

  let gallery: GalleryHandle | null = null;

  const boot = async () => {
    const { supportsWebGL } = await import('../components/three/ExperienceCanvas');
    if (forceFlat) return fallback('requested');
    if (!supportsWebGL()) return fallback('no-webgl');

    try {
      const { createGallery } = await import('../components/three/GalleryController');
      gallery = await createGallery(stage, {
        items,
        reduced,
        wheelTarget: root,
        ui: {
          onReady() {
            root.classList.add('is-ready');
          },
          onActive(item) {
            if (!item) return;
            activeNum.textContent = item.number ?? '';
            activeTitle.textContent = item.title;
            activeLink.href = item.href;
            indexLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.focusItem === item.id));
          },
          onHover(item, x, y) {
            if (!item) {
              hover.classList.remove('is-on');
              return;
            }
            if (hoverTitle.textContent !== item.title) {
              hoverTitle.textContent = item.title;
              hoverCat.textContent = item.category;
            }
            const flip = x > window.innerWidth * 0.62;
            hover.style.transform = `translate3d(${x}px, ${y - 22}px, 0) translateX(${flip ? 'calc(-100% - 112px)' : '0'})`;
            hover.classList.add('is-on');
          },
          onModeChange(mode) {
            modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
            live.textContent = mode === 'rings' ? 'Rings 배치로 전환했습니다.' : 'Spiral 배치로 전환했습니다.';
          },
          onSelect(item) {
            transitionTitle.textContent = item.title;
            transitionCat.textContent = item.category;
            root.classList.add('is-leaving');
            try {
              sessionStorage.setItem(TRANSITION_KEY, item.id);
            } catch {
              /* storage unavailable */
            }
          },
          onReset() {
            root.classList.remove('is-leaving');
          },
        },
      });
    } catch (error) {
      console.error('[JUST] 3D gallery failed, using 2D fallback.', error);
      stage.replaceChildren();
      fallback('error');
    }
  };

  modeButtons.forEach((b) =>
    b.addEventListener('click', () => gallery?.setMode(b.dataset.mode as 'rings' | 'spiral')),
  );

  // Keyboard / list focus rotates the gallery to that work.
  indexLinks.forEach((a) => {
    a.addEventListener('focus', () => gallery?.focusItem(a.dataset.focusItem!));
    a.addEventListener('mouseenter', () => gallery?.focusItem(a.dataset.focusItem!));
    a.addEventListener('blur', () => gallery?.clearFocus());
    a.addEventListener('mouseleave', () => gallery?.clearFocus());
  });

  // Start once the browser is idle so first paint (type, nav) is never blocked.
  const start = () => void boot();
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 600 });
  else setTimeout(start, 60);
}

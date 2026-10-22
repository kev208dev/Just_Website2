import type { GalleryItem } from '../components/three/GalleryCard3D';
import type { GalleryHandle } from '../components/three/GalleryController';
import { prefersReducedMotion } from '../lib/motion';

const TRANSITION_KEY = 'just:from-gallery';

export function initExplore() {
  const root = document.querySelector<HTMLElement>('[data-explore]');
  if (!root) return;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const stage = $('[data-stage]');
  const items: GalleryItem[] = JSON.parse($('[data-gallery-items]').textContent || '[]');
  const reduced = prefersReducedMotion();

  const hover = $('[data-hover]');
  const hoverTitle = $('[data-hover-title]');
  const hoverCat = $('[data-hover-cat]');
  const caption = $('.explore__caption');
  const activeNum = $('[data-active-num]');
  const activeTitle = $('[data-active-title]');
  const activeTag = $('[data-active-tag]');
  const activeLink = $<HTMLAnchorElement>('[data-active-link]');
  const live = $('[data-live]');
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode]'));
  const indexLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-focus-item]'));
  const transitionTitle = $('[data-transition-title]');
  const transitionCat = $('[data-transition-cat]');
  if (matchMedia('(hover: none)').matches) $('[data-hint]').textContent = 'Swipe';

  const fallback = (reason: string) => {
    root.classList.add('is-fallback');
    root.dataset.fallback = reason;
  };

  let gallery: GalleryHandle | null = null;
  let swapTimer = 0;

  const showActive = (item: GalleryItem) => {
    indexLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.focusItem === item.id));
    window.clearTimeout(swapTimer);
    caption.classList.add('is-swap');
    swapTimer = window.setTimeout(
      () => {
        activeNum.textContent = item.number;
        activeTitle.textContent = item.titleEn;
        activeTag.textContent = item.tagline;
        activeLink.href = item.href;
        caption.classList.remove('is-swap');
      },
      reduced ? 0 : 260,
    );
  };

  const boot = async () => {
    const { supportsWebGL } = await import('../components/three/ExperienceCanvas');
    if (new URLSearchParams(location.search).get('mode') === '2d') return fallback('requested');
    if (!supportsWebGL()) return fallback('no-webgl');
    try {
      const { createGallery } = await import('../components/three/GalleryController');
      gallery = await createGallery(stage, {
        items,
        reduced,
        wheelTarget: root,
        ui: {
          onReady: () => root.classList.add('is-ready'),
          onActive: (item) => item && showActive(item),
          onHover(item, x, y) {
            if (!item) return hover.classList.remove('is-on');
            if (hoverTitle.textContent !== item.titleEn) {
              hoverTitle.textContent = item.titleEn;
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
            transitionTitle.textContent = item.titleEn;
            transitionCat.textContent = `${item.number} / ${String(items.length).padStart(2, '0')} — ${item.category}`;
            root.classList.add('is-leaving');
            try {
              sessionStorage.setItem(TRANSITION_KEY, item.id);
            } catch {
              /* storage unavailable */
            }
          },
          onReset: () => root.classList.remove('is-leaving'),
        },
      });
      (window as unknown as { __justGallery?: GalleryHandle }).__justGallery = gallery;
    } catch (error) {
      console.error('[JUST] 3D gallery failed, using 2D fallback.', error);
      stage.replaceChildren();
      fallback('error');
    }
  };

  modeButtons.forEach((b) => b.addEventListener('click', () => gallery?.setMode(b.dataset.mode as 'rings' | 'spiral')));
  indexLinks.forEach((a) => {
    a.addEventListener('focus', () => gallery?.focusItem(a.dataset.focusItem!));
    a.addEventListener('mouseenter', () => gallery?.focusItem(a.dataset.focusItem!));
    a.addEventListener('blur', () => gallery?.clearFocus());
    a.addEventListener('mouseleave', () => gallery?.clearFocus());
  });

  if ('requestIdleCallback' in window) requestIdleCallback(() => void boot(), { timeout: 600 });
  else setTimeout(() => void boot(), 60);
}

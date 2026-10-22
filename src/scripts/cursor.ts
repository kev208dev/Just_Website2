export type CursorState = 'default' | 'link' | 'view' | 'drag' | 'explore';

const LABELS: Record<CursorState, string> = {
  default: '',
  link: '',
  view: 'VIEW',
  drag: 'DRAG',
  explore: 'EXPLORE',
};

let override: { state: CursorState; label?: string } | null = null;

/** Let non-DOM sources (the WebGL gallery) drive the cursor. Pass null to release. */
export function setCursorOverride(state: CursorState | null, label?: string) {
  override = state ? { state, label } : null;
  window.dispatchEvent(new CustomEvent('cursor:update'));
}

export function initCursor() {
  const root = document.querySelector<HTMLElement>('[data-cursor-root]');
  if (!root) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  const ring = root.querySelector<HTMLElement>('.cursor__ring')!;
  const dot = root.querySelector<HTMLElement>('.cursor__dot')!;
  const label = root.querySelector<HTMLElement>('[data-cursor-label]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('has-cursor');
  root.classList.add('is-hidden');

  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  let hoverState: CursorState = 'default';
  let hoverLabel = '';
  let raf = 0;

  const apply = () => {
    const state = override?.state ?? hoverState;
    const text = override ? (override.label ?? LABELS[override.state]) : hoverLabel || LABELS[hoverState];
    if (root.dataset.state !== state) root.dataset.state = state;
    if (label.textContent !== text) label.textContent = text;
  };

  const tick = () => {
    const k = reduced ? 1 : 0.2;
    rx += (x - rx) * k;
    ry += (y - ry) * k;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(tick) : 0;
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      root.classList.remove('is-hidden');
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true },
  );

  document.addEventListener('pointerover', (e) => {
    const target = (e.target as Element | null)?.closest<HTMLElement>('[data-cursor], a, button, [role="button"], label, summary');
    if (!target) {
      hoverState = 'default';
      hoverLabel = '';
    } else {
      const s = (target.dataset.cursor as CursorState | undefined) ?? 'link';
      hoverState = s in LABELS ? s : 'link';
      hoverLabel = target.dataset.cursorLabel ?? '';
    }
    apply();
  });

  document.documentElement.addEventListener('pointerleave', () => root.classList.add('is-hidden'));
  window.addEventListener('cursor:update', apply);
  apply();
}

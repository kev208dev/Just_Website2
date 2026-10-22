import { damp } from '../../lib/motion';

export interface InputCallbacks {
  /** Pointer released without dragging. Coordinates are client pixels. */
  onTap?: (x: number, y: number, pointerType: string) => void;
  onDragChange?: (dragging: boolean) => void;
}

const TAP_DISTANCE = 7;
const TAP_TIME = 550;

/**
 * Wheel, drag and touch input mapped onto a single scalar "scroll" measured in
 * card slots. `current` eases toward `target` (inertia), and `velocity` is the
 * smoothed rate of change used by the distortion shader and the logo.
 */
export class InputController {
  target = 0;
  current = 0;
  velocity = 0;
  /** Normalised pointer, -1..1, y up. */
  readonly pointer = { x: 0, y: 0 };
  readonly client = { x: -1, y: -1, inside: false };
  dragging = false;
  enabled = true;
  /** performance.now() of the last wheel/drag input (used for snapping). */
  lastInput = 0;
  /** Set on every pointer move; the controller clears it after hit-testing. */
  pointerMoved = false;

  private down = false;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private startT = 0;
  private moved = 0;
  private samples: { d: number; t: number }[] = [];
  private pointerId = -1;
  private readonly ac = new AbortController();

  constructor(
    private readonly el: HTMLElement,
    private readonly cb: InputCallbacks = {},
    private readonly reduced = false,
    /** Element that receives wheel input (defaults to `el`); drag and tap always use `el`. */
    wheelTarget: HTMLElement = el,
  ) {
    const opts = { signal: this.ac.signal };
    wheelTarget.addEventListener('wheel', this.onWheel, { ...opts, passive: false });
    el.addEventListener('pointerdown', this.onDown, opts);
    window.addEventListener('pointermove', this.onMove, { ...opts, passive: true });
    window.addEventListener('pointerup', this.onUp, opts);
    window.addEventListener('pointercancel', this.onUp, opts);
    el.addEventListener('pointerleave', () => (this.client.inside = false), opts);
  }

  /** Slots travelled per pixel of drag. */
  private get dragFactor() {
    return 2.6 / Math.max(window.innerWidth, 320);
  }

  nudge(slots: number) {
    this.target = Math.round(this.target) + slots;
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const delta = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    this.target += Math.max(Math.min(delta * 0.0022, 0.9), -0.9);
    this.lastInput = performance.now();
  };

  private onDown = (e: PointerEvent) => {
    if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.down = true;
    this.pointerId = e.pointerId;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.startT = performance.now();
    this.moved = 0;
    this.samples = [];
    this.target = this.current; // catch the gallery where it is
  };

  private onMove = (e: PointerEvent) => {
    const rect = this.el.getBoundingClientRect();
    this.client.x = e.clientX;
    this.client.y = e.clientY;
    this.client.inside =
      e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointerMoved = true;

    if (!this.down || e.pointerId !== this.pointerId || !this.enabled) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.startX, e.clientY - this.startY));

    if (!this.dragging && this.moved > TAP_DISTANCE) {
      this.dragging = true;
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      this.cb.onDragChange?.(true);
    }
    if (!this.dragging) return;

    // Dragging left or up advances the gallery.
    const d = -(dx + dy * 0.8) * this.dragFactor;
    this.target += d;
    this.lastInput = performance.now();
    const t = performance.now();
    this.samples.push({ d, t });
    while (this.samples.length && t - this.samples[0].t > 120) this.samples.shift();
  };

  private onUp = (e: PointerEvent) => {
    if (!this.down || e.pointerId !== this.pointerId) return;
    this.down = false;
    const wasDrag = this.dragging;
    this.dragging = false;

    if (wasDrag) {
      this.cb.onDragChange?.(false);
      // Inertia: carry the release velocity forward.
      const span = this.samples.length > 1 ? this.samples[this.samples.length - 1].t - this.samples[0].t : 0;
      if (span > 0 && !this.reduced) {
        const v = this.samples.reduce((a, s) => a + s.d, 0) / span; // slots per ms
        this.target += Math.max(Math.min(v * 260, 2.5), -2.5);
        this.lastInput = performance.now();
      }
    } else if (this.moved <= TAP_DISTANCE && performance.now() - this.startT < TAP_TIME) {
      this.cb.onTap?.(e.clientX, e.clientY, e.pointerType);
    }
  };

  /** Returns true while the gallery is still travelling. */
  update(dt: number) {
    // After wheel/drag inertia settles, ease onto the nearest work.
    if (!this.dragging && performance.now() - this.lastInput > 260) {
      const snapped = Math.round(this.target);
      if (Math.abs(snapped - this.target) > 1e-4) this.target = snapped;
    }
    const prev = this.current;
    const lambda = this.reduced ? 30 : this.dragging ? 14 : 3.6;
    this.current += (this.target - this.current) * damp(lambda, dt);
    if (Math.abs(this.target - this.current) < 1e-4) this.current = this.target;
    const raw = dt > 0 ? (this.current - prev) / dt : 0;
    this.velocity += (raw - this.velocity) * damp(10, dt);
    if (Math.abs(this.velocity) < 1e-4) this.velocity = 0;
    return this.dragging || this.current !== prev || this.velocity !== 0;
  }

  dispose() {
    this.ac.abort();
  }
}

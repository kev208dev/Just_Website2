import { clamp } from "./utils/math";

export interface InputHandlers {
  /** wheel / trackpad — delta in cards */
  onScroll(deltaCards: number): void;
  onDragStart(): void;
  /** drag — delta in cards since the last event */
  onDrag(deltaCards: number): void;
  /** drag released — velocity in cards per second */
  onDragEnd(velocity: number): void;
  /** a click/tap that did not turn into a drag (NDC coordinates) */
  onTap(x: number, y: number): void;
  /** arrow keys */
  onStep(direction: 1 | -1): void;
  /** Enter / Space while the gallery has focus */
  onActivate(): void;
}

const DRAG_THRESHOLD = 6; // px before a press becomes a drag
const TAP_MAX_MS = 650;

/**
 * Normalises wheel, mouse, pen and touch input for the gallery. Clicks and drags
 * are strictly separated: a press only becomes a drag after moving past a small
 * threshold, and a drag never fires a tap.
 */
export class InputController {
  /** pointer in normalised device coordinates (-1 … 1), y up */
  readonly pointer = { x: 0, y: 0 };
  pointerInside = false;
  pointerMoved = false;
  dragging = false;
  lastInputAt = 0;
  isCoarse = window.matchMedia("(pointer: coarse)").matches;

  private pressed = false;
  private pressId = -1;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private startTime = 0;
  private axis: "x" | "y" | null = null;
  private samples: { t: number; v: number }[] = [];
  private abort = new AbortController();

  constructor(
    private el: HTMLElement,
    private handlers: InputHandlers,
  ) {
    const opts = { signal: this.abort.signal };
    const passiveFalse = { signal: this.abort.signal, passive: false } as AddEventListenerOptions;
    el.addEventListener("wheel", this.onWheel, passiveFalse);
    el.addEventListener("pointerdown", this.onDown, opts);
    window.addEventListener("pointermove", this.onMove, opts);
    window.addEventListener("pointerup", this.onUp, opts);
    window.addEventListener("pointercancel", this.onCancel, opts);
    el.addEventListener("pointerleave", () => (this.pointerInside = false), opts);
    el.addEventListener("pointerenter", () => (this.pointerInside = true), opts);
    el.addEventListener("keydown", this.onKey, opts);
    window.addEventListener("keydown", this.onWindowKey, opts);
  }

  private get pxPerCard() {
    return clamp(window.innerWidth * 0.2, 110, 340);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    let d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    d = clamp(d, -120, 120);
    this.lastInputAt = performance.now();
    this.handlers.onScroll(d * 0.0034);
  };

  private updatePointer(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.pointerMoved = true;
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.pressed) return;
    this.pressed = true;
    this.pressId = e.pointerId;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.startTime = performance.now();
    this.axis = null;
    this.samples = [];
    this.updatePointer(e);
    this.pointerInside = true;
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || this.pressed) {
      this.updatePointer(e);
      // the stage covers the viewport, so pointerenter may never fire — derive it here
      this.pointerInside = this.el.contains(e.target as Node);
    }
    if (!this.pressed || e.pointerId !== this.pressId) return;

    const dxTotal = e.clientX - this.startX;
    const dyTotal = e.clientY - this.startY;
    if (!this.dragging) {
      if (Math.hypot(dxTotal, dyTotal) < DRAG_THRESHOLD) return;
      this.dragging = true;
      // touch: vertical swipes also drive the gallery (there is no page scroll on home)
      this.axis = e.pointerType === "mouse" ? "x" : Math.abs(dxTotal) >= Math.abs(dyTotal) ? "x" : "y";
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* element may have been detached */
      }
      this.handlers.onDragStart();
    }

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const delta = this.axis === "y" ? dy : dx;
    const cards = -delta / this.pxPerCard;
    const now = performance.now();
    this.samples.push({ t: now, v: cards });
    while (this.samples.length && now - this.samples[0].t > 120) this.samples.shift();
    this.lastInputAt = now;
    this.handlers.onDrag(cards);
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pressed || e.pointerId !== this.pressId) return;
    this.pressed = false;
    if (this.dragging) {
      this.dragging = false;
      const now = performance.now();
      const recent = this.samples.filter((s) => now - s.t < 120);
      const sum = recent.reduce((a, s) => a + s.v, 0);
      const span = recent.length > 1 ? (recent[recent.length - 1].t - recent[0].t) / 1000 : 0.016;
      const velocity = clamp(sum / Math.max(span, 0.016), -18, 18);
      this.handlers.onDragEnd(now - (recent[recent.length - 1]?.t ?? 0) > 80 ? 0 : velocity);
      return;
    }
    if (performance.now() - this.startTime <= TAP_MAX_MS) {
      this.updatePointer(e);
      this.handlers.onTap(this.pointer.x, this.pointer.y);
    }
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pressId) return;
    this.pressed = false;
    if (this.dragging) {
      this.dragging = false;
      this.handlers.onDragEnd(0);
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.handlers.onActivate();
    }
  };

  private onWindowKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      this.lastInputAt = performance.now();
      this.handlers.onStep(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      this.lastInputAt = performance.now();
      this.handlers.onStep(-1);
    }
  };

  dispose() {
    this.abort.abort();
  }
}

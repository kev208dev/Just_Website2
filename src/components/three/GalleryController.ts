import gsap from "gsap";
import type { GalleryMode } from "./types";
import { clamp, damp } from "./utils/math";

/**
 * Scroll physics and mode state for the gallery.
 *
 * `target` is where input wants the gallery to be; `offset` follows it with
 * frame-rate independent damping, which produces the inertia. The measured
 * velocity feeds the WebGL distortion and the logo reaction.
 */
export class GalleryController {
  target = 0;
  offset = 0;
  velocity = 0;
  /** smoothed, clamped velocity used for the bend shader */
  bend = 0;
  /** 0 = rings, 1 = spiral */
  morph = 0;
  mode: GalleryMode = "rings";
  locked = false;
  dragging = false;
  private lastInput = 0;
  private morphTween: gsap.core.Tween | null = null;

  constructor(private reducedMotion: boolean) {}

  scrollBy(cards: number) {
    if (this.locked) return;
    this.target += cards;
    this.lastInput = performance.now();
  }

  dragStart() {
    this.dragging = true;
  }

  dragEnd(velocity: number) {
    this.dragging = false;
    if (this.locked) return;
    // flick: carry the release velocity forward
    this.target += velocity * (this.reducedMotion ? 0.05 : 0.22);
    this.lastInput = performance.now();
  }

  step(direction: 1 | -1) {
    if (this.locked) return;
    this.target = Math.round(this.target) + direction;
    this.lastInput = performance.now();
  }

  goTo(index: number, itemCount: number) {
    // shortest path to the requested item
    const current = Math.round(this.target);
    const base = current - (((current % itemCount) + itemCount) % itemCount);
    let next = base + index;
    if (next - current > itemCount / 2) next -= itemCount;
    if (current - next > itemCount / 2) next += itemCount;
    this.target = next;
    this.lastInput = performance.now();
  }

  setMode(mode: GalleryMode, onUpdate?: () => void) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.morphTween?.kill();
    this.morphTween = gsap.to(this, {
      morph: mode === "spiral" ? 1 : 0,
      duration: this.reducedMotion ? 0.01 : 1.4,
      ease: "none", // the gallery applies its own staggered easing per card
      onUpdate,
    });
  }

  update(dt: number) {
    const prev = this.offset;
    const idle = performance.now() - this.lastInput;

    // settle on the nearest card when the user lets go
    if (!this.dragging && idle > 380) {
      const snapped = Math.round(this.target);
      this.target = damp(this.target, snapped, 7, dt);
      if (Math.abs(this.target - snapped) < 0.0005) this.target = snapped;
    }

    const lambda = this.reducedMotion ? 14 : this.dragging ? 12 : 5.2;
    this.offset = damp(this.offset, this.target, lambda, dt);
    this.velocity = (this.offset - prev) / Math.max(dt, 1e-4);

    const bendTarget = this.reducedMotion ? 0 : clamp(this.velocity * 0.085, -0.42, 0.42);
    this.bend = damp(this.bend, bendTarget, 7, dt);
  }

  dispose() {
    this.morphTween?.kill();
  }
}

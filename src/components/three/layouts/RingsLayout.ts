import { Euler, Quaternion, Vector3 } from "three";
import type { CardSlot, CardTransform, GalleryLayout, LayoutContext } from "../types";
import { TAU } from "../utils/math";

export interface RingConfig {
  radius: number;
  y: number;
  /** rotation direction relative to the scroll (+1 / -1) */
  direction: number;
  /** how fast this ring turns per scrolled card */
  speed: number;
  /** angular offset in slot units */
  phase: number;
  /** card scale on this ring */
  scale: number;
  /** tilt of the ring plane around X (radians) */
  tilt: number;
}

/**
 * Concentric orbits around the JUST logo. The middle ring is the "reading" ring:
 * at an integer scroll offset one of its cards sits exactly in front of the logo,
 * and that card defines the active project shown in the UI.
 */
export const DEFAULT_RINGS: RingConfig[] = [
  { radius: 4.7, y: 2.05, direction: -1, speed: 0.72, phase: 0.5, scale: 0.7, tilt: 0.0 },
  { radius: 7.2, y: -0.3, direction: 1, speed: 1, phase: 0, scale: 0.94, tilt: 0.0 },
  { radius: 5.6, y: -2.85, direction: -1, speed: 0.58, phase: 0.33, scale: 0.78, tilt: 0.0 },
];

export const READING_RING = 1;

const _euler = new Euler();
const _tilt = new Quaternion();
const _axisX = new Vector3(1, 0, 0);

export class RingsLayout implements GalleryLayout {
  constructor(public rings: RingConfig[] = DEFAULT_RINGS) {}

  get ringCount() {
    return this.rings.length;
  }

  compute(card: CardSlot, ctx: LayoutContext, out: CardTransform) {
    const ring = this.rings[card.ring % this.rings.length];
    const step = TAU / ctx.itemCount;
    const theta = (card.slot - ctx.offset * ring.direction * ring.speed + ring.phase) * step;

    out.position.set(Math.sin(theta) * ring.radius, 0, Math.cos(theta) * ring.radius);
    // cards face outwards, like frames hung on the inside of a drum
    _euler.set(0, theta, 0);
    out.quaternion.setFromEuler(_euler);

    if (ring.tilt !== 0) {
      _tilt.setFromAxisAngle(_axisX, ring.tilt);
      out.position.applyQuaternion(_tilt);
      out.quaternion.premultiply(_tilt);
    }

    // tiny breathing so the rings never feel frozen
    out.position.y += ring.y + Math.sin(ctx.time * 0.6 + card.index * 1.7) * 0.04;
    out.scale = ring.scale;
    out.opacity = 1;
  }
}

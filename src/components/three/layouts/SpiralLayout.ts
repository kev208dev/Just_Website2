import { Quaternion, Vector3 } from "three";
import type { CardSlot, CardTransform, GalleryLayout, LayoutContext } from "../types";
import { TAU, smoothstep, wrapCentered } from "../utils/math";

export interface SpiralConfig {
  radius: number;
  /** depth travelled per card */
  depthStep: number;
  /** cards per full turn */
  cardsPerTurn: number;
  /** depth of the focus plane (where the active card sits) */
  focusZ: number;
  /** angle of the active card around the axis (radians, 0 = right) */
  focusAngle: number;
  /** how much cards turn towards the axis (funnel effect) */
  inwardTilt: number;
  scale: number;
}

export const DEFAULT_SPIRAL: SpiralConfig = {
  radius: 3.55,
  depthStep: 1.6,
  cardsPerTurn: 7,
  focusZ: 4.8,
  focusAngle: -0.45,
  inwardTilt: 0.34,
  scale: 0.92,
};

/** Narrow portrait screens: the focus card sits below the logo instead of beside it. */
export const COMPACT_SPIRAL: SpiralConfig = {
  ...DEFAULT_SPIRAL,
  radius: 3.05,
  focusZ: 4.1,
  focusAngle: -Math.PI * 0.5 + 0.18,
  inwardTilt: 0.3,
};

const _normal = new Vector3();
const _forward = new Vector3(0, 0, 1);

/**
 * A vortex of cards spiralling along the view axis. Scrolling pulls the spiral
 * towards the viewer, so the user travels through the projects while the JUST logo
 * stays visible in the open centre of the spiral.
 */
export class SpiralLayout implements GalleryLayout {
  /** camera z, used to fade cards that are about to pass the viewer */
  cameraZ = 15;

  constructor(public config: SpiralConfig = DEFAULT_SPIRAL) {}

  compute(card: CardSlot, ctx: LayoutContext, out: CardTransform) {
    const c = this.config;
    const u = wrapCentered(card.index - ctx.offset, ctx.cardCount);
    const phi = c.focusAngle + (u * TAU) / c.cardsPerTurn;
    const z = c.focusZ - u * c.depthStep;

    out.position.set(Math.cos(phi) * c.radius, Math.sin(phi) * c.radius, z);

    // face the viewer, leaning towards the axis to form a funnel
    _normal.set(-Math.cos(phi) * c.inwardTilt, -Math.sin(phi) * c.inwardTilt, 1).normalize();
    out.quaternion.setFromUnitVectors(_forward, _normal);
    // gentle roll following the spiral direction
    const roll = Math.sin(phi) * 0.06;
    out.quaternion.multiply(_roll.setFromAxisAngle(_forward, roll));

    out.scale = c.scale;

    // cards dissolve once they fly past the focus plane, and never reach the lens
    const passFade = smoothstep(-1.15, -0.2, u);
    const nearFade = passFade * (1 - smoothstep(this.cameraZ - 5.5, this.cameraZ - 2.5, z));
    const seamFade = 1 - smoothstep(ctx.cardCount * 0.5 - 2.2, ctx.cardCount * 0.5 - 0.4, Math.abs(u));
    out.opacity = nearFade * seamFade;
  }
}

const _roll = new Quaternion();

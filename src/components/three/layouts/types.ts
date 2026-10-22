import { Quaternion, Vector3 } from 'three';

export type GalleryMode = 'rings' | 'spiral';

export interface CardPose {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  /** 0 = hidden (wrap seams, behind camera), 1 = fully visible. */
  visibility: number;
}

export interface CameraPose {
  position: Vector3;
  target: Vector3;
  fov: number;
  fogNear: number;
  fogFar: number;
}

export interface LayoutViewport {
  aspect: number;
  count: number;
}

export interface GalleryLayout {
  readonly mode: GalleryMode;
  readonly camera: CameraPose;
  configure(viewport: LayoutViewport): void;
  pose(index: number, scroll: number, out: CardPose): CardPose;
  /** Scroll value (closest to `from`) that brings card `index` to the front. */
  focusScroll(index: number, from: number): number;
}

export const createPose = (): CardPose => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  scale: 1,
  visibility: 1,
});

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Nearest value to `from` of the form base + k * period. */
export const nearestPeriodic = (base: number, period: number, from: number) =>
  base + Math.round((from - base) / period) * period;

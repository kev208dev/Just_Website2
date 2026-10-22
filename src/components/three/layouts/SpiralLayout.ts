import { Euler, Quaternion, Vector3 } from 'three';
import {
  nearestPeriodic,
  smoothstep,
  type CameraPose,
  type CardPose,
  type GalleryLayout,
  type LayoutViewport,
} from './types';

const euler = new Euler();
const local = new Quaternion();

/**
 * Works climb a helix: the current one faces the viewer, neighbours wind up
 * and back around the axis. Only a window around the focus is shown, so the
 * loop seam is never visible — with any number of works, no duplicates.
 */
export class SpiralLayout implements GalleryLayout {
  readonly mode = 'spiral' as const;
  readonly camera: CameraPose = {
    position: new Vector3(2.4, 0.4, 11.5),
    target: new Vector3(0, 0, 0),
    fov: 34,
    fogNear: 10,
    fogFar: 18,
  };

  count = 5;
  radius = 3.6;
  angleStep = 0.95;
  rise = 1.55;
  cardScale = 0.92;
  private tilt = new Quaternion().setFromEuler(new Euler(0.06, 0, -0.1));

  configure({ aspect, count }: LayoutViewport) {
    const portrait = aspect < 0.85;
    this.count = count;
    this.radius = portrait ? 2.6 : 3.6;
    this.rise = portrait ? 1.7 : 1.55;
    this.cardScale = portrait ? 0.74 : 0.92;
    this.camera.position.set(portrait ? 0.8 : 0.6, 0.6, portrait ? 16 : 13.5);
    this.camera.target.set(portrait ? 0 : -1.5, 0, 0);
    this.camera.fov = portrait ? 46 : 34;
  }

  /** Signed distance (in works) from the focused slot, wrapped to [-n/2, n/2). */
  private offset(index: number, scroll: number) {
    const n = this.count;
    return ((((index - scroll) % n) + n * 1.5) % n) - n / 2;
  }

  pose(index: number, scroll: number, out: CardPose) {
    const d = this.offset(index, scroll);
    const a = d * this.angleStep;
    out.position.set(Math.sin(a) * this.radius, d * this.rise, Math.cos(a) * this.radius).applyQuaternion(this.tilt);
    euler.set(0, a, 0);
    local.setFromEuler(euler);
    out.quaternion.copy(this.tilt).multiply(local);
    out.scale = this.cardScale * (1 - Math.min(Math.abs(d), 2.5) * 0.06);
    const edge = this.count / 2;
    out.visibility = smoothstep(edge, edge - 0.9, Math.abs(d));
    return out;
  }

  focusScroll(index: number, from: number) {
    return nearestPeriodic(index, this.count, from);
  }
}

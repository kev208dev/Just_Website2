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
 * Cards along a tilted vertical helix seen from outside. Scrolling feeds cards
 * up the spiral; they enter and leave at the ends with a fade so the wrap is
 * never visible.
 */
export class SpiralLayout implements GalleryLayout {
  readonly mode = 'spiral' as const;
  readonly camera: CameraPose = {
    position: new Vector3(0, 0, 13.5),
    target: new Vector3(0, 0, 0),
    fov: 44,
    fogNear: 12,
    fogFar: 24,
  };

  count = 36;
  perTurn = 10;
  radius = 4.7;
  pitch = 0.36;
  cardScale = 0.86;
  private tilt = new Quaternion().setFromEuler(new Euler(0.1, 0, -0.16));

  configure({ aspect, count }: LayoutViewport) {
    const portrait = aspect < 0.85;
    this.count = count;
    this.radius = portrait ? 3.4 : 4.7;
    this.pitch = portrait ? 0.42 : 0.36;
    this.cardScale = portrait ? 0.72 : 0.86;
    this.camera.position.set(0, 0, portrait ? 15.5 : 13.5);
    this.camera.fov = portrait ? 58 : 44;
    this.tilt.setFromEuler(new Euler(0.1, 0, portrait ? -0.08 : -0.16));
  }

  private param(index: number, scroll: number) {
    const n = this.count;
    return (((index + scroll) % n) + n) % n;
  }

  pose(index: number, scroll: number, out: CardPose) {
    const u = this.param(index, scroll);
    const mid = this.count / 2;
    // Phase-shifted by half a turn: the card level with the logo sits behind it,
    // so front-facing cards frame the logo above and below instead of covering it.
    const a = ((u - mid) / this.perTurn) * Math.PI * 2 + Math.PI;
    const y = (u - mid) * this.pitch;

    out.position.set(Math.sin(a) * this.radius, y, Math.cos(a) * this.radius).applyQuaternion(this.tilt);
    euler.set(0, a, 0);
    local.setFromEuler(euler);
    out.quaternion.copy(this.tilt).multiply(local);
    out.scale = this.cardScale;
    out.visibility = smoothstep(0, 3, u) * smoothstep(this.count, this.count - 3, u);
    return out;
  }

  focusScroll(index: number, from: number) {
    return nearestPeriodic(this.count / 2 + this.perTurn / 2 - index, this.count, from);
  }
}

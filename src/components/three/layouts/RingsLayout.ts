import { Euler, Vector3 } from 'three';
import {
  nearestPeriodic,
  smoothstep,
  type CameraPose,
  type CardPose,
  type GalleryLayout,
  type LayoutViewport,
} from './types';

const euler = new Euler();

/**
 * Cards on stacked horizontal rings around the logo. The camera sits inside
 * the cylinder, so nearby cards sweep past large while far ones sit behind
 * the logo — the K95-style "orbit" read.
 */
export class RingsLayout implements GalleryLayout {
  readonly mode = 'rings' as const;
  readonly camera: CameraPose = {
    position: new Vector3(0, 0, 4.2),
    target: new Vector3(0, 0, -3),
    fov: 52,
    fogNear: 9,
    fogFar: 21,
  };

  rows = 3;
  perRing = 12;
  radius = 7.5;
  rowGap = 2.05;
  cardScale = 1;
  /** Each ring turns at a slightly different rate for parallax. */
  private speeds = [1, 0.86, 1.14, 0.94];

  configure({ aspect, count }: LayoutViewport) {
    const portrait = aspect < 0.85;
    this.rows = portrait ? 4 : 3;
    this.perRing = Math.ceil(count / this.rows);
    this.radius = portrait ? 6.2 : 7.5;
    this.cardScale = portrait ? 0.82 : 1;
    this.rowGap = portrait ? 1.75 : 2.05;
    this.camera.position.set(0, 0, portrait ? 3.4 : 4.2);
    this.camera.fov = portrait ? 66 : 52;
    this.camera.fogNear = portrait ? 7 : 9;
    this.camera.fogFar = portrait ? 18 : 21;
  }

  private slot(index: number) {
    const row = index % this.rows;
    const column = Math.floor(index / this.rows);
    const offset = row % 2 === 1 ? 0.5 : 0;
    return { row, column, offset, speed: this.speeds[row % this.speeds.length] };
  }

  pose(index: number, scroll: number, out: CardPose) {
    const { row, column, offset, speed } = this.slot(index);
    const step = (Math.PI * 2) / this.perRing;
    const theta = (column + offset - scroll * speed) * step;
    const y = (row - (this.rows - 1) / 2) * this.rowGap;

    out.position.set(Math.sin(theta) * this.radius, y, -Math.cos(theta) * this.radius);
    // Face the cylinder axis, with a slight tilt toward the camera for outer rows.
    euler.set(-y * 0.035, -theta, 0, 'YXZ');
    out.quaternion.setFromEuler(euler);
    out.scale = this.cardScale;
    out.visibility = smoothstep(-0.3, 0.12, Math.cos(theta));
    return out;
  }

  focusScroll(index: number, from: number) {
    const { column, offset, speed } = this.slot(index);
    return nearestPeriodic((column + offset) / speed, this.perRing / speed, from);
  }
}

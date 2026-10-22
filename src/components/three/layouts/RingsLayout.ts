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
 * One card per work on a single orbit around the logo, seen from slightly
 * above. The ring's radius follows the number of works, so adding a project
 * widens the orbit instead of duplicating cards.
 */
export class RingsLayout implements GalleryLayout {
  readonly mode = 'rings' as const;
  readonly camera: CameraPose = {
    position: new Vector3(-1.6, 3.1, 11.5),
    target: new Vector3(-1.6, 0.35, 0),
    fov: 36,
    fogNear: 9,
    fogFar: 17,
  };

  count = 5;
  radius = 4.3;
  cardScale = 1;
  /** Faint concentric orbits drawn around the ring (radius, tilt). */
  readonly orbits: { radius: number; tilt: number; y: number }[] = [];

  configure({ aspect, count }: LayoutViewport) {
    const portrait = aspect < 0.85;
    this.count = count;
    // Keep roughly constant arc spacing between neighbours.
    this.radius = Math.max(3.8, (count * 3.4) / (Math.PI * 2)) * (portrait ? 0.72 : 1);
    this.cardScale = portrait ? 0.74 : 1;
    // Desktop: the orbit sits right of the caption (a lateral camera move keeps the zoom maths exact).
    const shift = portrait ? 0 : -1.5;
    this.camera.position.set(shift, portrait ? 3.4 : 3.2, portrait ? 15.5 : 14);
    this.camera.target.set(shift, portrait ? 0.4 : -0.35, 0);
    this.camera.fov = portrait ? 50 : 34;
    this.orbits.length = 0;
    this.orbits.push(
      { radius: this.radius, tilt: 0, y: -0.55 - 0.95 * this.cardScale },
      { radius: this.radius * 1.55, tilt: 0.05, y: -0.4 },
      { radius: this.radius * 2.3, tilt: -0.03, y: 0.2 },
    );
  }

  pose(index: number, scroll: number, out: CardPose) {
    const step = (Math.PI * 2) / this.count;
    const theta = (index - scroll) * step;
    out.position.set(Math.sin(theta) * this.radius, -0.55, Math.cos(theta) * this.radius);
    // Face outward (towards the camera when in front), with a slight lean back.
    euler.set(-0.04, theta, 0, 'YXZ');
    out.quaternion.setFromEuler(euler);
    out.scale = this.cardScale;
    // Cards behind the logo recede into the fog but stay faintly present.
    out.visibility = 0.35 + 0.65 * smoothstep(-0.6, 0.6, Math.cos(theta));
    return out;
  }

  focusScroll(index: number, from: number) {
    return nearestPeriodic(index, this.count, from);
  }
}

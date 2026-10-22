import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { CameraPose } from './layouts/types';
import { damp } from '../../lib/motion';

const pos = new Vector3();
const target = new Vector3();

/**
 * Blends the camera between layout presets (driven by the morph value) and
 * layers a gentle pointer parallax on top.
 */
export class CameraController {
  private parallax = { x: 0, y: 0 };
  fogNear = 10;
  fogFar = 22;

  constructor(readonly camera: PerspectiveCamera) {}

  /** Returns true while the camera is still easing (pointer parallax). */
  update(dt: number, from: CameraPose, to: CameraPose, t: number, pointer: { x: number; y: number }, reduced: boolean) {
    const strength = reduced ? 0 : 1;
    const px = pointer.x * strength - this.parallax.x;
    const py = pointer.y * strength - this.parallax.y;
    this.parallax.x += px * damp(3, dt);
    this.parallax.y += py * damp(3, dt);
    const moving = Math.abs(px) + Math.abs(py) > 0.002;

    // Arc the camera slightly upward mid-morph so the transition reads as a move, not a cut.
    const lift = Math.sin(t * Math.PI) * 1.4;
    pos.lerpVectors(from.position, to.position, t);
    pos.x += this.parallax.x * 0.35;
    pos.y += this.parallax.y * 0.2 + lift;
    target.lerpVectors(from.target, to.target, t);
    target.y += lift * 0.4;

    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    const fov = MathUtils.lerp(from.fov, to.fov, t);
    if (Math.abs(this.camera.fov - fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.fogNear = MathUtils.lerp(from.fogNear, to.fogNear, t);
    this.fogFar = MathUtils.lerp(from.fogFar, to.fogFar, t);
    return moving;
  }

  /** World-space size of the view frustum at `distance` in front of the camera. */
  viewSizeAt(distance: number) {
    const h = 2 * Math.tan(MathUtils.degToRad(this.camera.fov) / 2) * distance;
    return { width: h * this.camera.aspect, height: h };
  }
}

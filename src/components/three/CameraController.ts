import { PerspectiveCamera, Vector3 } from "three";
import { clamp, damp, easeInOutCubic } from "./utils/math";

export interface CameraFrame {
  dt: number;
  morph: number;
  pointer: { x: number; y: number };
  reducedMotion: boolean;
  /** extra push-in (0 … 1) used while a project is opening */
  focus: number;
}

/**
 * Perspective camera with two framings — an elevated orbit view for Rings and an
 * axial view down the vortex for Spiral — blended by the morph value, plus a
 * damped pointer parallax. Framing adapts to the viewport.
 */
export class CameraController {
  readonly camera = new PerspectiveCamera(30, 1, 0.1, 120);
  /** uniform scale applied to the whole scene on narrow screens */
  layoutScale = 1;
  compact = false;

  private ringsPos = new Vector3(0, 3.3, 18.5);
  private ringsTarget = new Vector3(0, -0.2, 0);
  private spiralPos = new Vector3(0, 0.25, 15);
  private spiralTarget = new Vector3(0, 0, -3);
  private parallax = { x: 0, y: 0 };
  private pos = new Vector3();
  private target = new Vector3();

  setViewport(width: number, height: number) {
    const aspect = width / Math.max(height, 1);
    this.camera.aspect = aspect;
    this.compact = aspect < 0.9 || width < 720;

    if (this.compact) {
      // portrait phones: wider lens, smaller scene, cards may overflow the sides (swipe carousel)
      this.camera.fov = 46;
      this.layoutScale = clamp(0.62 + aspect * 0.3, 0.74, 0.92);
      this.ringsPos.set(0, 3.0, 17.5);
      this.ringsTarget.set(0, -0.35, 0);
      this.spiralPos.set(0, 0.2, 15.5);
    } else {
      this.camera.fov = 30;
      this.layoutScale = 1;
      // fit the reading ring (radius 7.2 + half a card) to the viewport width
      const halfH = Math.tan((this.camera.fov * Math.PI) / 360);
      const fitDistance = (8.4 / (halfH * aspect)) * 0.98;
      const d = clamp(fitDistance, 16.5, 25);
      this.ringsPos.set(0, 3.3 * (d / 18.5), d);
      this.ringsTarget.set(0, 0.05, 0);
      this.spiralPos.set(0, 0.25, clamp(d * 0.82, 14.5, 19));
    }
    this.camera.updateProjectionMatrix();
  }

  /** Camera z in scene-local units (the scene root is scaled by layoutScale). */
  get localZ() {
    return this.camera.position.z / this.layoutScale;
  }

  update(f: CameraFrame) {
    const m = easeInOutCubic(clamp(f.morph, 0, 1));
    const rm = f.reducedMotion;
    this.parallax.x = damp(this.parallax.x, rm ? 0 : f.pointer.x, 2.4, f.dt);
    this.parallax.y = damp(this.parallax.y, rm ? 0 : f.pointer.y, 2.4, f.dt);

    this.pos.lerpVectors(this.ringsPos, this.spiralPos, m);
    this.target.lerpVectors(this.ringsTarget, this.spiralTarget, m);

    // a slight arc during the morph so the move feels like a camera move, not a zoom
    this.pos.x += Math.sin(m * Math.PI) * 2.4;
    this.pos.y += Math.sin(m * Math.PI) * 1.2;

    const px = this.compact ? 0.25 : 0.7;
    const py = this.compact ? 0.15 : 0.4;
    this.pos.x += this.parallax.x * px;
    this.pos.y += this.parallax.y * py;

    // push in a little while a project opens
    this.pos.lerp(this.target, f.focus * 0.08);

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.target);
  }
}

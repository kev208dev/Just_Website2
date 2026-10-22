import { Group, Mesh } from 'three';
import { createLogoGeometry, createLogoMaterials, LOGO_ASPECT } from './brand/LogoAsset';
import { damp } from '../../lib/motion';

/**
 * The JUST wordmark at the centre of the universe: same dark brushed chrome
 * and bronze bevels as the home hero, lit by the shared studio environment.
 */
export class JustLogo3D {
  readonly group = new Group();
  private readonly pivot = new Group();
  private readonly mesh: Mesh;
  private readonly materials = createLogoMaterials();
  private tiltX = 0;
  private tiltY = 0;
  private spin = 0;
  fade = 1;
  appear = 0;

  constructor(width = 3.1) {
    const geometry = createLogoGeometry(0.34);
    this.mesh = new Mesh(geometry, [...this.materials.list]);
    this.mesh.scale.setScalar(width / LOGO_ASPECT);
    this.pivot.add(this.mesh);
    this.group.add(this.pivot);
  }

  /** Returns true while it is visibly moving. */
  update(dt: number, time: number, pointer: { x: number; y: number }, velocity: number, reduced: boolean) {
    const idle = reduced ? 0 : Math.sin(time * 0.3) * 0.12;
    this.spin += (velocity * 0.05 - this.spin) * damp(3, dt);
    this.tiltX += (-pointer.y * 0.08 - this.tiltX) * damp(3, dt);
    this.tiltY += (pointer.x * 0.16 - this.tiltY) * damp(3, dt);
    this.pivot.rotation.set(this.tiltX, -0.25 + idle + this.tiltY + this.spin, 0);

    const vis = this.fade * this.appear;
    this.group.visible = vis > 0.01;
    this.group.scale.setScalar(0.85 + 0.15 * vis);
    const transparent = vis < 0.999;
    for (const m of this.materials.list) {
      m.transparent = transparent;
      m.opacity = vis;
    }
    return Math.abs(this.spin) > 0.0005;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.materials.list.forEach((m) => m.dispose());
  }
}

import { Mesh, PlaneGeometry, Quaternion, Vector3, type Texture } from 'three';
import { DistortionMaterial, type SharedUniforms } from './materials/DistortionMaterial';
import { createPose, type CardPose } from './layouts/types';
import { damp } from '../../lib/motion';

export interface GalleryItem {
  id: string;
  title: string;
  titleEn: string;
  category: string;
  tagline: string;
  year?: number;
  href: string;
  aspect: number;
  /** Project number among selected works, e.g. "03". */
  number: string;
  image: string;
}

/** Card height in world units; width follows the item aspect (clamped). */
export const CARD_HEIGHT = 1.7;

const geometry = new PlaneGeometry(1, 1, 24, 1);
const tmpV = new Vector3();
const tmpQ = new Quaternion();

/**
 * One card in the gallery. Pose comes from the active layout(s); the card adds
 * hover lift and an optional "focus" override used for the click transition.
 */
export class GalleryCard3D {
  readonly mesh: Mesh<PlaneGeometry, DistortionMaterial>;
  readonly base = createPose();
  readonly width: number;
  hover = 0;
  hoverTarget = 0;
  /** 0..1 blend toward `focusPose` (click transition). */
  focus = 0;
  readonly focusPose = { position: new Vector3(), quaternion: new Quaternion(), sx: 1, sy: 1 };
  /** Multiplied into opacity — used to fade everything but the selected card. */
  fade = 1;
  appear = 0;

  constructor(
    readonly item: GalleryItem,
    readonly slot: number,
    texture: Texture,
    shared: SharedUniforms,
  ) {
    const aspect = Math.min(Math.max(item.aspect, 1.2), 1.72);
    this.width = CARD_HEIGHT * aspect;
    const material = new DistortionMaterial(texture, item.aspect, shared);
    material.uniforms.uPlaneAspect.value = aspect;
    this.mesh = new Mesh(geometry, material);
    this.mesh.userData.card = this;
    this.mesh.frustumCulled = true;
  }

  get uniforms() {
    return this.mesh.material.uniforms;
  }

  /** Apply the blended layout pose plus hover and focus overrides. */
  apply(pose: CardPose, dt: number, toCamera: Vector3) {
    this.hover += (this.hoverTarget - this.hover) * damp(9, dt);
    if (Math.abs(this.hoverTarget - this.hover) < 0.001) this.hover = this.hoverTarget;
    const lift = this.hover * 0.35;

    // Base pose, nudged toward the camera when hovered.
    tmpV.copy(toCamera).sub(pose.position).normalize().multiplyScalar(lift);
    this.mesh.position.copy(pose.position).add(tmpV);
    this.mesh.quaternion.copy(pose.quaternion);
    const s = pose.scale * (1 + this.hover * 0.06);
    let sx = this.width * s;
    let sy = CARD_HEIGHT * s;

    if (this.focus > 0) {
      const f = this.focus;
      this.mesh.position.lerp(this.focusPose.position, f);
      tmpQ.copy(this.mesh.quaternion).slerp(this.focusPose.quaternion, f);
      this.mesh.quaternion.copy(tmpQ);
      sx += (this.focusPose.sx - sx) * f;
      sy += (this.focusPose.sy - sy) * f;
    }

    this.mesh.scale.set(sx, sy, 1);
    const u = this.uniforms;
    u.uPlaneAspect.value = sx / sy;
    // Drop the hover zoom while focusing so the final frame matches the detail hero's cover crop.
    u.uHover.value = this.hover * (1 - this.focus);
    u.uRadius.value = 0.012 * (1 - this.focus);
    const opacity = pose.visibility * this.fade * this.appear;
    u.uOpacity.value = Math.max(opacity, this.focus);
    this.mesh.visible = u.uOpacity.value > 0.003;
    this.mesh.renderOrder = this.focus > 0 ? 10 : 0;
  }

  /** True while the hover tween is still moving (the canvas must keep rendering). */
  get animating() {
    return this.hover !== this.hoverTarget;
  }

  dispose() {
    this.mesh.material.dispose();
  }

  static disposeShared() {
    geometry.dispose();
  }
}

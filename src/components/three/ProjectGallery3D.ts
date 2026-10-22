import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { GalleryCard3D, type GalleryItem } from './GalleryCard3D';
import { RingsLayout } from './layouts/RingsLayout';
import { SpiralLayout } from './layouts/SpiralLayout';
import { createPose, type GalleryLayout, type GalleryMode } from './layouts/types';
import { createSharedUniforms } from './materials/DistortionMaterial';
import { easeInOutCubic } from '../../lib/motion';

const STAGGER = 0.4;
const radial = new Vector3();
const ndc = new Vector3();
const toCam = new Vector3();
const normal = new Vector3();

/**
 * The card system: builds cards for each slot, blends Rings and Spiral poses
 * with a per-card staggered morph, and answers hit-tests.
 */
export class ProjectGallery3D {
  readonly group = new Group();
  readonly cards: GalleryCard3D[] = [];
  readonly shared = createSharedUniforms();
  readonly layouts: Record<GalleryMode, GalleryLayout> = {
    rings: new RingsLayout(),
    spiral: new SpiralLayout(),
  };
  /** 0 = rings, 1 = spiral. Tweened by the controller. */
  morph = 0;
  private readonly poseA = createPose();
  private readonly poseB = createPose();
  private readonly blended = createPose();
  private readonly raycaster = new Raycaster();
  private readonly guides = new Group();
  private readonly guideMaterial = new LineBasicMaterial({ color: 0xf1eee8, transparent: true, opacity: 0 });
  appear = 0;

  constructor(
    items: GalleryItem[],
    sequence: number[],
    textures: Map<string, Texture>,
  ) {
    sequence.forEach((itemIndex, slot) => {
      const item = items[itemIndex];
      const card = new GalleryCard3D(item, slot, textures.get(item.id)!, this.shared);
      this.cards.push(card);
      this.group.add(card.mesh);
    });
    this.group.add(this.guides);
  }

  get count() {
    return this.cards.length;
  }

  configure(aspect: number) {
    const viewport = { aspect, count: this.count };
    this.layouts.rings.configure(viewport);
    this.layouts.spiral.configure(viewport);
    this.buildGuides();
  }

  /** Faint orbit lines that make the ring structure legible. */
  private buildGuides() {
    this.guides.children.forEach((c) => (c as LineLoop).geometry.dispose());
    this.guides.clear();
    const rings = this.layouts.rings as RingsLayout;
    const segments = 192;
    for (let r = 0; r < rings.rows; r++) {
      const y = (r - (rings.rows - 1) / 2) * rings.rowGap - 0.95 * rings.cardScale;
      const pts: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(Math.sin(a) * rings.radius, y, -Math.cos(a) * rings.radius);
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
      this.guides.add(new LineLoop(geo, this.guideMaterial));
    }
  }

  /** The layout that "owns" the current state, used for focus maths. */
  get dominantLayout() {
    return this.morph < 0.5 ? this.layouts.rings : this.layouts.spiral;
  }

  update(dt: number, time: number, scroll: number, velocity: number, camera: PerspectiveCamera, reduced: boolean) {
    const { rings, spiral } = this.layouts;
    const n = this.count;
    this.shared.uTime.value = time;
    this.shared.uVelocity.value = reduced ? 0 : Math.max(Math.min(velocity / 7, 1), -1);
    this.guideMaterial.opacity = 0.09 * (1 - this.morph) * this.appear;
    this.guides.visible = this.guideMaterial.opacity > 0.002;

    for (const card of this.cards) {
      const s = card.slot;
      const local = Math.min(Math.max(this.morph * (1 + STAGGER) - (STAGGER * s) / n, 0), 1);
      const t = easeInOutCubic(local);
      const out = this.blended;

      if (t <= 0) {
        rings.pose(s, scroll, out);
      } else if (t >= 1) {
        spiral.pose(s, scroll, out);
      } else {
        rings.pose(s, scroll, this.poseA);
        spiral.pose(s, scroll, this.poseB);
        out.position.lerpVectors(this.poseA.position, this.poseB.position, t);
        // Swing outward mid-flight so cards visibly travel rather than cross-fade.
        radial.set(out.position.x, 0, out.position.z).normalize().multiplyScalar(Math.sin(t * Math.PI) * 1.6);
        out.position.add(radial);
        out.position.y += Math.sin(t * Math.PI) * (s / n - 0.5) * 2.2;
        out.quaternion.slerpQuaternions(this.poseA.quaternion, this.poseB.quaternion, t);
        out.scale = this.poseA.scale + (this.poseB.scale - this.poseA.scale) * t;
        out.visibility = this.poseA.visibility + (this.poseB.visibility - this.poseA.visibility) * t;
      }

      card.appear = Math.min(Math.max(this.appear * 1.6 - (s / n) * 0.6, 0), 1);
      card.apply(out, dt, camera.position);
    }
  }

  hitTest(pointer: Vector2, camera: PerspectiveCamera): GalleryCard3D | null {
    this.raycaster.setFromCamera(pointer, camera);
    const meshes = this.cards.filter((c) => c.mesh.visible && c.uniforms.uOpacity.value > 0.35).map((c) => c.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return (hit?.object.userData.card as GalleryCard3D | undefined) ?? null;
  }

  /** Project card nearest the visual centre and facing the camera. */
  frontmost(camera: PerspectiveCamera, kind: GalleryItem['kind'] = 'project') {
    let best: GalleryCard3D | null = null;
    let bestScore = Infinity;
    for (const card of this.cards) {
      if (card.item.kind !== kind || card.uniforms.uOpacity.value < 0.5) continue;
      const p = card.mesh.position;
      normal.set(0, 0, 1).applyQuaternion(card.mesh.quaternion);
      toCam.copy(camera.position).sub(p);
      if (normal.dot(toCam) <= 0) continue;
      ndc.copy(p).project(camera);
      if (ndc.z > 1 || Math.abs(ndc.x) > 1.1 || Math.abs(ndc.y) > 1.1) continue;
      const score = ndc.x * ndc.x + ndc.y * ndc.y * 0.6 + toCam.length() * 0.004;
      if (score < bestScore) {
        bestScore = score;
        best = card;
      }
    }
    return best;
  }

  /** Scroll target bringing the closest instance of `itemId` to the front. */
  focusScrollFor(itemId: string, from: number) {
    const layout = this.dominantLayout;
    let best = from;
    let bestDist = Infinity;
    for (const card of this.cards) {
      if (card.item.id !== itemId) continue;
      // In rings mode only the middle row reads as "front".
      if (layout.mode === 'rings') {
        const rings = layout as RingsLayout;
        if (card.slot % rings.rows !== Math.floor((rings.rows - 1) / 2)) continue;
      }
      const target = layout.focusScroll(card.slot, from);
      const dist = Math.abs(target - from);
      if (dist < bestDist) {
        bestDist = dist;
        best = target;
      }
    }
    return best;
  }

  dispose() {
    this.cards.forEach((c) => c.dispose());
    GalleryCard3D.disposeShared();
    this.guides.children.forEach((c) => (c as LineLoop).geometry.dispose());
    this.guideMaterial.dispose();
  }
}

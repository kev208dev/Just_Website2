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

const STAGGER = 0.25;
const radial = new Vector3();

/**
 * Exactly one card per work. Blends Rings and Spiral poses with a lightly
 * staggered morph and answers hit-tests.
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
  appear = 0;
  private readonly poseA = createPose();
  private readonly poseB = createPose();
  private readonly blended = createPose();
  private readonly raycaster = new Raycaster();
  private readonly guides = new Group();
  private readonly guideMaterial = new LineBasicMaterial({ color: 0xd6d0c5, transparent: true, opacity: 0 });

  constructor(items: GalleryItem[], textures: Map<string, Texture>) {
    items.forEach((item, slot) => {
      const card = new GalleryCard3D(item, slot, textures.get(item.id)!, this.shared);
      this.cards.push(card);
      this.group.add(card.mesh);
    });
    this.group.add(this.guides);
  }

  get count() {
    return this.cards.length;
  }

  get animating() {
    return this.cards.some((c) => c.animating);
  }

  configure(aspect: number) {
    const viewport = { aspect, count: this.count };
    this.layouts.rings.configure(viewport);
    this.layouts.spiral.configure(viewport);
    this.buildGuides();
  }

  /** Concentric orbit lines: they give five works a room-sized sense of scale. */
  private buildGuides() {
    this.guides.children.forEach((c) => (c as LineLoop).geometry.dispose());
    this.guides.clear();
    const rings = this.layouts.rings as RingsLayout;
    const segments = 160;
    for (const o of rings.orbits) {
      const pts: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(Math.sin(a) * o.radius, o.y + Math.sin(a) * o.tilt * o.radius, Math.cos(a) * o.radius);
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
      this.guides.add(new LineLoop(geo, this.guideMaterial));
    }
  }

  get dominantLayout() {
    return this.morph < 0.5 ? this.layouts.rings : this.layouts.spiral;
  }

  update(dt: number, scroll: number, velocity: number, camera: PerspectiveCamera, reduced: boolean) {
    const { rings, spiral } = this.layouts;
    const n = this.count;
    // Dead zone: browsing speed keeps cards perfectly flat; only flicks curl them.
    const v = Math.abs(velocity) < 1.2 ? 0 : (Math.abs(velocity) - 1.2) * Math.sign(velocity);
    this.shared.uVelocity.value = reduced ? 0 : Math.max(Math.min(v / 6, 0.6), -0.6);
    this.guideMaterial.opacity = 0.14 * (1 - this.morph) * this.appear;
    this.guides.visible = this.guideMaterial.opacity > 0.002;

    for (const card of this.cards) {
      const s = card.slot;
      const local = Math.min(Math.max(this.morph * (1 + STAGGER) - (STAGGER * s) / n, 0), 1);
      const t = easeInOutCubic(local);
      const out = this.blended;
      if (t <= 0) rings.pose(s, scroll, out);
      else if (t >= 1) spiral.pose(s, scroll, out);
      else {
        rings.pose(s, scroll, this.poseA);
        spiral.pose(s, scroll, this.poseB);
        out.position.lerpVectors(this.poseA.position, this.poseB.position, t);
        radial.set(out.position.x, 0, out.position.z).normalize().multiplyScalar(Math.sin(t * Math.PI) * 1.2);
        out.position.add(radial);
        out.quaternion.slerpQuaternions(this.poseA.quaternion, this.poseB.quaternion, t);
        out.scale = this.poseA.scale + (this.poseB.scale - this.poseA.scale) * t;
        out.visibility = this.poseA.visibility + (this.poseB.visibility - this.poseA.visibility) * t;
      }
      card.appear = Math.min(Math.max(this.appear * 1.5 - (s / n) * 0.5, 0), 1);
      card.apply(out, dt, camera.position);
    }
  }

  hitTest(pointer: Vector2, camera: PerspectiveCamera): GalleryCard3D | null {
    this.raycaster.setFromCamera(pointer, camera);
    const meshes = this.cards.filter((c) => c.mesh.visible && c.uniforms.uOpacity.value > 0.5).map((c) => c.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return (hit?.object.userData.card as GalleryCard3D | undefined) ?? null;
  }

  focusScrollFor(itemId: string, from: number) {
    const card = this.cards.find((c) => c.item.id === itemId);
    return card ? this.dominantLayout.focusScroll(card.slot, from) : from;
  }

  dispose() {
    this.cards.forEach((c) => c.dispose());
    GalleryCard3D.disposeShared();
    this.guides.children.forEach((c) => (c as LineLoop).geometry.dispose());
    this.guideMaterial.dispose();
  }
}

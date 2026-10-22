import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  PlaneGeometry,
  Raycaster,
  Vector2,
  type Camera,
  type Texture,
  type WebGLRenderer,
} from "three";
import { CARD_HEIGHT, CARD_WIDTH, GalleryCard3D } from "./GalleryCard3D";
import { RingsLayout, READING_RING } from "./layouts/RingsLayout";
import { COMPACT_SPIRAL, DEFAULT_SPIRAL, SpiralLayout } from "./layouts/SpiralLayout";
import type { CardSlot, GalleryItem, LayoutContext } from "./types";
import { TAU, clamp, easeInOutCubic, smoothstep } from "./utils/math";
import { placeholderTexture } from "./utils/textures";

export interface GalleryFrame {
  dt: number;
  time: number;
  offset: number;
  /** 0 = rings, 1 = spiral */
  morph: number;
  bend: number;
  /** 0 → 1 entrance */
  intro: number;
  reducedMotion: boolean;
}

/**
 * Owns every project card and blends them between the Rings and Spiral layouts.
 * Morphing never recreates or hides cards: each card interpolates its own
 * position, rotation and scale from one layout to the other.
 */
export class ProjectGallery3D {
  readonly group = new Group();
  readonly cards: GalleryCard3D[] = [];
  readonly rings = new RingsLayout();
  readonly spiral = new SpiralLayout();
  readonly cardCount: number;

  private geometry = new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 32, 18);
  private placeholder: Texture = placeholderTexture();
  private ringGuides = new Group();
  private spiralGuide: Line;
  private guideMaterial = new LineBasicMaterial({ color: new Color("#F2AE45"), transparent: true, opacity: 0.1, depthWrite: false });
  private spiralMaterial = new LineBasicMaterial({ color: new Color("#F2AE45"), transparent: true, opacity: 0, depthWrite: false });
  private raycaster = new Raycaster();
  private ctx: LayoutContext;
  hovered: GalleryCard3D | null = null;

  constructor(readonly items: GalleryItem[], fogColor: Color) {
    const ringCount = this.rings.ringCount;
    const itemCount = items.length;
    this.cardCount = itemCount * ringCount;
    this.ctx = { offset: 0, itemCount, cardCount: this.cardCount, time: 0 };

    for (let index = 0; index < this.cardCount; index++) {
      const slot: CardSlot = {
        index,
        item: index % itemCount,
        ring: Math.floor(index / itemCount),
        slot: index % itemCount,
      };
      const card = new GalleryCard3D(slot, items[slot.item], this.geometry, this.placeholder, fogColor);
      this.cards.push(card);
      this.group.add(card.mesh);
    }

    // orbit guides — hairline circles that make the rings readable as orbits
    for (const ring of this.rings.rings) {
      const pts: number[] = [];
      const seg = 160;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * TAU;
        pts.push(Math.sin(a) * ring.radius, ring.y - CARD_HEIGHT * ring.scale * 0.62, Math.cos(a) * ring.radius);
      }
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
      this.ringGuides.add(new LineLoop(geo, this.guideMaterial));
    }
    this.group.add(this.ringGuides);

    // spiral guide — the path the cards travel along in spiral mode
    this.spiralGuide = new Line(this.buildSpiralGeometry(), this.spiralMaterial);
    this.group.add(this.spiralGuide);
  }

  private buildSpiralGeometry() {
    const c = this.spiral.config;
    const pts: number[] = [];
    const samples = this.cardCount * 12;
    for (let i = 0; i <= samples; i++) {
      const u = (i / samples - 0.5) * this.cardCount;
      const phi = c.focusAngle + (u * TAU) / c.cardsPerTurn;
      pts.push(Math.cos(phi) * c.radius * 1.32, Math.sin(phi) * c.radius * 1.32, c.focusZ - u * c.depthStep);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return geo;
  }

  /** Switches the spiral framing for narrow screens. */
  setCompact(compact: boolean) {
    const next = compact ? COMPACT_SPIRAL : DEFAULT_SPIRAL;
    if (this.spiral.config === next) return;
    this.spiral.config = next;
    this.spiralGuide.geometry.dispose();
    this.spiralGuide.geometry = this.buildSpiralGeometry();
  }

  load(renderer: WebGLRenderer) {
    return Promise.allSettled(this.cards.map((c) => c.load(renderer)));
  }

  /** Index of the item that currently reads as "active" (front of the reading ring / spiral focus). */
  activeItem(offset: number) {
    const n = this.items.length;
    return ((Math.round(offset) % n) + n) % n;
  }

  update(f: GalleryFrame) {
    this.ctx.offset = f.offset;
    this.ctx.time = f.reducedMotion ? 0 : f.time;
    const m = easeInOutCubic(clamp(f.morph, 0, 1));
    const hoverActive = this.hovered !== null;

    for (const card of this.cards) {
      this.rings.compute(card.slot, this.ctx, card.rings);
      this.spiral.compute(card.slot, this.ctx, card.spiral);

      // per-card stagger so the morph ripples through the gallery
      const stagger = (card.slot.index / this.cardCount) * 0.35;
      const t = easeInOutCubic(clamp((m * 1.35 - stagger) / 1, 0, 1));
      const cur = card.current;
      cur.position.lerpVectors(card.rings.position, card.spiral.position, t);
      // lift cards slightly out of the plane mid-morph for a sense of travel
      cur.position.y += Math.sin(t * Math.PI) * 0.6 * (card.slot.ring - 1);
      cur.quaternion.slerpQuaternions(card.rings.quaternion, card.spiral.quaternion, t);
      cur.scale = card.rings.scale + (card.spiral.scale - card.rings.scale) * t;
      cur.opacity = card.rings.opacity + (card.spiral.opacity - card.rings.opacity) * t;

      // entrance: cards arrive from a wider orbit
      const e = smoothstep(card.slot.index / this.cardCount * 0.5, card.slot.index / this.cardCount * 0.5 + 0.5, f.intro);
      if (e < 1) {
        const k = 1 + (1 - e) * 0.45;
        cur.position.x *= k;
        cur.position.z *= k;
        cur.position.y -= (1 - e) * 1.2;
        cur.opacity *= e;
      }

      card.apply(f.dt, f.bend, f.time, hoverActive, f.reducedMotion);
    }

    this.guideMaterial.opacity = 0.1 * (1 - m) * f.intro;
    this.ringGuides.visible = this.guideMaterial.opacity > 0.002;
    this.spiralMaterial.opacity = 0.08 * m * f.intro;
    this.spiralGuide.visible = this.spiralMaterial.opacity > 0.002;
  }

  /** Picks the card under the pointer (normalised device coords). */
  pick(ndc: Vector2, camera: Camera): GalleryCard3D | null {
    this.raycaster.setFromCamera(ndc, camera);
    const visible = this.cards.filter((c) => c.mesh.visible && c.material.uniforms.uOpacity.value > 0.35);
    const hits = this.raycaster.intersectObjects(
      visible.map((c) => c.mesh),
      false,
    );
    for (const hit of hits) {
      const card = hit.object.userData.card as GalleryCard3D;
      // ignore back faces: those cards face away from the viewer
      if (hit.face && hit.face.normal) {
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        const toCam = this.raycaster.ray.direction;
        if (n.dot(toCam) > 0) continue;
      }
      return card;
    }
    return null;
  }

  setHovered(card: GalleryCard3D | null) {
    if (card === this.hovered) return;
    if (this.hovered) this.hovered.hoverTarget = 0;
    this.hovered = card;
    if (card) card.hoverTarget = 1;
  }

  /** The card that represents the active item in the reading ring / spiral focus. */
  focusCard(offset: number, morph: number): GalleryCard3D {
    const n = this.items.length;
    const item = this.activeItem(offset);
    if (morph < 0.5) return this.cards[READING_RING * n + item];
    const idx = ((Math.round(offset) % this.cardCount) + this.cardCount) % this.cardCount;
    return this.cards[idx];
  }

  dispose() {
    const textures = new Set<Texture>();
    for (const c of this.cards) {
      const map = c.material.uniforms.uMap.value as Texture;
      if (map) textures.add(map);
      c.dispose();
    }
    textures.forEach((t) => t.dispose());
    this.placeholder.dispose();
    this.geometry.dispose();
    this.guideMaterial.dispose();
    this.spiralMaterial.dispose();
    this.ringGuides.children.forEach((l) => (l as LineLoop).geometry.dispose());
    this.spiralGuide.geometry.dispose();
  }
}

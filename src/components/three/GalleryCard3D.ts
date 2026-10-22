import { Color, Mesh, PlaneGeometry, Quaternion, Vector3, type Texture, type WebGLRenderer } from "three";
import { DistortionMaterial } from "./materials/DistortionMaterial";
import type { CardSlot, CardTransform, GalleryItem } from "./types";
import { createTypographicTexture, loadImageTexture } from "./utils/textures";
import { damp } from "./utils/math";

export const CARD_WIDTH = 2.4;
export const CARD_HEIGHT = 1.5;

const makeTransform = (): CardTransform => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  scale: 1,
  opacity: 1,
});

/** One physical card: mesh + animation state. Several cards may show the same item. */
export class GalleryCard3D {
  readonly mesh: Mesh<PlaneGeometry, DistortionMaterial>;
  readonly material: DistortionMaterial;

  /** layout targets, recomputed each frame */
  readonly rings = makeTransform();
  readonly spiral = makeTransform();
  /** final blended transform */
  readonly current = makeTransform();

  hover = 0;
  hoverTarget = 0;
  dim = 0;
  /** 0 → 1 once the texture is ready (fades the card in) */
  ready = 0;
  loaded = false;
  /** 0 → 1 visibility multiplier controlled by the gallery (intro / selection) */
  visibility = 1;

  /** when set, the card ignores the layouts (used by the selection animation) */
  override: CardTransform | null = null;

  constructor(
    readonly slot: CardSlot,
    readonly item: GalleryItem,
    geometry: PlaneGeometry,
    placeholder: Texture,
    fogColor: Color,
  ) {
    this.material = new DistortionMaterial({
      map: placeholder,
      imageAspect: item.imageAspect,
      planeSize: [CARD_WIDTH, CARD_HEIGHT],
      fogColor,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.userData.card = this;
    this.mesh.frustumCulled = false; // vertex deformation can push it past its bounds
  }

  async load(renderer: WebGLRenderer) {
    let texture: Texture;
    let aspect = this.item.imageAspect;
    if (this.item.image) {
      try {
        texture = await loadImageTexture(this.item.image, renderer);
        const img = texture.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height) aspect = img.width / img.height;
      } catch {
        texture = await createTypographicTexture(this.item, renderer);
        aspect = 1.6;
      }
    } else {
      texture = await createTypographicTexture(this.item, renderer);
      aspect = 1.6;
    }
    this.material.setMap(texture, aspect);
    this.loaded = true;
  }

  /** Applies the blended transform + animated uniforms to the mesh. */
  apply(dt: number, bend: number, time: number, hoverActive: boolean, reducedMotion: boolean) {
    const t = this.override ?? this.current;
    const speed = reducedMotion ? 30 : 9;
    this.hover = damp(this.hover, this.hoverTarget, speed, dt);
    const dimTarget = hoverActive && this.hoverTarget === 0 ? 1 : 0;
    this.dim = damp(this.dim, dimTarget, 6, dt);
    if (this.loaded) this.ready = damp(this.ready, 1, 4, dt);

    this.mesh.position.copy(t.position);
    this.mesh.quaternion.copy(t.quaternion);
    const s = t.scale * (1 + this.hover * 0.12);
    this.mesh.scale.setScalar(s);

    const opacity = t.opacity * this.ready * this.visibility;
    this.mesh.visible = opacity > 0.002;
    this.material.update({
      bend: reducedMotion ? 0 : bend * (1 - this.hover * 0.6),
      hover: this.hover,
      dim: this.dim * 0.8,
      opacity,
      time,
    });
  }

  dispose() {
    this.material.dispose();
  }
}

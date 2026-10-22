import {
  Box3,
  type BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  RepeatWrapping,
  Vector3,
  type Shape,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clamp, damp } from "./utils/math";

export interface LogoFrame {
  dt: number;
  time: number;
  pointer: { x: number; y: number };
  velocity: number;
  morph: number;
  intro: number;
  reducedMotion: boolean;
}

/** Procedural micro-texture used as a roughness map — breaks up perfect reflections. */
function createGrainTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/**
 * The JUST wordmark as a real extruded solid. The outline is traced from the
 * original logo artwork (public/models/just-logo.svg) so the brand is not distorted.
 * Faces: brushed metallic amber. Sides: black glazed ceramic.
 */
export class JustLogo3D {
  readonly group = new Group();
  private pivot = new Group();
  private faceMaterial: MeshPhysicalMaterial;
  private sideMaterial: MeshPhysicalMaterial;
  private grain = createGrainTexture();
  private geometry: BufferGeometry | null = null;
  private tilt = { x: 0, y: 0 };
  private spin = 0;
  private spinVelocity = 0;
  opacity = 1;
  width = 4.6;

  constructor() {
    this.faceMaterial = new MeshPhysicalMaterial({
      color: new Color("#F2AE45"),
      metalness: 1,
      roughness: 0.26,
      roughnessMap: this.grain,
      clearcoat: 0.5,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.7,
    });
    this.sideMaterial = new MeshPhysicalMaterial({
      color: new Color("#0c0c0d"),
      metalness: 0.55,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.55,
    });
    this.group.add(this.pivot);
  }

  async load(url: string) {
    const data = await new SVGLoader().loadAsync(url);
    const shapes: Shape[] = [];
    for (const path of data.paths) shapes.push(...SVGLoader.createShapes(path));

    const geometry = new ExtrudeGeometry(shapes, {
      depth: 70,
      bevelEnabled: true,
      bevelThickness: 9,
      bevelSize: 5,
      bevelSegments: 4,
      curveSegments: 4,
    });
    // SVG space is y-down: flip y (and z, to keep the triangle winding valid),
    // then centre and normalise to the target width
    geometry.scale(1, -1, -1);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox as Box3;
    const center = box.getCenter(new Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const s = this.width / (box.max.x - box.min.x);
    geometry.scale(s, s, s);
    // smooth the traced outline's facets on the walls while keeping crisp edges
    const smooth = toCreasedNormals(geometry, 0.26);
    this.geometry = smooth;

    const mesh = new Mesh(smooth, [this.faceMaterial, this.sideMaterial]);
    mesh.castShadow = false;
    this.pivot.add(mesh);
  }

  update(f: LogoFrame) {
    const rm = f.reducedMotion;
    // mouse driven tilt — subtle, damped
    this.tilt.x = damp(this.tilt.x, rm ? 0 : -f.pointer.y * 0.16, 3, f.dt);
    this.tilt.y = damp(this.tilt.y, rm ? 0 : f.pointer.x * 0.28, 3, f.dt);

    // scroll gives the logo a light push that decays back to its idle sway
    if (!rm) this.spinVelocity += clamp(f.velocity, -4, 4) * 0.06 * f.dt;
    this.spinVelocity = damp(this.spinVelocity, 0, 2.2, f.dt);
    this.spin = damp(this.spin + this.spinVelocity, 0, 0.9, f.dt);

    const idle = rm ? 0 : Math.sin(f.time * 0.22) * 0.18;
    this.pivot.rotation.set(
      this.tilt.x + (rm ? 0 : Math.sin(f.time * 0.31) * 0.03),
      idle + this.tilt.y + this.spin,
      0,
    );

    // in spiral mode the logo sits at the centre of the vortex, slightly smaller
    const k = 1 - f.morph * 0.18;
    const introScale = 0.9 + 0.1 * f.intro;
    this.group.scale.setScalar(k * introScale);
    this.group.position.y = 0.15 * (1 - f.morph);

    const o = clamp(this.opacity * f.intro, 0, 1);
    const transparent = o < 0.999;
    for (const m of [this.faceMaterial, this.sideMaterial]) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = o;
    }
    this.group.visible = o > 0.002;
  }

  dispose() {
    this.geometry?.dispose();
    this.faceMaterial.dispose();
    this.sideMaterial.dispose();
    this.grain.dispose();
  }
}

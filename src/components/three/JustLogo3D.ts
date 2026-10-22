import {
  BufferGeometry,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  PointLight,
  Shape,
  Vector2,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import logoShape from './logo-shape.json';
import { damp } from '../../lib/motion';

type Pt = number[];

const toShape = (outer: Pt[], holes: Pt[][]) => {
  const shape = new Shape(outer.map(([x, y]) => new Vector2(x, y)));
  shape.holes = holes.map((h) => new Shape(h.map(([x, y]) => new Vector2(x, y))));
  return shape;
};

/**
 * The JUST wordmark extruded from a vector trace of the original logo
 * (see tools/trace-logo.py). Amber metal faces, graphite sides.
 */
export class JustLogo3D {
  readonly group = new Group();
  private readonly pivot = new Group();
  private readonly face: MeshPhysicalMaterial;
  private readonly side: MeshPhysicalMaterial;
  private readonly geometry: BufferGeometry;
  private readonly rim: PointLight;
  private readonly key: DirectionalLight;
  private tiltX = 0;
  private tiltY = 0;
  private spin = 0;
  /** 0..1 — scaled/faded away during the click transition. */
  fade = 1;
  appear = 0;

  constructor(width = 2.8) {
    const shapes = logoShape.shapes.map((s) => toShape(s.outer, s.holes));
    const extruded = new ExtrudeGeometry(shapes, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.016,
      bevelSegments: 5,
      steps: 1,
    });
    extruded.center();
    // ExtrudeGeometry is non-indexed, so this updates normals in place and keeps material groups.
    this.geometry = toCreasedNormals(extruded, Math.PI / 5);

    this.face = new MeshPhysicalMaterial({
      color: new Color('#f2ae45'),
      metalness: 1,
      roughness: 0.24,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.25,
    });
    this.side = new MeshPhysicalMaterial({
      color: new Color('#26272a'),
      metalness: 0.85,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1,
    });

    const mesh = new Mesh(this.geometry, [this.face, this.side]);
    const scale = width / logoShape.aspect;
    mesh.scale.setScalar(scale);
    this.pivot.add(mesh);
    this.group.add(this.pivot);

    this.key = new DirectionalLight('#fff4e2', 2.2);
    this.key.position.set(2, 3, 4);
    this.rim = new PointLight('#f2ae45', 22, 9, 1.6);
    this.rim.position.set(-3, 1, 1.5);
    this.group.add(this.key, this.rim);
  }

  update(dt: number, time: number, pointer: { x: number; y: number }, velocity: number, reduced: boolean) {
    const idle = reduced ? 0 : Math.sin(time * 0.22) * 0.32;
    this.spin += (velocity * 0.09 - this.spin) * damp(3, dt);
    this.tiltX += (-pointer.y * 0.16 - this.tiltX) * damp(4, dt);
    this.tiltY += (pointer.x * 0.24 - this.tiltY) * damp(4, dt);

    this.pivot.rotation.set(this.tiltX + (reduced ? 0 : Math.sin(time * 0.31) * 0.04), idle + this.tiltY + this.spin, 0);
    this.pivot.position.y = reduced ? 0 : Math.sin(time * 0.6) * 0.04;

    // Light slowly orbits so reflections travel across the metal.
    const a = reduced ? 0.8 : time * 0.35;
    this.rim.position.set(Math.cos(a) * 3.2, Math.sin(a * 0.7) * 1.4 + 0.4, 1.8 + Math.sin(a) * 0.8);

    const vis = this.fade * this.appear;
    this.face.opacity = this.side.opacity = vis;
    this.face.transparent = this.side.transparent = vis < 0.999;
    this.group.visible = vis > 0.01;
    const s = 0.82 + 0.18 * vis;
    this.group.scale.setScalar(s);
  }

  dispose() {
    this.geometry.dispose();
    this.face.dispose();
    this.side.dispose();
  }
}

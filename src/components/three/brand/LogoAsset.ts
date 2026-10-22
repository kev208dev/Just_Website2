import {
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  Shape,
  Vector2,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import logoShape from '../logo-shape.json';

type Pt = number[];
const toShape = (outer: Pt[], holes: Pt[][]) => {
  const shape = new Shape(outer.map(([x, y]) => new Vector2(x, y)));
  shape.holes = holes.map((h) => new Shape(h.map(([x, y]) => new Vector2(x, y))));
  return shape;
};

export const LOGO_ASPECT = logoShape.aspect;

/**
 * The JUST wordmark as a solid, traced from the original logo (tools/trace-logo.py).
 * Unit height, centred. Material group 0 = faces, 1 = sides/bevel.
 */
export function createLogoGeometry(depth = 0.3): BufferGeometry {
  const shapes = logoShape.shapes.map((s) => toShape(s.outer, s.holes));
  const extruded = new ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.022,
    bevelSegments: 6,
    steps: 1,
  });
  extruded.center();
  // ExtrudeGeometry is non-indexed: normals are updated in place and material groups survive.
  return toCreasedNormals(extruded, Math.PI / 5);
}

/**
 * Dark brushed chrome faces with bronze-edged bevels. The brushed look comes
 * from anisotropic specular, so reflections stretch like machined metal.
 */
export function createLogoMaterials() {
  const face = new MeshPhysicalMaterial({
    color: new Color('#3a3c41'),
    metalness: 1,
    roughness: 0.34,
    anisotropy: 0.6,
    anisotropyRotation: Math.PI / 2,
    envMapIntensity: 1.2,
  });
  const edge = new MeshPhysicalMaterial({
    color: new Color('#c88f47'),
    metalness: 1,
    roughness: 0.26,
    anisotropy: 0.5,
    envMapIntensity: 1.05,
  });
  return { face, edge, list: [face, edge] as const };
}

import { DoubleSide, ShaderMaterial, type Texture } from 'three';
import vertexShader from '../shaders/card.vert.glsl?raw';
import fragmentShader from '../shaders/card.frag.glsl?raw';

/** Uniforms shared by every card; mutate `.value` once per frame. */
export function createSharedUniforms() {
  return {
    uVelocity: { value: 0 },
    uTime: { value: 0 },
    uDim: { value: 0 },
    uFogNear: { value: 10 },
    uFogFar: { value: 22 },
  };
}

export type SharedUniforms = ReturnType<typeof createSharedUniforms>;

/**
 * Card material with velocity-based vertex bend and chromatic shift.
 * Shared uniforms are passed by reference so a single write updates all cards.
 */
export class DistortionMaterial extends ShaderMaterial {
  constructor(map: Texture, imageAspect: number, shared: SharedUniforms) {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      side: DoubleSide,
      uniforms: {
        ...shared,
        uMap: { value: map },
        uImageAspect: { value: imageAspect },
        uPlaneAspect: { value: imageAspect },
        uHover: { value: 0 },
        uOpacity: { value: 0 },
        uRadius: { value: 0.035 },
      },
    });
  }
}

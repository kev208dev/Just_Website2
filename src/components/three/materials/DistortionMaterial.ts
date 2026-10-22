import { Color, DoubleSide, ShaderMaterial, Texture, Vector2 } from "three";
import vertexShader from "../shaders/card.vert.glsl?raw";
import fragmentShader from "../shaders/card.frag.glsl?raw";

export interface DistortionMaterialOptions {
  map: Texture;
  imageAspect: number;
  planeSize: [number, number];
  fogColor: Color;
  fog?: [number, number];
}

/**
 * Reusable card material. Velocity (`bend`) drives a vertex deformation and a
 * subtle chromatic split; everything eases back to rest when motion stops.
 */
export class DistortionMaterial extends ShaderMaterial {
  constructor({ map, imageAspect, planeSize, fogColor, fog = [16, 40] }: DistortionMaterialOptions) {
    super({
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uMap: { value: map },
        uImageAspect: { value: new Vector2(imageAspect, planeSize[0] / planeSize[1]) },
        uPlaneSize: { value: new Vector2(planeSize[0], planeSize[1]) },
        uBend: { value: 0 },
        uHover: { value: 0 },
        uDim: { value: 0 },
        uOpacity: { value: 0 },
        uRadius: { value: 0.035 },
        uZoom: { value: 0 },
        uTime: { value: 0 },
        uFogColor: { value: fogColor },
        uFog: { value: new Vector2(fog[0], fog[1]) },
      },
    });
    // the card shader is unlit and handles its own output encoding
    this.toneMapped = false;
  }

  /** Pushes the per-frame animated values to the GPU uniforms. */
  update(state: { bend: number; hover: number; dim: number; opacity: number; time: number }) {
    const u = this.uniforms;
    u.uBend.value = state.bend;
    u.uHover.value = state.hover;
    u.uZoom.value = state.hover * 0.06;
    u.uDim.value = state.dim;
    u.uOpacity.value = state.opacity;
    u.uTime.value = state.time;
  }

  setMap(map: Texture, imageAspect: number) {
    this.uniforms.uMap.value = map;
    this.uniforms.uImageAspect.value.x = imageAspect;
  }
  setFog(near: number, far: number) {
    this.uniforms.uFog.value.set(near, far);
  }
}

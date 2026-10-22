// Gallery card fragment shader: cover-fit image, rounded corners, hover lift,
// back-face darkening and a depth fade into the room. One texture fetch.
uniform sampler2D uMap;
uniform float uImageAspect;
uniform float uPlaneAspect;
uniform float uHover;
uniform float uOpacity;
uniform float uDim;
uniform float uFogNear;
uniform float uFogFar;
uniform float uRadius;

varying vec2 vUv;
varying float vDepth;
varying float vCurl;

vec2 coverUv(vec2 uv) {
  float r = uPlaneAspect / uImageAspect;
  vec2 s = r > 1.0 ? vec2(1.0, 1.0 / r) : vec2(r, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec2 cuv = coverUv(uv);
  cuv = (cuv - 0.5) * (1.0 - uHover * 0.035) + 0.5;
  vec3 col = texture2D(uMap, cuv).rgb;

  vec2 size = vec2(uPlaneAspect, 1.0);
  vec2 q = (vUv - 0.5) * size;
  vec2 halfSize = size * 0.5 - uRadius;
  float d = length(max(abs(q) - halfSize, 0.0)) - uRadius;
  float aa = max(fwidth(d) * 1.2, 1e-4);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.001) discard;

  col *= 1.0 - vCurl * 0.08;
  col *= mix(1.0, 0.38, uDim * (1.0 - uHover));
  if (!gl_FrontFacing) col *= 0.18;

  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(col, mask * uOpacity * (1.0 - fog * 0.8));
  #include <colorspace_fragment>
}

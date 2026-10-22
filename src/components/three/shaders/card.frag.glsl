// Gallery card — image with cover-fit, rounded corners, velocity RGB shift,
// hover emphasis, back-face treatment and depth fog.

uniform sampler2D uMap;
uniform vec2 uImageAspect;   // x: image aspect (w/h), y: plane aspect (w/h)
uniform float uBend;
uniform float uHover;
uniform float uDim;          // 0 .. 1 — how much a non-hovered card recedes
uniform float uOpacity;
uniform float uRadius;       // corner radius in plane-height units
uniform vec3 uFogColor;
uniform vec2 uFog;           // near, far
uniform float uZoom;         // inner image zoom (hover)

varying vec2 vUv;
varying float vViewZ;
varying float vBendShade;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 coverUv(vec2 uv, float imageAspect, float planeAspect) {
  vec2 scale = imageAspect > planeAspect
    ? vec2(planeAspect / imageAspect, 1.0)
    : vec2(1.0, imageAspect / planeAspect);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec2 uv = vUv;
  bool front = gl_FrontFacing;
  if (!front) uv.x = 1.0 - uv.x;

  // rounded rectangle mask (computed in an aspect-correct space)
  float planeAspect = uImageAspect.y;
  vec2 p = (vUv - 0.5) * vec2(planeAspect, 1.0);
  float d = roundedBox(p, vec2(planeAspect * 0.5, 0.5), uRadius);
  float aa = fwidth(d) * 1.2;
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.001) discard;

  vec2 iuv = coverUv(uv, uImageAspect.x, planeAspect);
  iuv = (iuv - 0.5) / (1.0 + uZoom) + 0.5;

  // chromatic split that follows the bend direction
  float shift = uBend * 0.012;
  vec3 color;
  color.r = texture2D(uMap, iuv + vec2(shift, 0.0)).r;
  color.g = texture2D(uMap, iuv).g;
  color.b = texture2D(uMap, iuv - vec2(shift, 0.0)).b;

  // light falloff across the curved sheet
  color *= 1.0 - clamp(abs(vBendShade) * 0.35, 0.0, 0.25);

  // non hovered cards recede when something else is in focus
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(luma) * 0.55, uDim * 0.85);

  // hover: lift exposure very slightly
  color *= 1.0 + uHover * 0.06;

  if (!front) {
    color = mix(color, vec3(luma), 0.7) * 0.22;
  }

  // inner hairline frame
  float edge = 1.0 - smoothstep(0.0, 0.006, abs(d + 0.006));
  color = mix(color, vec3(0.95, 0.68, 0.27), edge * (0.18 + uHover * 0.5));

  float fog = smoothstep(uFog.x, uFog.y, vViewZ);
  color = mix(color, uFogColor, fog * 0.92);

  gl_FragColor = vec4(color, mask * uOpacity);
  #include <colorspace_fragment>
}

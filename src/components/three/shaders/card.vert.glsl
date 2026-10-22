// Gallery card — velocity driven vertex deformation.
// The plane bends like a sheet of paper caught in the motion of the gallery:
// a parabolic curve across its width plus a softer wave along its height.

uniform float uBend;      // signed, velocity based (-0.4 .. 0.4)
uniform float uHover;     // 0 .. 1
uniform float uTime;
uniform vec2 uPlaneSize;  // world units of the undeformed plane

varying vec2 vUv;
varying float vViewZ;
varying float vBendShade;

void main() {
  vUv = uv;
  vec3 p = position;

  // normalised coordinates in [-1, 1]
  vec2 n = vec2(p.x / (uPlaneSize.x * 0.5), p.y / (uPlaneSize.y * 0.5));

  // curve across the width — edges pull back, centre pushes forward
  float curve = (1.0 - n.x * n.x);
  float bend = uBend * curve * uPlaneSize.x * 0.32;

  // secondary wave so the sheet never looks rigid while moving
  float wave = sin(n.y * 3.14159 * 0.5 + n.x * 1.4 + uTime * 2.0) * abs(uBend) * 0.06 * uPlaneSize.y;

  // gentle lift towards the viewer while hovered
  float lift = uHover * 0.06 * (1.0 - n.x * n.x * 0.5) * (1.0 - n.y * n.y * 0.5);

  p.z += bend + wave + lift;
  vBendShade = bend;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vViewZ = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}

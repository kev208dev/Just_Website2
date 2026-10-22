// Gallery card vertex shader.
// The card stays perfectly flat at rest; only fast scroll/drag adds a subtle
// paper-like curl (uVelocity is already dead-zoned and eased on the CPU).
uniform float uVelocity; // signed, [-1, 1]

varying vec2 vUv;
varying float vDepth;
varying float vCurl;

void main() {
  vUv = uv;
  vec3 p = position; // unit plane, x/y in [-0.5, 0.5]
  float curl = 1.0 - (p.x * 2.0) * (p.x * 2.0);
  p.z += curl * uVelocity * 0.28;
  vCurl = curl * abs(uVelocity);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}

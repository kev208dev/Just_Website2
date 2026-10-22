// Gallery card vertex shader — velocity driven paper bend.
uniform float uVelocity; // signed, normalised to [-1, 1]
uniform float uTime;
uniform float uHover;

varying vec2 vUv;
varying float vDepth;
varying float vBend;

const float PI = 3.141592653589793;

void main() {
  vUv = uv;
  vec3 p = position; // unit plane, x/y in [-0.5, 0.5]

  float v = uVelocity;
  // Parabolic curl across the width, like a sheet catching air.
  float curl = 1.0 - pow(p.x * 2.0, 2.0);
  p.z += curl * v * 0.42;
  // A soft wave travelling across the card while it moves.
  p.z += sin(p.x * PI * 2.0 + uTime * 5.0) * 0.035 * abs(v);
  // Slight shear so the trailing edge lags behind.
  p.y += p.x * v * 0.06;
  // Hover lifts the centre a touch.
  p.z += curl * uHover * 0.06;

  vBend = curl * abs(v);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}

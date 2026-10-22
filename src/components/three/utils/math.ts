/** Small, allocation-free math helpers shared by the 3D modules. */

export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Frame-rate independent exponential damping.
 * `lambda` is the response speed (higher = snappier); `dt` in seconds.
 */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Positive modulo — wraps `v` into [0, m). */
export const mod = (v: number, m: number) => ((v % m) + m) % m;

/** Wraps `v` into [-m/2, m/2) — the shortest signed distance on a loop of length m. */
export const wrapCentered = (v: number, m: number) => mod(v + m / 2, m) - m / 2;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Costa del Gzowo: small helpers shared by the pedestrian and traffic code (seeded random numbers, angles, easing).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const POPULATION = { low: [6, 2], medium: [12, 4], high: [18, 6], ultra: [24, 8], cinematic: [32, 10], extreme: [40, 12] };

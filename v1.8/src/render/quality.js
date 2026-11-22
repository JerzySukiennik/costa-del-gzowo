// Costa del Gzowo: what each quality level sets, and the list of speed-ups that keep the picture the same and can be switched off to compare.
export const QUALITY = {
  low: {
    label: 'Low', note: 'Lower resolution, shorter draw distances, lighter shadows and reflection',
    ratio: 1, scale: 0.66, superscale: 1, grass: 0.35, grassReach: 0.8, shadowMap: 1024, shadowFar: 240, farShadowEvery: 4, treeRange: 0.7, impostor: 256, forest: 6, plantRange: 0.6,
    reflection: [0.25, 4], ao: 8, fog: 8, blur: 5, water: 'medium',
  },
  medium: {
    label: 'Medium', note: 'Lower resolution, thinner grass',
    ratio: 1, scale: 0.72, superscale: 1, grass: 0.55, grassReach: 1, shadowMap: 2048, shadowFar: 240, farShadowEvery: 3, treeRange: 1, impostor: 256, forest: 10, plantRange: 1,
    reflection: [0.3, 3], ao: 12, fog: 14, blur: 7, water: 'medium',
  },
  high: {
    label: 'High', note: 'Screen resolution up to 1x',
    ratio: 1, scale: 1, superscale: 1, grass: 1, grassReach: 1, shadowMap: 2048, shadowFar: 240, farShadowEvery: 3, treeRange: 1, impostor: 256, forest: 18, plantRange: 1,
    reflection: [0.4, 2], ao: 12, fog: 14, blur: 7, water: 'high',
  },
  ultra: {
    label: 'Ultra', note: 'Up to 1.25x resolution',
    ratio: 1.25, scale: 1, superscale: 1, grass: 1, grassReach: 1, shadowMap: 2048, shadowFar: 240, farShadowEvery: 3, treeRange: 1, impostor: 256, forest: 28, plantRange: 1,
    reflection: [0.5, 2], ao: 12, fog: 14, blur: 7, water: 'ultra',
  },
  cinematic: {
    label: 'Cinematic', note: 'Full screen resolution, 4K shadows, longer draw distances',
    ratio: 3, scale: 1, superscale: 1.3, grass: 1, grassReach: 1.3, shadowMap: 4096, shadowFar: 240, farShadowEvery: 1, treeRange: 1.6, impostor: 512, forest: 64, plantRange: 1.6,
    reflection: [1, 1], ao: 20, fog: 24, blur: 11, water: 'ultra',
  },
  extreme: {
    label: 'Extreme', note: 'Everything at its limit: supersampling on ordinary screens, the longest draw distances and shadow range, the most effect samples',
    ratio: 3, scale: 1, superscale: 1.6, grass: 1.15, grassReach: 1.6, shadowMap: 4096, shadowFar: 320, farShadowEvery: 1, treeRange: 2.4, impostor: 512, forest: 110, plantRange: 2.4,
    reflection: [1, 1], ao: 28, fog: 36, blur: 15, water: 'ultra',
  },
};

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra', 'cinematic', 'extreme'];

export const SPEEDUPS = [
  { id: 'grass', label: 'Grass only in view', note: 'Grass tiles behind the camera or past the fade distance are not sent to the graphics card.' },
  { id: 'reflection', label: 'Reflection only when needed', note: 'The mirrored scene for the water is skipped while no water is on screen, and uses lighter models when it is.' },
  { id: 'shadows', label: 'Lighter shadow casters', note: 'Trees beyond 18 m cast shadows from thinned crowns drawn in a few calls; people and vehicles cast from simplified shapes.' },
  { id: 'models', label: 'Models only where they show', note: 'Vehicles and statues outside the view are skipped (their shadows and lights stay); far ones drop triangles once the difference is under half a pixel.' },
];

export function createPerf(params) {
  const off = params && params.get('speedups') === '0';
  const flags = {};
  for (const s of SPEEDUPS) flags[s.id] = !off;
  return flags;
}

export function renderScale(level, deviceRatio) {
  const ratio = Math.min(deviceRatio || 1, level.ratio);
  return { ratio, scale: level.scale * ((deviceRatio || 1) < 1.5 ? level.superscale : 1) };
}

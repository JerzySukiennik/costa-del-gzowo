// Costa del Gzowo: fixed camera views shared by the benchmark in the local panel and the headless tool (cam = eye x, y, z and target x, y, z; ground = eye height above the terrain).
export const VIEWS = {
  spawn: { label: 'Parking (gameplay camera)' },
  town: { label: 'Gzowo Springs street', cam: [130, 6.4, 0.5, 268, 8, 0] },
  river: { label: 'River, bridge and sun', cam: [3, 2.6, -62, 8, 6, 60] },
  meadow: { label: 'Meadow and forest', cam: [-168, 0, 96, -100, 0, 20], ground: 1.7 },
  edge: { label: 'Forest at the map edge', cam: [-40, 0, 268, 10, 0, 360], ground: 1.7 },
  overview: { label: 'Helicopter overview', cam: [-210, 62, 130, 80, 0, 0] },
};

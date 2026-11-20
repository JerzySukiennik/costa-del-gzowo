// Riverside: shared world constants (meters, Y up, river flows toward +Z, bridge runs along X at z = 0).

export const WORLD = {
  waterLevel: 0,
  half: 320,
  flowSpeed: 0.55,
};

export const LAYERS = {
  WORLD: 0,
  DETAIL: 1,
  WATER: 2,
};

export const BRIDGE = {
  halfLength: 48,
  deckY: 8.6,
  deckHalfWidth: 6.3,
  carriageHalfWidth: 4.5,
  sidewalkHeight: 0.18,
  pierXs: [-24, 0, 24],
  columnZ: 3.4,
  columnRadius: 0.7,
  gapX: [6, 12],
  gapSide: 1,
};

export const ROAD = {
  baseY: 4.4,
  halfWidth: 4.5,
  shoulder: 2.0,
  endX: 250,
  pullOff: { x0: -142, x1: -108, z0: 6.2, z1: 24 },
};

export const SPAWN = {
  car: { x: -116, z: 16.5, yaw: 0.12 },
  player: { x: -122.5, z: 12.4, yaw: 1.2 },
};

export const WATER_OBSTACLES = BRIDGE.pierXs.flatMap((x) => [
  { x, z: -BRIDGE.columnZ, radius: BRIDGE.columnRadius },
  { x, z: BRIDGE.columnZ, radius: BRIDGE.columnRadius },
]);

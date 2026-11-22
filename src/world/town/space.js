// Costa del Gzowo: where Gzowo Springs sits in the world; the street plan in layout.js is written in the town's own coordinates and converts to world coordinates through here.
export const TOWN_OFFSET = { x: 0, z: 0 };

export const toWorldX = (x) => x + TOWN_OFFSET.x;
export const toWorldZ = (z) => z + TOWN_OFFSET.z;
export const toTownX = (x) => x - TOWN_OFFSET.x;
export const toTownZ = (z) => z - TOWN_OFFSET.z;

export function toWorld(point, out = point) {
  out.x = point.x + TOWN_OFFSET.x;
  out.z = point.z + TOWN_OFFSET.z;
  return out;
}

export function toTown(point, out = point) {
  out.x = point.x - TOWN_OFFSET.x;
  out.z = point.z - TOWN_OFFSET.z;
  return out;
}

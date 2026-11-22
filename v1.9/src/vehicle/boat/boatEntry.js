// Costa del Gzowo boats: boarding and leaving (hop aboard from a dock or climb in from the water, step off onto the nearest dock or slip into the water) on top of the shared car entry.
import * as THREE from 'three';
import { createCarEntry } from '../carEntry.js';

export function createBoatEntry({ model, car, audio, physics, scene, spawn, ...more }) {
  const geo = model.entryGeometry();
  const base = geo.exitSpot.clone();
  const level = (x, z) => (car.water ? car.water.getHeightAt(x, z) : 0);
  const ground = more.groundBelow;
  const groundBelow = (x, y, z) => {
    const g = ground(x, y, z);
    const w = level(x, z);
    return g === null || g < w - 0.05 ? w - 1.35 : g;
  };
  const entry = createCarEntry({ model, car, audio, physics, scene, ...more, groundBelow });
  const p = new THREE.Vector3();
  const candidates = [...(geo.extraExits || [])];
  for (const d of [0.6, 1.4, 2.2, 3.0]) for (const side of [1, -1]) candidates.push(new THREE.Vector3(base.x, 0, side * (geo.halfWidth + d)));

  function pickExit() {
    model.group.updateWorldMatrix(true, false);
    let best = null;
    let bestY = -Infinity;
    for (const c of candidates) {
      p.copy(c).applyMatrix4(model.group.matrixWorld);
      const g = ground(p.x, model.group.position.y + 2.4, p.z);
      if (g === null || g < level(p.x, p.z) + 0.15) continue;
      const score = -c.distanceTo(geo.seat);
      if (score > bestY) {
        bestY = score;
        best = c;
      }
    }
    geo.exitSpot.copy(best || base);
  }

  const begin = entry.begin;
  entry.begin = (type) => {
    if (type === 'exit') pickExit();
    const ok = begin(type);
    if (ok && type === 'exit' && car.leave) car.leave();
    return ok;
  };
  entry.dockSpot = () => {
    const far = Math.hypot(car.position.x - spawn.x, car.position.z - spawn.z) > 12;
    if (far && !car.state.occupied) car.respawn();
    const d = spawn.dock || spawn;
    const g = ground(d.x, 6, d.z);
    return new THREE.Vector3(d.x, g === null ? level(d.x, d.z) : g, d.z);
  };
  return entry;
}

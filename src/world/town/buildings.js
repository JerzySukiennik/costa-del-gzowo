// Costa del Gzowo: Gzowo Springs buildings (temporary massing).
import { TOWN } from '../../config.js';
import { L } from './kit.js';
import { PLOTS } from './layout.js';

export function buildBuildings(T) {
  for (const p of PLOTS) {
    const S = T.cell((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2).surface;
    const h = 4 + (p.x0 % 3) * 3.5;
    S.with({ layer: L.PLASTER, color: [0.9, 0.7, 0.6], wear: 0.6 }, () => S.box(p.x0, TOWN.ground - 0.2, p.z0, p.x1, TOWN.walk + h, p.z1));
    T.box(p.x0, p.x1, TOWN.ground - 0.2, TOWN.walk + h, p.z0, p.z1);
  }
  return [];
}

// Costa del Gzowo marina: the harbour's footprint in its own frame (u out to sea from the quay edge, v along the quay) and the plain data the terrain has to respect.
import { PORT, portPoint } from '../../config.js';

export const SITE = {
  land: 1.6,
  quay: { v0: -36, v1: 40 },
  apron: { u0: -15, u1: 0 },
  basin: { u0: 0, u1: 44, v0: -40, v1: 44 },
  slipway: { v0: 32.5, v1: 40, u0: -9, u1: 7, top: 1.6, bottom: -1.6 },
  depth: { quay: 3.5, basin: 4, yacht: 4.5, channel: 10 },
};

export function portLocal(x, z) {
  const c = Math.cos(PORT.heading);
  const s = Math.sin(PORT.heading);
  const dx = x - PORT.x;
  const dz = z - PORT.z;
  return { u: c * dx - s * dz, v: -s * dx - c * dz };
}

export function portClear(x, z, margin = 0) {
  const { u, v } = portLocal(x, z);
  if (v < SITE.quay.v0 - 2 - margin || v > SITE.quay.v1 + 2 + margin) return true;
  return u < SITE.apron.u0 - 1.5 - margin || u > SITE.basin.u1 + margin;
}

export function portSite() {
  const corner = (u, v) => {
    const p = portPoint(u, v);
    return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
  };
  const a = SITE.apron;
  const q = SITE.quay;
  const b = SITE.basin;
  const s = SITE.slipway;
  return {
    anchor: { x: PORT.x, z: PORT.z, heading: PORT.heading },
    frame: 'u points from the quay edge out to sea (cos heading, 0, -sin heading); v runs along the quay ((-sin heading, 0, -cos heading)); world = anchor + u * outward + v * along',
    quayLine: [corner(0, q.v0), corner(0, q.v1)],
    land: { level: SITE.land, note: 'flat land at this height behind the quay line, at least to the apron edge', outline: [corner(a.u0, q.v0), corner(a.u1, q.v0), corner(a.u1, q.v1), corner(a.u0, q.v1)] },
    basin: { outline: [corner(b.u0, b.v0), corner(b.u1, b.v0), corner(b.u1, b.v1), corner(b.u0, b.v1)], minDepth: SITE.depth.basin, quayDepth: SITE.depth.quay, yachtBerthDepth: SITE.depth.yacht, note: 'open water; depth measured below the water level; at least quayDepth within 6 m of the quay line' },
    slipway: { outline: [corner(s.u0, s.v0), corner(s.u1, s.v0), corner(s.u1, s.v1), corner(s.u0, s.v1)], from: { u: s.u0, y: s.top }, to: { u: s.u1, y: s.bottom }, note: 'concrete ramp into the water; terrain under it must stay below the ramp' },
    channel: { outline: [corner(b.u1, b.v0), corner(b.u1 + 60, b.v0), corner(b.u1 + 60, b.v1), corner(b.u1, b.v1)], minDepth: SITE.depth.channel, note: 'open water toward the sea, 10 m or more for the diving boat' },
    keepClear: 'no trees, rocks, plants, grass or reeds inside land.outline and basin.outline',
  };
}

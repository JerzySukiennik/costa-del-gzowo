// Costa del Gzowo: head and neck sculpt (skull, brow, sockets with lids, nose, lips, jaw, ears, neck) as signed distance fields.
import { ell, sph, cone, box, torus, custom, union, subtract, smooth } from './sdf.js';

export const EYE = { x: 0.032, y: 0.072, z: 0.067, r: 0.0118, w: 0.0146, up: 0.0041, down: 0.0027, tilt: 0.09 };

export function hairlineY(x, z) {
  const a = Math.abs(Math.atan2(x, z + 0.02));
  const keys = [[0, 0.152], [0.45, 0.16], [0.85, 0.13], [1.12, 0.088], [1.3, 0.055], [1.45, 0.1], [1.8, 0.098], [2.3, 0.03], [Math.PI, -0.005]];
  for (let i = 1; i < keys.length; i++) {
    if (a <= keys[i][0]) {
      const [a0, y0] = keys[i - 1];
      const [a1, y1] = keys[i];
      const t = (a - a0) / (a1 - a0);
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return -0.005;
}

function eyelid(H, s, part) {
  const c = H.sub(s * EYE.x, EYE.y, EYE.z, 0, s * 0.12, s * EYE.tilt);
  const t = s > 0 ? 'L' : 'R';
  return custom(c, 0.02, (x0, y, z) => {
    const lid = lidShape(x0, y, z, s);
    return part > 0 ? Math.max(lid, -y - 0.0005) : Math.max(lid, y - 0.0005);
  }).tag(part > 0 ? { ['lid' + t]: 1 } : { head: 1 });
}

function lidShape(x0, y, z, s) {
  const x = x0 * s;
  const ball = Math.sqrt(x0 * x0 + y * y + z * z) - (EYE.r + 0.0022);
  if (z < -0.004) return ball;
  const u = (x + 0.0012) / EYE.w;
  const shape = Math.max(0, 1 - u * u);
  const lift = 0.0009 * u;
  const top = EYE.up * Math.pow(shape, 0.8) + lift;
  const bot = -EYE.down * Math.pow(shape, 0.9) + lift * 0.6 - 0.0006;
  const open = Math.max(y - top, bot - y, Math.abs(x + 0.0012) - EYE.w);
  const slot = Math.max(open, -z - 0.002);
  return Math.max(ball, -slot);
}

function ear(H, s) {
  const E = H.sub(s * 0.071, 0.054, -0.014, -0.14, s * 0.32, s * 0.08);
  const shell = union(0.004,
    ell(E.sub(s * 0.007, 0.002, 0), 0.0055, 0.03, 0.019),
    torus(E.sub(s * 0.0095, 0.004, -0.002, 0, 0, Math.PI / 2), 0.0155, 0.0034, 1.42, 1.05),
    ell(E.sub(s * 0.006, -0.025, -0.001), 0.0048, 0.0095, 0.0085),
    ell(E.sub(s * 0.002, -0.004, 0.013), 0.006, 0.008, 0.005),
  );
  const cut = union(0.003, ell(E.sub(s * 0.0125, -0.006, 0.002), 0.0062, 0.0105, 0.0085), ell(E.sub(s * 0.012, 0.012, -0.002), 0.004, 0.008, 0.009));
  return subtract(shell, cut, 0.0025);
}

export function sculptHead(H, W) {
  const cranium = union(0.03,
    ell(H.sub(0, 0.1, -0.022), 0.0765, 0.097, 0.1),
    ell(H.sub(0, 0.07, -0.058), 0.069, 0.078, 0.072),
    ell(H.sub(0, 0.112, 0.028), 0.066, 0.062, 0.053),
    ell(H.sub(0, 0.075, 0.0), 0.075, 0.06, 0.08),
  );
  const parts = [cranium];
  const faceParts = [];
  for (const s of [1, -1]) {
    faceParts.push(
      cone(H.point(s * 0.05, 0.095, 0.07), H.point(s * 0.012, 0.094, 0.085), 0.0085, 0.0095),
      ell(H.sub(s * 0.05, 0.057, 0.058, 0, s * 0.35, 0), 0.02, 0.0115, 0.016),
      cone(H.point(s * 0.054, 0.057, 0.048), H.point(s * 0.07, 0.056, 0.0), 0.009, 0.008),
      ell(H.sub(s * 0.037, 0.026, 0.056), 0.026, 0.032, 0.026),
      cone(H.point(s * 0.061, 0.046, -0.012), H.point(s * 0.058, -0.008, -0.002), 0.011, 0.0135),
      cone(H.point(s * 0.058, -0.008, -0.002), H.point(s * 0.022, -0.036, 0.068), 0.015, 0.0125),
      ell(H.sub(s * 0.032, 0.058, 0.07), 0.012, 0.006, 0.008),
      ell(H.sub(s * 0.053, 0.012, 0.022), 0.015, 0.03, 0.026),
      ell(H.sub(s * 0.045, 0.028, 0.042), 0.022, 0.036, 0.03),
    );
  }
  faceParts.push(
    ell(H.sub(0, 0.014, 0.058), 0.042, 0.04, 0.038),
    ell(H.sub(0, 0.042, 0.046), 0.058, 0.045, 0.048),
    ell(H.sub(0, -0.031, 0.075), 0.025, 0.018, 0.015),
    ell(H.sub(0, -0.018, 0.04), 0.05, 0.03, 0.046),
    ell(H.sub(0, 0.088, 0.08), 0.013, 0.012, 0.009),
  );
  const sockets = union(0, ...[1, -1].map((s) => ell(H.sub(s * EYE.x, EYE.y + 0.002, EYE.z + 0.009), 0.0195, 0.0138, 0.0125)));
  let face = subtract(union(0.016, cranium, ...faceParts), sockets, 0.007);
  const nose = union(0.005,
    cone(H.point(0, 0.085, 0.083), H.point(0, 0.04, 0.103), 0.0068, 0.0092),
    ell(H.sub(0, 0.033, 0.103), 0.0118, 0.0105, 0.0108),
    ell(H.sub(0.0142, 0.026, 0.092), 0.0082, 0.0074, 0.0088),
    ell(H.sub(-0.0142, 0.026, 0.092), 0.0082, 0.0074, 0.0088),
    cone(H.point(0.004, 0.07, 0.081), H.point(0.012, 0.03, 0.09), 0.0052, 0.0072),
    cone(H.point(-0.004, 0.07, 0.081), H.point(-0.012, 0.03, 0.09), 0.0052, 0.0072),
  );
  const nostrils = union(0, ell(H.sub(0.0072, 0.0215, 0.0985, 0.55, 0, 0.3), 0.0038, 0.0026, 0.0052), ell(H.sub(-0.0072, 0.0215, 0.0985, 0.55, 0, -0.3), 0.0038, 0.0026, 0.0052));
  const lips = union(0.004,
    ell(H.sub(0, 0.0045, 0.0905, -0.35, 0, 0), 0.0245, 0.0068, 0.0092),
    sph(H.sub(0, 0.0015, 0.0965), 0.0048),
    ell(H.sub(0, -0.0092, 0.0885, 0.3, 0, 0), 0.0205, 0.0072, 0.0088),
  );
  const mouthCut = union(0, box(H.sub(0, -0.0024, 0.1), 0.0235, 0.0007, 0.014, 0.0006), sph(H.sub(0.0255, -0.0015, 0.086), 0.0038), sph(H.sub(-0.0255, -0.0015, 0.086), 0.0038));
  face = union(0.006, face, subtract(nose, nostrils, 0.0018));
  face = subtract(union(0.0045, face, lips), mouthCut, 0.0016);
  face = union(0.0035, face, eyelid(H, 1, 1), eyelid(H, 1, -1), eyelid(H, -1, 1), eyelid(H, -1, -1));
  face = union(0.006, face, ear(H, 1), ear(H, -1));
  return face;
}

export function sculptNeck(H, W) {
  const p = [
    cone(H.point(0, 0.03, -0.028), H.point(0, -0.06, -0.022), 0.054, 0.057).tag({ head: 0.5, neck: 0.5 }),
    cone(H.point(0, -0.06, -0.022), W.point(0, 1.43, -0.025), 0.057, 0.066).tag({ neck: 0.8, chest: 0.2 }),
    ell(H.sub(0, -0.055, 0.045), 0.0085, 0.012, 0.0075).tag({ neck: 1 }),
    ell(H.sub(0, -0.035, 0.03), 0.042, 0.022, 0.03).tag({ head: 0.6, neck: 0.4 }),
  ];
  for (const s of [1, -1]) {
    p.push(cone(H.point(s * 0.048, 0.03, -0.03), W.point(s * 0.02, 1.445, 0.048), 0.013, 0.011).tag({ neck: 0.8, head: 0.2 }));
  }
  return p;
}

export function scalpField(x, y, z) {
  return hairlineY(x, z) - y;
}

export const headSmooth = smooth;

// Costa del Gzowo: the 82-byte state packet every player broadcasts (own character, own vehicle, damage summary) and its decoder.
export const SIZE = 82;
export const KINDS = ['convertible', 'roadster', 'heli'];
export const PARTS = ['frontBumper', 'rearBumper', 'hood', 'trunk', 'doorFL', 'doorFR'];
export const FLAG = { DRIVING: 1, RIDING: 2, VEHICLE: 4, BEAMS: 8, GROUNDED: 16, SWIM: 32, BRAKE: 64, REVERSE: 128 };
export const VFLAG = { BURNING: 1, EXPLODED: 2, ROTOR_BROKEN: 4, OCCUPIED: 8 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const i16 = (x, scale) => clamp(Math.round(x * scale), -32767, 32767);
const u8 = (x) => clamp(Math.round(x * 255), 0, 255);

export function encode(s, seq, time) {
  const buffer = new ArrayBuffer(SIZE);
  const d = new DataView(buffer);
  d.setUint8(0, 1);
  d.setUint8(1, s.flags);
  d.setUint16(2, seq & 0xffff, true);
  d.setUint32(4, time >>> 0, true);
  d.setFloat32(8, s.px, true);
  d.setFloat32(12, s.py, true);
  d.setFloat32(16, s.pz, true);
  d.setInt16(20, i16(Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw)) / Math.PI, 32767), true);
  d.setUint8(22, clamp(Math.round(s.speed * 10), 0, 255));
  d.setInt8(23, clamp(Math.round(s.vy * 4), -127, 127));
  d.setUint8(24, u8(s.wade));
  d.setUint8(25, s.host);
  d.setUint8(26, s.kind);
  d.setUint8(27, u8(s.health));
  d.setFloat32(28, s.vx, true);
  d.setFloat32(32, s.vyPos, true);
  d.setFloat32(36, s.vz, true);
  for (let i = 0; i < 4; i++) d.setInt16(40 + i * 2, i16(s.q[i], 32767), true);
  for (let i = 0; i < 3; i++) d.setInt16(48 + i * 2, i16(s.v[i], 100), true);
  for (let i = 0; i < 3; i++) d.setInt16(54 + i * 2, i16(s.w[i], 1000), true);
  d.setInt8(60, clamp(Math.round(s.steer * 127), -127, 127));
  d.setUint8(61, u8(s.throttle));
  d.setUint8(62, s.vflags);
  d.setUint8(63, u8(s.roof));
  d.setUint16(64, s.parts, true);
  for (let i = 0; i < 16; i++) d.setUint8(66 + i, s.extra[i] || 0);
  return buffer;
}

export function decode(buffer) {
  if (!buffer || buffer.byteLength !== SIZE) return null;
  const d = new DataView(buffer);
  if (d.getUint8(0) !== 1) return null;
  const extra = new Uint8Array(16);
  for (let i = 0; i < 16; i++) extra[i] = d.getUint8(66 + i);
  return {
    flags: d.getUint8(1),
    seq: d.getUint16(2, true),
    time: d.getUint32(4, true),
    px: d.getFloat32(8, true),
    py: d.getFloat32(12, true),
    pz: d.getFloat32(16, true),
    yaw: (d.getInt16(20, true) / 32767) * Math.PI,
    speed: d.getUint8(22) / 10,
    vy: d.getInt8(23) / 4,
    wade: d.getUint8(24) / 255,
    host: d.getUint8(25),
    kind: d.getUint8(26),
    health: d.getUint8(27) / 255,
    vx: d.getFloat32(28, true),
    vyPos: d.getFloat32(32, true),
    vz: d.getFloat32(36, true),
    q: [0, 1, 2, 3].map((i) => d.getInt16(40 + i * 2, true) / 32767),
    v: [0, 1, 2].map((i) => d.getInt16(48 + i * 2, true) / 100),
    w: [0, 1, 2].map((i) => d.getInt16(54 + i * 2, true) / 1000),
    steer: d.getInt8(60) / 127,
    throttle: d.getUint8(61) / 255,
    vflags: d.getUint8(62),
    roof: d.getUint8(63) / 255,
    parts: d.getUint16(64, true),
    extra,
  };
}

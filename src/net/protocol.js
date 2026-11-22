// Costa del Gzowo: the state packet every player broadcasts (own character plus every shared vehicle they currently simulate) and its decoder.
export const KINDS = ['convertible', 'roadster', 'heli', 'speedboat', 'foilboat', 'diver', 'yacht'];
export const PARTS = ['frontBumper', 'rearBumper', 'hood', 'trunk', 'doorFL', 'doorFR'];
export const FLAG = { GROUNDED: 1, SWIM: 2 };
export const VFLAG = { BURNING: 1, EXPLODED: 2, ROTOR_BROKEN: 4, OCCUPIED: 8, BEAMS: 16, BRAKE: 32, REVERSE: 64 };
const HEAD = 8;
const PLAYER = 22;
const RECORD = 48;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const i16 = (x, scale) => clamp(Math.round(x * scale), -32767, 32767);
const u8 = (x) => clamp(Math.round(x * 255), 0, 255);

export function encode(player, vehicles, seq, time) {
  const buffer = new ArrayBuffer(HEAD + PLAYER + RECORD * vehicles.length);
  const d = new DataView(buffer);
  d.setUint8(0, 2);
  d.setUint8(1, vehicles.length);
  d.setUint16(2, seq & 0xffff, true);
  d.setUint32(4, time >>> 0, true);
  let o = HEAD;
  d.setUint8(o, player.flags);
  d.setUint8(o + 1, player.seat);
  d.setUint8(o + 2, player.vehicle);
  d.setUint8(o + 3, clamp(Math.round(player.speed * 10), 0, 255));
  d.setFloat32(o + 4, player.x, true);
  d.setFloat32(o + 8, player.y, true);
  d.setFloat32(o + 12, player.z, true);
  d.setInt16(o + 16, i16(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) / Math.PI, 32767), true);
  d.setInt8(o + 18, clamp(Math.round(player.vy * 4), -127, 127));
  d.setUint8(o + 19, u8(player.wade));
  d.setInt8(o + 20, clamp(Math.round(player.steer * 127), -127, 127));
  d.setUint8(o + 21, u8(player.throttle));
  o += PLAYER;
  for (const v of vehicles) {
    d.setUint8(o, v.index);
    d.setUint8(o + 1, v.vflags);
    d.setUint8(o + 2, u8(v.health));
    d.setUint8(o + 3, u8(v.roof));
    for (let i = 0; i < 3; i++) d.setFloat32(o + 4 + i * 4, v.p[i], true);
    for (let i = 0; i < 4; i++) d.setInt16(o + 16 + i * 2, i16(v.q[i], 32767), true);
    for (let i = 0; i < 3; i++) d.setInt16(o + 24 + i * 2, i16(v.v[i], 100), true);
    for (let i = 0; i < 3; i++) d.setInt16(o + 30 + i * 2, i16(v.w[i], 1000), true);
    d.setInt8(o + 36, clamp(Math.round(v.steer * 127), -127, 127));
    d.setUint8(o + 37, u8(v.throttle));
    d.setUint16(o + 38, v.parts, true);
    for (let i = 0; i < 8; i++) d.setUint8(o + 40 + i, v.extra[i] || 0);
    o += RECORD;
  }
  return buffer;
}

export function decode(buffer) {
  if (!buffer || buffer.byteLength < HEAD + PLAYER) return null;
  const d = new DataView(buffer);
  const count = d.getUint8(1);
  if (d.getUint8(0) !== 2 || buffer.byteLength !== HEAD + PLAYER + RECORD * count) return null;
  const time = d.getUint32(4, true);
  let o = HEAD;
  const player = {
    time, flags: d.getUint8(o), seat: d.getUint8(o + 1), vehicle: d.getUint8(o + 2), speed: d.getUint8(o + 3) / 10,
    x: d.getFloat32(o + 4, true), y: d.getFloat32(o + 8, true), z: d.getFloat32(o + 12, true), yaw: (d.getInt16(o + 16, true) / 32767) * Math.PI,
    vy: d.getInt8(o + 18) / 4, wade: d.getUint8(o + 19) / 255, steer: d.getInt8(o + 20) / 127, throttle: d.getUint8(o + 21) / 255,
  };
  o += PLAYER;
  const vehicles = [];
  for (let n = 0; n < count; n++) {
    const extra = new Uint8Array(8);
    for (let i = 0; i < 8; i++) extra[i] = d.getUint8(o + 40 + i);
    vehicles.push({
      time, index: d.getUint8(o), vflags: d.getUint8(o + 1), health: d.getUint8(o + 2) / 255, roof: d.getUint8(o + 3) / 255,
      p: [0, 1, 2].map((i) => d.getFloat32(o + 4 + i * 4, true)), q: [0, 1, 2, 3].map((i) => d.getInt16(o + 16 + i * 2, true) / 32767),
      v: [0, 1, 2].map((i) => d.getInt16(o + 24 + i * 2, true) / 100), w: [0, 1, 2].map((i) => d.getInt16(o + 30 + i * 2, true) / 1000),
      steer: d.getInt8(o + 36) / 127, throttle: d.getUint8(o + 37) / 255, parts: d.getUint16(o + 38, true), extra,
    });
    o += RECORD;
  }
  return { time, seq: d.getUint16(2, true), player, vehicles };
}

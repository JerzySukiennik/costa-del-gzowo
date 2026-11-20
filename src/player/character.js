// Riverside: hand-built humanoid with procedural animation (idle, walk, run, jump, fall, swim, drive).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hookMaterial } from '../render/shaderHooks.js';

const DIM = { hip: 0.93, torso: 0.5, shoulder: 0.19, hipHalf: 0.095, upperArm: 0.29, forearm: 0.26, thigh: 0.44, shin: 0.43 };

function limb(radiusTop, radiusBottom, length, segments = 12) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments, 1);
  geo.translate(0, -length / 2, 0);
  return geo;
}

function ball(r, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) {
  const geo = new THREE.SphereGeometry(r, 16, 12);
  geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  return geo;
}

export async function createCharacter(ctx) {
  const { assets, lighting } = ctx;
  const denim = await assets.pbr('denim_fabric', { repeat: 2 });
  const make = (params, key) => {
    const m = hookMaterial(new THREE.MeshStandardMaterial(params), { key: 'character-' + key, dynamic: true });
    lighting.register(m);
    return m;
  };
  const skin = make({ color: 0xb98562, roughness: 0.58 }, 'skin');
  const shirt = make({ color: 0xe9e6dc, roughness: 0.9 }, 'cloth');
  const shorts = make({ ...denim, color: 0x9fb0c8, roughness: 0.95 }, 'denim');
  shorts.metalnessMap = null;
  const shoe = make({ color: 0xf2f1ec, roughness: 0.6 }, 'cloth');
  const sole = make({ color: 0x1a1a1a, roughness: 0.8 }, 'cloth');
  const hair = make({ color: 0x1c130d, roughness: 0.75 }, 'cloth');
  const shades = make({ color: 0x050505, roughness: 0.12, metalness: 0.4 }, 'cloth');

  const root = new THREE.Group();
  root.name = 'player';
  const mesh = (geo, mat, parent, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const joint = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const hips = joint(root, 0, DIM.hip, 0);
  mesh(ball(0.16, 1.1, 0.74, 0.8, 0, 0.02, 0), shorts, hips);
  const spine = joint(hips, 0, 0.06, 0);
  const torsoProfile = [[0.118, 0], [0.128, 0.1], [0.15, 0.25], [0.168, 0.36], [0.16, 0.43], [0.09, 0.475], [0.055, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(torsoProfile, 18);
  torso.scale(1.17, 1, 0.7);
  mesh(torso, shirt, spine);
  const neck = joint(spine, 0, DIM.torso - 0.02, 0);
  mesh(limb(0.05, 0.06, 0.1).translate(0, 0.09, 0), skin, neck);
  const head = joint(neck, 0, 0.1, 0);
  mesh(ball(0.1, 0.9, 1.14, 1.0, 0, 0.1, 0.008), skin, head);
  mesh(ball(0.104, 0.93, 1.02, 1.02, 0, 0.125, -0.014), hair, head).geometry.computeVertexNormals();
  const fringe = new THREE.SphereGeometry(0.106, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
  fringe.scale(0.94, 0.9, 1.04);
  fringe.translate(0, 0.142, 0.004);
  mesh(fringe, hair, head, false);
  mesh(new RoundedBoxGeometry(0.165, 0.038, 0.03, 2, 0.012).translate(0, 0.118, 0.088), shades, head, false);
  mesh(ball(0.016, 1, 1.3, 1.2, 0, 0.082, 0.103), skin, head, false);
  for (const s of [-1, 1]) mesh(ball(0.02, 0.5, 1.2, 0.9, s * 0.09, 0.1, 0), skin, head, false);

  const arms = {};
  const legs = {};
  for (const [tag, s] of [['L', 1], ['R', -1]]) {
    const shoulder = joint(spine, s * DIM.shoulder, DIM.torso - 0.075, 0);
    mesh(ball(0.07, 1, 0.9, 0.95), shirt, shoulder, false);
    mesh(limb(0.066, 0.057, 0.14), shirt, shoulder, false);
    mesh(limb(0.052, 0.044, DIM.upperArm), skin, shoulder);
    const elbow = joint(shoulder, 0, -DIM.upperArm, 0);
    mesh(ball(0.045), skin, elbow, false);
    mesh(limb(0.046, 0.033, DIM.forearm), skin, elbow);
    const wrist = joint(elbow, 0, -DIM.forearm, 0);
    mesh(new RoundedBoxGeometry(0.075, 0.105, 0.032, 2, 0.014).translate(0, -0.055, 0), skin, wrist);
    arms[tag] = { shoulder, elbow, wrist, side: s };

    const hip = joint(hips, s * DIM.hipHalf, -0.03, 0);
    mesh(limb(0.098, 0.084, 0.28), shorts, hip, false);
    mesh(limb(0.084, 0.06, DIM.thigh), skin, hip);
    const knee = joint(hip, 0, -DIM.thigh, 0);
    mesh(ball(0.06), skin, knee, false);
    mesh(limb(0.062, 0.042, DIM.shin), skin, knee);
    mesh(ball(0.05, 1, 2.3, 1.05, 0, -0.14, -0.012), skin, knee);
    const ankle = joint(knee, 0, -DIM.shin, 0);
    mesh(new RoundedBoxGeometry(0.098, 0.08, 0.27, 3, 0.03).translate(0, -0.015, 0.065), shoe, ankle);
    mesh(new RoundedBoxGeometry(0.1, 0.022, 0.275, 2, 0.008).translate(0, -0.052, 0.065), sole, ankle, false);
    mesh(limb(0.046, 0.043, 0.07).translate(0, 0.045, 0), shoe, ankle, false);
    legs[tag] = { hip, knee, ankle, side: s };
  }

  const pose = { hipsY: DIM.hip, hipsPitch: 0, hipsRoll: 0, spinePitch: 0, spineTwist: 0, headPitch: 0, headYaw: 0 };
  for (const t of ['L', 'R']) Object.assign(pose, { ['arm' + t]: 0, ['armOut' + t]: 0.08, ['elbow' + t]: 0.15, ['leg' + t]: 0, ['legOut' + t]: 0, ['knee' + t]: 0, ['foot' + t]: 0 });
  const current = { ...pose };
  let phase = 0;
  let idle = 0;

  function target(s, dt) {
    const p = pose;
    idle += dt;
    const breathe = Math.sin(idle * 1.6) * 0.012;
    Object.assign(p, { hipsY: DIM.hip, hipsPitch: 0, hipsRoll: 0, spinePitch: breathe, spineTwist: 0, headPitch: 0, headYaw: 0 });
    for (const t of ['L', 'R']) Object.assign(p, { ['arm' + t]: 0, ['armOut' + t]: 0.09, ['elbow' + t]: 0.16, ['leg' + t]: 0, ['legOut' + t]: 0.02, ['knee' + t]: 0.02, ['foot' + t]: 0 });
    if (s.mode === 'sit') {
      p.hipsY = 0;
      p.hipsPitch = -0.16;
      p.spinePitch = 0.1;
      for (const [t, sign] of [['L', 1], ['R', -1]]) {
        p['leg' + t] = -1.36;
        p['legOut' + t] = 0.1;
        p['knee' + t] = 1.05 + (t === 'R' ? s.throttle * -0.12 : 0);
        p['foot' + t] = 0.25;
        p['arm' + t] = -0.56 - sign * s.steer * 0.28;
        p['armOut' + t] = 0.2;
        p['elbow' + t] = 1.38 + sign * s.steer * 0.22;
      }
      p.headYaw = -s.steer * 0.5;
      return 9;
    }
    if (s.mode === 'swim') {
      const moving = s.speed > 0.3;
      phase += dt * (moving ? 4.4 + s.speed : 2.6);
      if (moving) {
        p.hipsPitch = 1.18;
        p.spinePitch = -0.22;
        p.headPitch = -0.75;
        for (const [t, off] of [['L', 0], ['R', Math.PI]]) {
          const c = phase * 0.5 + off;
          p['arm' + t] = -1.75 + Math.cos(c) * 1.45;
          p['armOut' + t] = 0.22 + Math.max(0, Math.sin(c)) * 0.5;
          p['elbow' + t] = 0.25 + Math.max(0, -Math.sin(c)) * 0.9;
          p['leg' + t] = Math.sin(phase * 1.6 + off) * 0.34;
          p['knee' + t] = 0.22 + Math.max(0, Math.sin(phase * 1.6 + off + 1)) * 0.4;
          p['foot' + t] = 0.9;
        }
      } else {
        p.hipsPitch = 0.12;
        for (const [t, off] of [['L', 0], ['R', Math.PI]]) {
          p['arm' + t] = -0.5 + Math.sin(phase + off) * 0.25;
          p['armOut' + t] = 0.95 + Math.cos(phase + off) * 0.2;
          p['elbow' + t] = 0.6;
          p['leg' + t] = Math.sin(phase * 1.3 + off) * 0.42;
          p['knee' + t] = 0.5 + Math.sin(phase * 1.3 + off + 1.2) * 0.3;
          p['foot' + t] = 0.7;
        }
      }
      return 7;
    }
    if (s.mode === 'air') {
      const falling = s.vy < -3;
      const flail = falling ? Math.sin(idle * 13) : 0;
      p.spinePitch = falling ? 0.14 : -0.06;
      for (const [t, sign] of [['L', 1], ['R', -1]]) {
        p['arm' + t] = falling ? -0.5 + flail * sign * 0.5 : -0.5;
        p['armOut' + t] = falling ? 1.25 + flail * 0.25 : 0.5;
        p['elbow' + t] = falling ? 0.35 : 0.7;
        p['leg' + t] = sign > 0 ? -0.55 : 0.12 + (falling ? flail * 0.2 : 0);
        p['knee' + t] = sign > 0 ? 0.95 : 0.4;
      }
      return 10;
    }
    if (s.speed > 0.25) {
      const run = THREE.MathUtils.clamp((s.speed - 2.2) / 3.2, 0, 1);
      const stride = THREE.MathUtils.lerp(1.45, 2.7, run);
      phase += (s.speed / stride) * Math.PI * 2 * dt;
      const swing = THREE.MathUtils.lerp(0.48, 0.86, run) * Math.min(1, s.speed / 1.4);
      p.hipsY = DIM.hip - 0.022 - run * 0.025 + Math.abs(Math.cos(phase)) * (0.028 + run * 0.035) - s.wade * 0.03;
      p.hipsPitch = 0.05 + run * 0.2;
      p.hipsRoll = Math.sin(phase) * 0.04;
      p.spineTwist = Math.sin(phase) * (0.1 + run * 0.14);
      p.spinePitch = run * 0.08;
      for (const [t, off] of [['L', 0], ['R', Math.PI]]) {
        const c = phase + off;
        p['leg' + t] = -Math.sin(c) * swing - run * 0.12;
        p['knee' + t] = 0.08 + Math.max(0, Math.cos(c - 0.35)) * (0.75 + run * 0.85);
        p['foot' + t] = -Math.sin(c) * 0.25;
        p['arm' + t] = Math.sin(c) * (0.42 + run * 0.6);
        p['elbow' + t] = 0.22 + run * 1.15 + Math.max(0, Math.sin(c)) * 0.22;
        p['armOut' + t] = 0.1 + run * 0.06;
      }
      return 16;
    }
    phase = 0;
    p.spineTwist = Math.sin(idle * 0.4) * 0.03;
    p.headYaw = Math.sin(idle * 0.31) * 0.12;
    p.hipsRoll = Math.sin(idle * 0.5) * 0.012;
    return 8;
  }

  function apply() {
    const c = current;
    hips.position.y = c.hipsY;
    hips.rotation.set(c.hipsPitch, 0, c.hipsRoll);
    spine.rotation.set(c.spinePitch, c.spineTwist, -c.hipsRoll * 0.6);
    head.rotation.set(c.headPitch, c.headYaw, 0);
    for (const t of ['L', 'R']) {
      const a = arms[t];
      const l = legs[t];
      a.shoulder.rotation.set(c['arm' + t], 0, a.side * c['armOut' + t]);
      a.elbow.rotation.set(-c['elbow' + t], 0, 0);
      l.hip.rotation.set(c['leg' + t], 0, l.side * c['legOut' + t]);
      l.knee.rotation.set(c['knee' + t], 0, 0);
      l.ankle.rotation.set(c['foot' + t], 0, 0);
    }
  }
  apply();

  return {
    group: root,
    height: 1.8,
    update(dt, s) {
      const rate = target(s, dt);
      const k = 1 - Math.exp(-rate * dt);
      for (const key in pose) current[key] += (pose[key] - current[key]) * k;
      apply();
    },
    snap(s) {
      target(s, 0);
      Object.assign(current, pose);
      apply();
    },
  };
}

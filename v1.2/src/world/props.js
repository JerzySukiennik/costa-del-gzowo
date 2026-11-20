// Costa del Gzowo: roadside props (cones, barriers, signs, road-closed ends, pull-off clutter, buoys, utility poles) with physics.
import * as THREE from 'three';
import { BRIDGE, ROAD, WORLD } from '../config.js';
import { GROUPS, groups } from '../core/physics.js';
import { heightAt, roadY } from './heightfield.js';
import { extrudeX, box, placed, merge, solid } from './geometry.js';
import { variantsOf, rng } from './scatter.js';
import { BRIDGE_LEVELS } from './bridge.js';

function signTexture(draw, w = 256, h = 320) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  draw(g, w, h);
  const noise = g.getImageData(0, 0, w, h);
  let s = 9;
  for (let i = 0; i < noise.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const d = ((s >>> 24) / 255 - 0.5) * 14;
    noise.data[i] += d;
    noise.data[i + 1] += d;
    noise.data[i + 2] += d;
  }
  g.putImageData(noise, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function plate(g, w, h, fill, stroke) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 18);
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = stroke;
  g.beginPath();
  g.roundRect(13, 13, w - 26, h - 26, 12);
  g.stroke();
}

function text(g, lines, w, color, font = 'bold 44px "Helvetica Neue", Arial, sans-serif') {
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [str, y, f] of lines) {
    g.font = f || font;
    g.fillText(str, w / 2, y);
  }
}

function stripeTexture() {
  return signTexture((g, w, h) => {
    g.fillStyle = '#e8e4da';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e2661a';
    for (let x = -h; x < w + h; x += 64) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 32, h);
      g.lineTo(x + 32 + h, 0);
      g.lineTo(x + h, 0);
      g.closePath();
      g.fill();
    }
  }, 512, 64);
}

function coneGeometry() {
  const pts = [[0.03, 0.72], [0.045, 0.7], [0.15, 0.05], [0.17, 0.045], [0.17, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(pts.reverse(), 20);
  const base = placed(new THREE.BoxGeometry(0.38, 0.035, 0.38), 0, 0.0175, 0);
  return { body, base };
}

export async function createProps(ctx) {
  const { assets, lighting, physics, scene } = ctx;
  const R = physics.RAPIER;
  const names = ['concrete_road_barrier', 'concrete_road_barrier_02', 'old_tyre', 'metal_trash_can', 'lateral_sea_marker', 'Barrel_01', 'cement_bag', 'trashbag', 'utility_box_01'];
  const loaded = await Promise.all(names.map((n) => assets.model(n)));
  const model = Object.fromEntries(names.map((n, i) => [n, variantsOf(loaded[i])]));
  Object.values(model).forEach((list) => list.forEach((v) => v.parts.forEach((p) => lighting.register(p.material))));
  const woodMaps = await assets.pbr('bark_willow');

  const group = new THREE.Group();
  group.name = 'props';
  const dynamics = [];
  const random = rng(808);
  const mats = {
    orange: new THREE.MeshStandardMaterial({ color: 0xd9571a, roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }),
    post: new THREE.MeshStandardMaterial({ color: 0x8a8e90, roughness: 0.5, metalness: 0.8 }),
    signBack: new THREE.MeshStandardMaterial({ color: 0x9a9c9c, roughness: 0.45, metalness: 0.7 }),
    pole: new THREE.MeshStandardMaterial({ ...woodMaps, color: 0x6a5a4c, roughness: 1 }),
    wire: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }),
    rebar: new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.85, metalness: 0.4 }),
    rubble: new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 1 }),
    stripes: new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.5 }),
  };
  mats.pole.metalnessMap = null;
  Object.values(mats).forEach((m) => lighting.register(m));

  function addDynamic(object, x, y, z, yaw, desc, mass, kind, extra = {}) {
    object.position.set(x, y, z);
    object.rotation.y = yaw;
    group.add(object);
    const q = new THREE.Quaternion().setFromEuler(object.rotation);
    const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q).setLinearDamping(0.08).setAngularDamping(0.35).setCanSleep(true));
    const collider = physics.world.createCollider(desc.setMass(mass).setFriction(extra.friction ?? 0.7).setRestitution(extra.restitution ?? 0.12).setCollisionGroups(groups(GROUPS.PROP, 0xffff)).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(mass * 30), body);
    physics.surfaces.set(collider.handle, kind);
    body.sleep();
    const entry = { object, body, collider, kind, mass, buoyancy: extra.buoyancy ?? 1.2, wasWet: false };
    dynamics.push(entry);
    return entry;
  }

  const fromVariant = (variant, scale = 1) => {
    const holder = new THREE.Group();
    for (const part of variant.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.scale.setScalar(scale);
      holder.add(mesh);
    }
    return holder;
  };

  const cone = coneGeometry();
  const coneBand = placed(new THREE.CylinderGeometry(0.083, 0.112, 0.16, 20, 1, true), 0, 0.38, 0);
  function addCone(x, z, y) {
    const holder = new THREE.Group();
    const a = new THREE.Mesh(cone.body, mats.orange);
    const b = new THREE.Mesh(cone.base, mats.black);
    const c = new THREE.Mesh(coneBand, mats.white);
    for (const m of [a, b, c]) {
      m.castShadow = m.receiveShadow = true;
      holder.add(m);
    }
    const inner = new THREE.Group();
    inner.add(a, b, c);
    inner.position.y = -0.36;
    holder.add(inner);
    addDynamic(holder, x, y + 0.36, z, random() * 6.28, R.ColliderDesc.cone(0.36, 0.19), 3.2, 'plastic', { restitution: 0.3 });
  }

  const jersey = [[-0.3, 0], [0.3, 0], [0.3, 0.13], [0.13, 0.36], [0.09, 0.9], [-0.09, 0.9], [-0.13, 0.36], [-0.3, 0.13]];
  const jerseyGeo = extrudeX(jersey.map(([z, y]) => [z, y - 0.45]), -0.95, 0.95, { uv: 1 });
  function addPlasticBarrier(x, z, y, yaw, material) {
    const mesh = new THREE.Mesh(jerseyGeo, material);
    mesh.castShadow = mesh.receiveShadow = true;
    addDynamic(mesh, x, y + 0.45, z, yaw, R.ColliderDesc.cuboid(0.95, 0.45, 0.22), 58, 'plastic');
  }

  const side = BRIDGE.gapSide;
  const walkY = BRIDGE_LEVELS.WALK_Y;
  const gx0 = BRIDGE.gapX[0];
  const gx1 = BRIDGE.gapX[1];
  addPlasticBarrier(gx0 + 0.4, side * 5.1, walkY, 0.5 * side, mats.orange);
  addPlasticBarrier(gx1 - 0.3, side * 5.15, walkY, -0.42 * side, mats.white);
  addCone(gx0 + 2.2, side * 4.85, walkY);
  addCone(gx1 - 2.3, side * 4.8, walkY);
  addCone(gx0 - 1.2, side * 4.2, roadY(0) - 0.07);
  addCone(gx1 + 1.4, side * 4.25, roadY(0) - 0.07);
  addCone((gx0 + gx1) / 2, side * 4.15, roadY(0) - 0.07);

  const statics = [];
  const rebar = [];
  const rubble = [];
  for (const gx of [gx0, gx1]) {
    for (let k = 0; k < 5; k++) {
      const len = 0.18 + random() * 0.3;
      const dir = gx === gx0 ? 1 : -1;
      rebar.push(placed(new THREE.CylinderGeometry(0.008, 0.008, len, 6), gx + dir * len * 0.45, walkY + 0.08 + k * 0.08, side * (BRIDGE.deckHalfWidth - 0.08 - random() * 0.2), 0, 0, Math.PI / 2 + (random() - 0.5) * 0.7));
    }
  }
  for (let k = 0; k < 26; k++) {
    const s = 0.03 + random() * random() * 0.14;
    rubble.push(placed(new THREE.DodecahedronGeometry(s, 0), gx0 + random() * (gx1 - gx0), walkY + s * 0.5, side * (BRIDGE.deckHalfWidth - 0.05 - random() * 1.1), random() * 3, random() * 3, random() * 3));
  }
  group.add(solid(rebar, mats.rebar), solid(rubble, mats.rubble));

  function addSign(x, z, yaw, texture, w, h, height, baseY) {
    const y0 = baseY ?? heightAt(x, z);
    const holder = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, height + h, 0.035), mats.post);
    post.position.y = (height + h) / 2 - 0.3;
    const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), [mats.signBack, mats.signBack, mats.signBack, mats.signBack, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42 }), mats.signBack]);
    lighting.register(face.material[4]);
    face.position.set(0, height + h / 2, 0.026);
    for (const m of [post, face]) {
      m.castShadow = m.receiveShadow = true;
      holder.add(m);
    }
    holder.position.set(x, y0, z);
    holder.rotation.y = yaw;
    holder.updateMatrixWorld(true);
    group.add(holder);
    physics.staticCylinder(x, y0, y0 + height + h, z, 0.05, 'metal');
  }

  const speed = signTexture((g, w, h) => {
    plate(g, w, h, '#ece9e1', '#111');
    text(g, [['SPEED', 62], ['LIMIT', 112], ['45', 226, 'bold 150px "Helvetica Neue", Arial, sans-serif']], w, '#111');
  });
  const closed = signTexture((g, w, h) => {
    plate(g, w, h, '#e0701c', '#111');
    text(g, [['SIDEWALK', 70, 'bold 40px "Helvetica Neue", Arial, sans-serif'], ['CLOSED', 122, 'bold 46px "Helvetica Neue", Arial, sans-serif'], ['AHEAD', 176, 'bold 40px "Helvetica Neue", Arial, sans-serif']], w, '#111');
  }, 256, 240);
  const river = signTexture((g, w, h) => {
    plate(g, w, h, '#1c5f3a', '#eee');
    text(g, [['SAWGRASS', 46, 'bold 46px "Helvetica Neue", Arial, sans-serif'], ['RIVER', 100, 'bold 46px "Helvetica Neue", Arial, sans-serif']], w, '#f2f2ee');
  }, 384, 144);
  const noFish = signTexture((g, w, h) => {
    plate(g, w, h, '#ece9e1', '#111');
    text(g, [['NO', 56, 'bold 50px "Helvetica Neue", Arial, sans-serif'], ['FISHING', 112, 'bold 46px "Helvetica Neue", Arial, sans-serif'], ['FROM', 164, 'bold 40px "Helvetica Neue", Arial, sans-serif'], ['BRIDGE', 216, 'bold 46px "Helvetica Neue", Arial, sans-serif']], w, '#111');
  }, 256, 272);
  const roadClosed = signTexture((g, w, h) => {
    plate(g, w, h, '#ece9e1', '#111');
    text(g, [['ROAD', 56, 'bold 64px "Helvetica Neue", Arial, sans-serif'], ['CLOSED', 122, 'bold 64px "Helvetica Neue", Arial, sans-serif']], w, '#111');
  }, 384, 176);

  const zSign = ROAD.halfWidth + 2.6;
  addSign(-96, zSign, -Math.PI / 2, speed, 0.61, 0.76, 2.1);
  addSign(96, -zSign, Math.PI / 2, speed, 0.61, 0.76, 2.1);
  addSign(-58, zSign, -Math.PI / 2, river, 1.2, 0.45, 2.2);
  addSign(58, -zSign, Math.PI / 2, river, 1.2, 0.45, 2.2);
  addSign(-51.5, -zSign + 0.6, -Math.PI / 2, noFish, 0.5, 0.53, 1.9);
  addSign(gx0 - 3.2, side * 5.6, -Math.PI / 2, closed, 0.6, 0.56, 1.0, walkY);

  const barrierA = model.concrete_road_barrier[0];
  const barrierB = model.concrete_road_barrier_02[0];
  for (const sx of [-1, 1]) {
    const x = sx * 238;
    const y = roadY(x);
    [-3.4, 0, 3.4].forEach((z, i) => {
      const variant = i === 1 ? barrierB : barrierA;
      const scale = 3.1 / Math.max(variant.size.x, variant.size.z);
      const holder = fromVariant(variant, scale);
      const alongX = variant.size.x > variant.size.z;
      holder.position.set(x + (random() - 0.5) * 0.4, y - 0.08, z);
      holder.rotation.y = (alongX ? Math.PI / 2 : 0) + (random() - 0.5) * 0.14;
      holder.updateMatrixWorld(true);
      group.add(holder);
      physics.staticBox(x - 0.33, x + 0.33, y - 0.1, y + variant.size.y * scale - 0.1, z - 1.55, z + 1.55, 'concrete');
    });
    const board = new THREE.Group();
    const parts = [];
    for (const yy of [0.55, 0.95, 1.35]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 0.025), mats.stripes);
      m.position.set(0, yy - 0.75, 0);
      parts.push(m);
    }
    for (const xx of [-0.95, 0.95]) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.05), mats.white);
      up.position.set(xx, 0, -0.04);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.9), mats.white);
      foot.position.set(xx, -0.73, -0.04);
      parts.push(up, foot);
    }
    for (const m of parts) {
      m.castShadow = m.receiveShadow = true;
      board.add(m);
    }
    addDynamic(board, x - sx * 5.5, y + 0.76, 0.4, Math.PI / 2 + 0.08, R.ColliderDesc.cuboid(1.15, 0.75, 0.3), 22, 'wood');
    addSign(x - sx * 5.2, 3.4, sx > 0 ? Math.PI / 2 : -Math.PI / 2, roadClosed, 0.95, 0.44, 1.25, y - 0.1);
    for (const z of [-3.0, 2.2, -1.1]) {
      const variant = model.Barrel_01[0];
      const holder = fromVariant(variant);
      const inner = holder.children[0];
      inner.position.y = -variant.size.y / 2;
      addDynamic(holder, x - sx * (8.5 + random() * 2.5), y + variant.size.y / 2 - 0.05, z, random() * 6.28, R.ColliderDesc.cylinder(variant.size.y / 2, variant.size.x / 2), 18, 'metal', { restitution: 0.25 });
    }
    for (let k = 0; k < 4; k++) addCone(x - sx * (12 + k * 3.2), (k % 2 ? -1 : 1) * (0.6 + random() * 3.2), y - 0.05);
  }

  const p = ROAD.pullOff;
  const groundY = (x, z) => heightAt(x, z);
  {
    const can = model.metal_trash_can;
    const canVariant = can.reduce((a, b) => (b.size.y > a.size.y ? b : a));
    const holder = fromVariant(canVariant);
    holder.children.forEach((c) => (c.position.y = -canVariant.size.y / 2));
    const x = p.x1 - 3.5;
    const z = p.z1 - 1.2;
    addDynamic(holder, x, groundY(x, z) + canVariant.size.y / 2, z, 0.6, R.ColliderDesc.cylinder(canVariant.size.y / 2, Math.max(canVariant.size.x, canVariant.size.z) / 2), 9, 'metal', { restitution: 0.2 });
    const tyre = model.old_tyre[0];
    [[p.x0 + 2.2, p.z1 - 0.6], [p.x0 + 2.9, p.z1 - 0.2], [p.x0 + 1.4, p.z1 + 0.6]].forEach(([tx, tz], i) => {
      const t = fromVariant(tyre);
      const flat = tyre.size.y < tyre.size.x;
      const thick = flat ? tyre.size.y : Math.min(tyre.size.x, tyre.size.z);
      const radius = Math.max(tyre.size.x, tyre.size.z, tyre.size.y) / 2;
      t.children.forEach((c) => (c.position.y = -tyre.size.y / 2));
      const desc = flat ? R.ColliderDesc.cylinder(thick / 2, radius) : R.ColliderDesc.cuboid(tyre.size.x / 2, tyre.size.y / 2, tyre.size.z / 2);
      addDynamic(t, tx, groundY(tx, tz) + tyre.size.y / 2 + i * 0.02, tz, random() * 6.28, desc, 9, 'rubber', { restitution: 0.45 });
    });
    const bag = model.cement_bag[0];
    [[p.x1 - 6.2, p.z1 - 0.9, 0.2], [p.x1 - 6.0, p.z1 - 0.2, 1.3]].forEach(([bx, bz, yaw]) => {
      const b = fromVariant(bag);
      b.children.forEach((c) => (c.position.y = -bag.size.y / 2));
      addDynamic(b, bx, groundY(bx, bz) + bag.size.y / 2, bz, yaw, R.ColliderDesc.cuboid(bag.size.x / 2, bag.size.y / 2, bag.size.z / 2), 25, 'soft', { restitution: 0.02, buoyancy: 0.3 });
    });
    const trash = model.trashbag[0];
    const tb = fromVariant(trash);
    tb.children.forEach((c) => (c.position.y = -trash.size.y / 2));
    addDynamic(tb, x + 0.9, groundY(x + 0.9, z + 0.3) + trash.size.y / 2, z + 0.3, 1.1, R.ColliderDesc.ball(Math.min(trash.size.x, trash.size.y, trash.size.z) / 2), 4, 'soft', { restitution: 0.05 });
    const ub = model.utility_box_01[0];
    const u = fromVariant(ub);
    const ux = -64;
    const uz = -(ROAD.halfWidth + 3.4);
    u.position.set(ux, groundY(ux, uz) - 0.03, uz);
    u.rotation.y = Math.PI;
    u.updateMatrixWorld(true);
    group.add(u);
    physics.staticBox(ux - ub.size.x / 2, ux + ub.size.x / 2, u.position.y, u.position.y + ub.size.y, uz - ub.size.z / 2, uz + ub.size.z / 2, 'metal');
  }

  const buoys = [];
  for (const [bx, bz] of [[5, 64], [-9, -70]]) {
    const variant = model.lateral_sea_marker[0];
    const holder = fromVariant(variant, 0.8);
    holder.position.set(bx, 0, bz);
    group.add(holder);
    buoys.push({ holder, x: bx, z: bz, phase: random() * 6, sink: variant.size.y * 0.8 * 0.2 });
  }

  const poleParts = [];
  const wireParts = [];
  const zPole = -(ROAD.halfWidth + 9.5);
  const poleXs = [-246, -200, -154, -108, -62, 62, 108, 154, 200, 246];
  const tops = poleXs.map((x) => {
    const base = heightAt(x, zPole);
    poleParts.push(placed(new THREE.CylinderGeometry(0.11, 0.16, 10.4, 10), x, base + 5.0, zPole));
    poleParts.push(placed(new THREE.BoxGeometry(0.1, 0.12, 2.3), x, base + 9.5, zPole));
    poleParts.push(placed(new THREE.CylinderGeometry(0.21, 0.21, 0.7, 12), x + 0.22, base + 8.5, zPole));
    physics.staticCylinder(x, base - 0.5, base + 10, zPole, 0.16, 'wood');
    return new THREE.Vector3(x, base + 9.62, zPole);
  });
  for (let i = 0; i < tops.length - 1; i++) {
    for (const dz of [-1.0, 0, 1.0]) {
      const a = tops[i].clone();
      const b = tops[i + 1].clone();
      a.z += dz;
      b.z += dz;
      const span = a.distanceTo(b);
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= span * 0.026 + (span > 100 ? 1.6 : 0);
      const curve = new THREE.QuadraticBezierCurve3(a, mid.clone().multiplyScalar(2).sub(a.clone().add(b).multiplyScalar(0.5)), b);
      wireParts.push(new THREE.TubeGeometry(curve, span > 100 ? 40 : 14, 0.014, 4, false));
    }
  }
  group.add(solid(poleParts, mats.pole));
  group.add(solid(wireParts, mats.wire, { receive: false }));

  group.updateMatrixWorld(true);
  scene.add(group);

  const v = new THREE.Vector3();
  return {
    group,
    dynamics,
    update(dt, elapsed, water) {
      for (const d of dynamics) {
        if (d.body.isSleeping()) continue;
        const t = d.body.translation();
        const r = d.body.rotation();
        d.object.position.set(t.x, t.y, t.z);
        d.object.quaternion.set(r.x, r.y, r.z, r.w);
        const level = water ? water.getHeightAt(t.x, t.z) : WORLD.waterLevel;
        const wet = t.y < level + 0.15 && heightAt(t.x, t.z) < level;
        if (wet) {
          const depth = Math.min(1, (level + 0.15 - t.y) / 0.5);
          const vel = d.body.linvel();
          d.body.applyImpulse({ x: -vel.x * d.mass * 1.6 * dt, y: (9.81 * d.mass * d.buoyancy * depth - vel.y * d.mass * 2.5) * dt, z: (-vel.z * 1.6 + 0.5) * d.mass * dt }, true);
          const av = d.body.angvel();
          d.body.setAngvel({ x: av.x * 0.97, y: av.y * 0.97, z: av.z * 0.97 }, true);
          if (!d.wasWet && water) water.splash({ position: v.set(t.x, level, t.z), velocity: new THREE.Vector3(vel.x, vel.y, vel.z), radius: 0.35, mass: d.mass, kind: 'debris' });
        }
        d.wasWet = wet;
      }
      for (const b of buoys) {
        const level = water ? water.getHeightAt(b.x, b.z) : WORLD.waterLevel;
        b.holder.position.y = level - b.sink + Math.sin(elapsed * 1.3 + b.phase) * 0.03;
        b.holder.rotation.x = Math.sin(elapsed * 0.9 + b.phase) * 0.05;
        b.holder.rotation.z = Math.cos(elapsed * 0.7 + b.phase * 1.7) * 0.06;
      }
    },
  };
}

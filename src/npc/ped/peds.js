// Costa del Gzowo: the pedestrians (population around the player, destinations and dwell, crossings, avoidance, reactions to the player, vehicles, aircraft and crashes, knock-downs, level of detail, colliders).
import * as THREE from 'three';
import { GROUPS, groups } from '../../core/physics.js';
import { seeded, clamp, sstep, wrap } from '../util.js';
import { createPedMaterial, applyLook } from './material.js';
import { createPedRig } from './rig.js';
import { createPedAnimator, ACT } from './animator.js';
import { createPedGraph } from './graph.js';

const S = { WALK: 0, DWELL: 1, SIT_IN: 2, SIT: 3, SIT_OUT: 4, MEET: 5, TALK: 6, WAIT: 7, FLEE: 8, RECOVER: 9, DOWN: 10, RISE: 11, WATCH: 12 };
const MAX = 40;
const NEAR = 16;
const HIDE = 120;
const BODIES = 10;
const SEAT = 0.46;
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const AXIS = new THREE.Vector3();

export function createPeds(ctx, play, world, pack) {
  const { scene, camera, physics } = ctx;
  const R = physics.RAPIER;
  const graph = createPedGraph();
  world.crossings = graph.crossings;
  const random = seeded(world.seed);
  const actors = [];
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const rayGroups = groups(0xffff, GROUPS.WORLD);
  const route = [];
  let target = 0;
  let frozen = false;
  let frame = 0;
  let generation = 0;
  let warm = 12;
  let active = 0;

  const bodies = [];
  for (let i = 0; i < BODIES; i++) {
    const body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -200 - i * 3, 0));
    const collider = physics.world.createCollider(R.ColliderDesc.capsule(0.5, 0.27).setCollisionGroups(groups(GROUPS.PROP, GROUPS.PLAYER)).setFriction(0), body);
    physics.surfaces.set(collider.handle, 'soft');
    collider.setEnabled(false);
    bodies.push({ body, collider, actor: null });
  }

  function build(index) {
    const person = pack.people[index % pack.people.length];
    const meta = person.meta;
    const rig = createPedRig(meta);
    const material = createPedMaterial(ctx);
    const mesh = new THREE.SkinnedMesh(person.far, material);
    mesh.bind(rig.skeleton, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'npc-' + meta.id;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.35);
    rig.group.add(mesh);
    rig.group.visible = false;
    scene.add(rig.group);
    const rnd = seeded(world.seed * 31 + index * 977 + 5);
    const a = {
      index, person, meta, rig, mesh, material, rnd, animator: createPedAnimator(rig, meta, rnd),
      st: { speed: 0, turn: 0, mode: 'foot', act: 0, look: false, lookYaw: 0, lookPitch: 0, seat: 0.5, flail: 0, rise: 0, face: 0 },
      active: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0, speed: 0, scale: 1, pace: 1.3, jogger: false, lat: 0.5,
      state: S.WALK, timer: 0, path: [], step: 0, from: null, goal: null, gx: 0, gz: 0, faceYaw: null, hold: null, partner: null, lead: false, arrived: false, crossing: null, waited: 0,
      lookAt: null, lookT: 0, lookCool: 0, hurry: 0, body: null, near: false, shown: false, animT: 0, groundT: 0, gy: 0, dist: 0, seen: false, unseen: 0, resume: 0,
      fall: { dx: 0, dz: 0, vx: 0, vy: 0, vz: 0, tilt: 0, rate: 0, spin: 0, air: true, rest: 0, rise: 0 }, threat: null, talkT: 0, sx: 0, sz: 0, tx: 0, tz: 0,
    };
    return a;
  }

  function groundAt(x, y, z) {
    ray.origin.x = x;
    ray.origin.y = y + 1.1;
    ray.origin.z = z;
    const hit = physics.world.castRay(ray, 4, true, undefined, rayGroups);
    return hit ? y + 1.1 - (hit.timeOfImpact ?? hit.toi) : y;
  }

  function release(a) {
    if (!a.active) return;
    leavePlace(a);
    if (a.crossing) {
      if (a.state === S.WAIT) a.crossing.waiting--;
      else a.crossing.peds--;
      a.crossing = null;
    }
    if (a.partner) {
      const p = a.partner;
      a.partner = null;
      if (p.partner === a) {
        p.partner = null;
        if (p.active && p.state !== S.DOWN && p.state !== S.RISE) choose(p);
      }
    }
    if (a.body) {
      a.body.collider.setEnabled(false);
      a.body.actor = null;
      a.body = null;
    }
    a.active = false;
    a.rig.group.visible = false;
    active--;
  }

  function leavePlace(a) {
    const h = a.hold;
    if (!h) return;
    if (h.bench) h.bench.taken[h.seat] = null;
    else if (h.busy === a) h.busy = null;
    a.hold = null;
  }

  function pathTo(a, x, z) {
    const from = graph.nearest(a.x, a.z);
    const to = graph.nearest(x, z);
    graph.path(from, to, route);
    a.path.length = 0;
    a.path.push(from);
    for (const n of route) a.path.push(n);
    a.step = 0;
    a.from = null;
    a.gx = x;
    a.gz = z;
    a.arrived = false;
  }

  function choose(a) {
    leavePlace(a);
    a.partner = null;
    a.faceYaw = null;
    a.state = S.WALK;
    a.st.act = 0;
    a.st.mode = 'foot';
    a.goal = null;
    const r = a.rnd();
    const far = () => {
      for (let k = 0; k < 8; k++) {
        const n = graph.pool[Math.floor(a.rnd() * graph.pool.length)];
        if ((n.x - a.x) ** 2 + (n.z - a.z) ** 2 > 900) {
          pathTo(a, n.x, n.z);
          a.goal = 'far';
          return;
        }
      }
      const n = graph.pool[Math.floor(a.rnd() * graph.pool.length)];
      pathTo(a, n.x, n.z);
      a.goal = 'far';
    };
    if (a.jogger || a.hurry > 0 || r < 0.3) return far();
    if (r < 0.58) {
      const w = graph.windows[Math.floor(a.rnd() * graph.windows.length)];
      if (!w.busy && (w.x - a.x) ** 2 + (w.z - a.z) ** 2 < 8100) {
        w.busy = a;
        a.hold = w;
        a.goal = 'window';
        return pathTo(a, w.x, w.z);
      }
    } else if (r < 0.74) {
      const b = graph.benches[Math.floor(a.rnd() * graph.benches.length)];
      const seat = b.taken[0] ? 1 : 0;
      if (!b.taken[seat] && (b.x - a.x) ** 2 + (b.z - a.z) ** 2 < 10000) {
        b.taken[seat] = a;
        a.hold = { bench: b, seat };
        a.goal = 'bench';
        const u = seat ? 0.45 : -0.45;
        a.sx = b.x + Math.cos(b.yaw) * u - Math.sin(b.yaw) * 0.04;
        a.sz = b.z - Math.sin(b.yaw) * u - Math.cos(b.yaw) * 0.04;
        return pathTo(a, a.sx + Math.sin(b.yaw) * 0.62, a.sz + Math.cos(b.yaw) * 0.62);
      }
    } else if (r < 0.87) {
      const s = graph.spots[Math.floor(a.rnd() * graph.spots.length)];
      if (!s.busy) {
        s.busy = a;
        a.hold = s;
        a.goal = 'phone';
        return pathTo(a, s.x, s.z);
      }
    } else {
      const s = graph.spots[Math.floor(a.rnd() * graph.spots.length)];
      let mate = null;
      for (const b of actors) {
        if (b === a || !b.active || b.jogger || b.partner || b.state !== S.WALK || b.goal !== 'far' || b.hurry > 0) continue;
        if ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 < 1600) {
          mate = b;
          break;
        }
      }
      if (mate && !s.busy) {
        s.busy = a;
        a.hold = s;
        a.partner = mate;
        mate.partner = a;
        a.lead = true;
        mate.lead = false;
        const ang = a.rnd() * Math.PI * 2;
        a.goal = mate.goal = 'meet';
        a.timer = mate.timer = 40;
        pathTo(a, s.x + Math.sin(ang) * 0.47, s.z + Math.cos(ang) * 0.47);
        pathTo(mate, s.x - Math.sin(ang) * 0.47, s.z - Math.cos(ang) * 0.47);
        return;
      }
    }
    far();
  }

  function settle(a) {
    if (a.goal === 'window') {
      a.state = S.DWELL;
      a.faceYaw = a.hold.yaw;
      a.st.act = ACT.WINDOW;
      a.timer = 5 + a.rnd() * 9;
    } else if (a.goal === 'phone') {
      a.state = S.DWELL;
      a.faceYaw = a.yaw + (a.rnd() - 0.5) * 2;
      a.st.act = ACT.PHONE;
      a.timer = 8 + a.rnd() * 12;
    } else if (a.goal === 'bench') {
      a.state = S.SIT_IN;
      a.faceYaw = a.hold.bench.yaw;
      a.timer = 0;
      a.tx = a.x;
      a.tz = a.z;
    } else if (a.goal === 'meet' && a.partner) {
      a.state = S.MEET;
      a.arrived = true;
    } else choose(a);
  }

  function spawn(a, node, look) {
    const meta = a.meta;
    generation++;
    applyLook(a.material, meta, meta.looks[look % meta.looks.length]);
    a.scale = meta.height * (0.975 + a.rnd() * 0.05);
    a.rig.group.scale.setScalar(a.scale);
    a.jogger = meta.jog && a.rnd() < 0.6;
    a.pace = a.jogger ? 2.7 + a.rnd() * 0.5 : meta.pace * (0.92 + a.rnd() * 0.16);
    a.lat = 0.35 + a.rnd() * 0.6;
    a.x = node.x + (a.rnd() - 0.5) * 1.2;
    a.z = node.z + (a.rnd() - 0.5) * 1.2;
    a.y = groundAt(a.x, graph.walkY, a.z);
    a.gy = a.y;
    a.vx = a.vz = 0;
    a.speed = 0;
    a.yaw = a.rnd() * Math.PI * 2;
    a.hurry = 0;
    a.lookAt = null;
    a.lookCool = 2;
    a.crossing = null;
    a.threat = null;
    a.active = true;
    a.unseen = 0;
    a.rig.tilt.quaternion.identity();
    a.rig.tilt.position.set(0, 0, 0);
    a.st.rise = 0;
    a.st.flail = 0;
    active++;
    choose(a);
    if (a.goal !== 'far' && a.goal !== 'meet') {
      a.x = a.gx;
      a.z = a.gz;
      a.y = a.gy = groundAt(a.x, graph.walkY, a.z);
      a.path.length = 0;
      settle(a);
      if (a.faceYaw !== null) a.yaw = a.faceYaw;
      if (a.state === S.SIT_IN) {
        a.state = S.SIT;
        a.x = a.sx;
        a.z = a.sz;
        a.st.mode = 'sit';
        a.st.seat = SEAT / a.scale;
        a.st.act = a.rnd() < 0.4 ? ACT.PHONE : 0;
        a.timer = 12 + a.rnd() * 30;
      }
    }
    a.st.speed = 0;
    a.animator.snap(a.st);
    place(a);
  }

  function place(a) {
    const g = a.rig.group;
    g.position.set(a.x, a.y, a.z);
    g.rotation.y = a.yaw;
  }

  function populate() {
    const cx = camera.position.x;
    const cz = camera.position.z;
    const townDist = Math.hypot(cx - graph.centre.x, cz - graph.centre.z);
    const want = townDist > 330 ? 0 : target;
    if (active >= want) return;
    for (let tries = 0; tries < 6; tries++) {
      const n = graph.pool[Math.floor(random() * graph.pool.length)];
      const d = Math.hypot(n.x - cx, n.z - cz);
      if (d > 88) continue;
      sphere.center.set(n.x, graph.walkY + 0.9, n.z);
      sphere.radius = 1.5;
      if (d < 26 || (d < 62 && frustum.intersectsSphere(sphere))) continue;
      let clear = true;
      for (const b of actors) if (b.active && (b.x - n.x) ** 2 + (b.z - n.z) ** 2 < 9) clear = false;
      if (!clear) continue;
      let slot = null;
      const start = Math.floor(random() * actors.length);
      for (let k = 0; k < actors.length && !slot; k++) {
        const b = actors[(start + k) % actors.length];
        if (!b.active && actors.length >= Math.min(MAX, 12)) slot = b;
      }
      if (!slot && actors.length < MAX) {
        slot = build(actors.length);
        actors.push(slot);
      }
      if (!slot) slot = actors.find((b) => !b.active);
      if (!slot) return;
      const same = actors.filter((b) => b.active && b.meta === slot.meta).length;
      spawn(slot, n, Math.floor(slot.index / pack.people.length) + same + generation);
      return;
    }
  }

  function knock(a, v, speed) {
    if (a.state === S.DOWN) return;
    leavePlace(a);
    if (a.crossing) {
      if (a.state === S.WAIT) a.crossing.waiting--;
      else a.crossing.peds--;
      a.crossing = null;
    }
    if (a.partner) {
      const p = a.partner;
      a.partner = null;
      if (p.partner === a) {
        p.partner = null;
        p.state = S.WATCH;
        p.lookAt = a;
        p.timer = 5;
        p.st.act = 0;
      }
    }
    const f = a.fall;
    let dx = v.vx;
    let dz = v.vz;
    const side = (a.x - v.x) * -v.fz + (a.z - v.z) * v.fx;
    dx += -v.fz * Math.sign(side || 1) * 1.6;
    dz += v.fx * Math.sign(side || 1) * 1.6;
    const l = Math.hypot(dx, dz) || 1;
    f.dx = dx / l;
    f.dz = dz / l;
    f.vx = v.vx * 0.85 + f.dx * 1.2;
    f.vz = v.vz * 0.85 + f.dz * 1.2;
    f.vy = 2.0 + Math.min(3.2, speed * 0.2);
    f.tilt = 0;
    f.rate = 4.5 + speed * 0.45;
    f.spin = (a.rnd() - 0.5) * 5;
    f.air = true;
    f.rest = 1.4 + a.rnd() * 1.8;
    f.rise = 0;
    a.state = S.DOWN;
    a.st.mode = 'down';
    a.st.rise = 0;
    a.st.flail = 1;
    a.st.act = 0;
    a.st.look = false;
    a.st.face = f.dx * Math.sin(a.yaw) + f.dz * Math.cos(a.yaw) > 0 ? 1 : 0;
    a.st.seat = 0.5;
    a.threat = v;
    if (world.onHit) world.onHit(a, speed);
  }

  function updateFall(a, dt) {
    const f = a.fall;
    if (a.state === S.DOWN) {
      f.vy -= 9.81 * dt;
      a.x += f.vx * dt;
      a.z += f.vz * dt;
      a.y += f.vy * dt;
      const g = groundAt(a.x, Math.max(a.y, a.gy), a.z);
      a.gy = g;
      if (a.y <= g) {
        a.y = g;
        if (f.vy < -2.2) f.vy = -f.vy * 0.22;
        else f.vy = 0;
        f.air = false;
        const k = Math.max(0, 1 - 4.5 * dt);
        f.vx *= k;
        f.vz *= k;
        f.spin *= Math.max(0, 1 - 6 * dt);
      }
      f.tilt = Math.min(Math.PI / 2, f.tilt + f.rate * dt);
      a.yaw += f.spin * dt;
      a.st.flail += ((f.air ? 1 : 0) - a.st.flail) * Math.min(1, dt * 7);
      if (!f.air && Math.hypot(f.vx, f.vz) < 0.25 && f.tilt >= Math.PI / 2) {
        f.rest -= dt;
        if (f.rest <= 0) {
          a.state = S.RISE;
          f.rise = 0;
        }
      }
    } else {
      f.rise += dt / 1.9;
      a.st.rise = Math.min(1, f.rise);
      f.tilt = (Math.PI / 2) * (1 - sstep(0.08, 0.72, f.rise));
      if (f.rise >= 1) {
        a.st.mode = 'foot';
        a.st.rise = 0;
        a.hurry = 9;
        f.tilt = 0;
        a.vx = a.vz = 0;
        choose(a);
      }
    }
    const lx = f.dx * Math.cos(a.yaw) - f.dz * Math.sin(a.yaw);
    const lz = f.dx * Math.sin(a.yaw) + f.dz * Math.cos(a.yaw);
    AXIS.set(lz, 0, -lx).normalize();
    a.rig.tilt.quaternion.setFromAxisAngle(AXIS, f.tilt);
    a.rig.tilt.position.y = 0.12 * Math.sin(f.tilt) / a.scale;
    a.vx = f.vx;
    a.vz = f.vz;
    a.speed = 0;
    a.st.speed = 0;
  }

  function threatFrom(a) {
    for (const v of world.vehicles) {
      if (v.air) continue;
      const dx = a.x - v.x;
      const dz = a.z - v.z;
      const ahead = dx * v.fx + dz * v.fz;
      const side = -dx * v.fz + dz * v.fx;
      if (Math.abs(a.y - v.y) > 2.5) continue;
      if (Math.abs(ahead) < v.halfL + 0.3 && Math.abs(side) < v.halfW + 0.28) {
        const along = v.vx * v.fx + v.vz * v.fz;
        const closing = Math.abs(along);
        if (closing > 2.2 && ahead * along > -0.5) return knock(a, v, v.speed), true;
        const push = (v.halfW + 0.3 - Math.abs(side)) * Math.sign(side || 1);
        a.x += -v.fz * push * 0.5;
        a.z += v.fx * push * 0.5;
        continue;
      }
      const along = v.vx * v.fx + v.vz * v.fz;
      const dir = Math.sign(along);
      const gap = ahead * dir - v.halfL;
      if (Math.abs(along) < 3.2 || gap < 0 || gap > 22 || Math.abs(side) > v.halfW + 1.0) continue;
      const need = (along * along) / (2 * Math.max(gap, 0.5));
      if (need > 5.2 && gap / Math.abs(along) < 1.5) {
        a.threat = v;
        return 'flee';
      }
    }
    return false;
  }

  function crossingOpen(c, a) {
    const phase = world.signal;
    if (c.rule === 'main-signal') return phase >= 20 && phase < 24.5;
    if (c.rule === 'side-signal') return phase >= 0.5 && phase < 10.5;
    for (const v of world.vehicles) {
      if (v.air || v.speed < 1) continue;
      const dx = c.cx - v.x;
      const dz = c.cz - v.z;
      const ahead = dx * v.vx + dz * v.vz;
      if (ahead <= 0) continue;
      const d = Math.hypot(dx, dz);
      const lateral = Math.abs(-dx * v.vz + dz * v.vx) / v.speed;
      if (lateral > 7.5 || d > 40) continue;
      if (v.yielding === c && d < 14 && v.speed < 2.5) continue;
      if (d / v.speed < 5.5) return false;
    }
    return a.waited > 1.3;
  }

  function steer(a, dt, tx, tz, pace, slow) {
    let dx = tx - a.x;
    let dz = tz - a.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    dx /= d;
    dz /= d;
    let sp = pace * (slow ? Math.min(1, d / 1.1 + 0.22) : 1);
    let px = 0;
    let pz = 0;
    for (let i = 0; i < actors.length; i++) {
      const b = actors[i];
      if (b === a || !b.active) continue;
      const ox = a.x - b.x;
      const oz = a.z - b.z;
      const od = ox * ox + oz * oz;
      if (od > 3.2 || od < 1e-6) continue;
      const o = Math.sqrt(od);
      const ahead = -(ox * dx + oz * dz) / o;
      const w = (1.8 - o) * (ahead > 0 ? 1 + ahead : 0.35);
      px += (ox / o) * w + -dz * ahead * (ahead > 0.4 ? 0.9 : 0) * (b.speed < 0.2 || b.vx * dx + b.vz * dz < 0 ? 1 : 0.3);
      pz += (oz / o) * w + dx * ahead * (ahead > 0.4 ? 0.9 : 0) * (b.speed < 0.2 || b.vx * dx + b.vz * dz < 0 ? 1 : 0.3);
      if (o < 0.62 && ahead > 0.5) sp *= 0.45;
    }
    for (let i = 0; i < graph.posts.length; i++) {
      const p = graph.posts[i];
      const ox = a.x - p.x;
      const oz = a.z - p.z;
      const reach = p.r + 0.62;
      const od = ox * ox + oz * oz;
      if (od > reach * reach || od < 1e-6) continue;
      const o = Math.sqrt(od);
      const w = ((reach - o) / 0.62) * 2.2;
      const side = -ox * dz + oz * dx > 0 ? 1 : -1;
      px += (ox / o) * w - dz * side * w * 0.6;
      pz += (oz / o) * w + dx * side * w * 0.6;
    }
    const pl = world.player;
    if (pl.onFoot) {
      const ox = a.x - pl.x;
      const oz = a.z - pl.z;
      const o = Math.hypot(ox, oz) || 1e-6;
      const rush = pl.speed > 4 && (pl.vx * ox + pl.vz * oz) / (pl.speed * o) > 0.7;
      const reach = rush ? 3.4 : 1.25;
      if (o < reach) {
        const w = ((reach - o) / reach) * (rush ? 4.5 : 2.2);
        const side = -ox * pl.vz + oz * pl.vx >= 0 ? 1 : -1;
        px += (ox / o) * w + (rush ? (-pl.vz / pl.speed) * side * w : 0);
        pz += (oz / o) * w + (rush ? (pl.vx / pl.speed) * side * w : 0);
        if (rush && a.lookCool <= 0) {
          a.lookAt = pl;
          a.lookT = 1.6;
          a.lookCool = 4;
        }
      }
    }
    let wx = dx * sp + px * 0.9;
    let wz = dz * sp + pz * 0.9;
    const wl = Math.hypot(wx, wz);
    const top = Math.max(sp, 0.9) * 1.25;
    if (wl > top) {
      wx *= top / wl;
      wz *= top / wl;
    }
    const acc = (a.jogger || a.hurry > 0 ? 5 : 3.2) * dt;
    const ex = wx - a.vx;
    const ez = wz - a.vz;
    const el = Math.hypot(ex, ez);
    if (el > acc) {
      a.vx += (ex / el) * acc;
      a.vz += (ez / el) * acc;
    } else {
      a.vx = wx;
      a.vz = wz;
    }
    return d;
  }

  function face(a, yaw, dt, rate) {
    const diff = wrap(yaw - a.yaw);
    const stepYaw = clamp(diff, -rate * dt, rate * dt);
    a.yaw += stepYaw;
    return dt > 0 ? stepYaw / dt : 0;
  }

  function walk(a, dt) {
    const path = a.path;
    const pace = a.pace * (a.hurry > 0 && !a.jogger ? 1.75 : 1) * (a.crossing ? 1.12 : 1);
    if (a.step >= path.length) {
      const d = steer(a, dt, a.gx, a.gz, pace, true);
      if (d < 0.32) {
        a.vx *= 0.5;
        a.vz *= 0.5;
        settle(a);
      }
      return;
    }
    const n = path[a.step];
    const prev = a.step > 0 ? path[a.step - 1] : null;
    let tx = n.x;
    let tz = n.z;
    if (prev) {
      const ex = n.x - prev.x;
      const ez = n.z - prev.z;
      const el = Math.hypot(ex, ez) || 1;
      const lat = a.crossing ? a.lat * 0.5 : a.lat;
      tx += (-ez / el) * lat;
      tz += (ex / el) * lat;
    }
    const d = steer(a, dt, tx, tz, pace, false);
    if (d < (a.crossing ? 0.7 : 1.15)) {
      if (a.crossing) {
        a.crossing.peds--;
        a.crossing = null;
      }
      a.step++;
      const next = path[a.step];
      if (next) {
        const e = graph.edgeBetween(n, next);
        if (e && e.crossing) {
          a.crossing = e.crossing;
          a.crossing.waiting++;
          a.state = S.WAIT;
          a.waited = 0;
          a.faceYaw = Math.atan2(next.x - n.x, next.z - n.z);
          a.st.act = ACT.SCAN;
        }
      }
    }
  }

  function gaze(a, dt) {
    const t = a.lookAt;
    a.lookCool -= dt;
    if (!t) {
      a.st.look = false;
      const pl = world.player;
      if (a.lookCool <= 0 && pl.onFoot && a.state !== S.DOWN && a.state !== S.RISE) {
        const dx = pl.x - a.x;
        const dz = pl.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 22 && dx * Math.sin(a.yaw) + dz * Math.cos(a.yaw) > -0.6 * Math.sqrt(d2)) {
          a.lookAt = pl;
          a.lookT = 1.4 + a.rnd() * 1.8;
          a.lookCool = 5 + a.rnd() * 6;
        }
      }
      return;
    }
    a.lookT -= dt;
    if (a.lookT <= 0 && a.state !== S.TALK && a.state !== S.WATCH && a.state !== S.RECOVER) {
      a.lookAt = null;
      return;
    }
    const dx = t.x - a.x;
    const dz = t.z - a.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    a.st.look = true;
    a.st.lookYaw = wrap(Math.atan2(dx, dz) - a.yaw);
    a.st.lookPitch = -Math.atan2((t.eye ?? t.y + 1.6) - (a.y + 1.6 * a.scale), d);
  }

  function think(a, dt) {
    const st = a.st;
    if (a.state === S.DOWN || a.state === S.RISE) return updateFall(a, dt);
    if (a.hurry > 0) a.hurry -= dt;
    if (a.state !== S.SIT && (frame + a.index) % 2 === 0) {
      const t = threatFrom(a);
      if (t === true) return updateFall(a, 0);
      if (t === 'flee' && a.state !== S.FLEE && a.state !== S.SIT_IN && a.state !== S.SIT_OUT) {
        if (a.crossing) {
          if (a.state === S.WAIT) a.crossing.waiting--;
          else a.crossing.peds--;
          a.crossing = null;
        }
        const v = a.threat;
        const side = -(a.x - v.x) * v.fz + (a.z - v.z) * v.fx;
        const sgn = Math.abs(side) < 0.25 ? (a.rnd() < 0.5 ? 1 : -1) : Math.sign(side);
        const along = Math.sign(v.vx * v.fx + v.vz * v.fz);
        a.tx = a.x + -v.fz * sgn * 3.4 + v.fx * along * 1.2;
        a.tz = a.z + v.fx * sgn * 3.4 + v.fz * along * 1.2;
        a.resume = a.state === S.DWELL || a.state === S.SIT ? 0 : 1;
        a.state = S.FLEE;
        a.timer = 0.95;
        st.act = ACT.FLINCH;
        st.mode = 'foot';
        a.faceYaw = null;
      }
    }
    if (a.state !== S.FLEE && a.state !== S.WATCH && a.state !== S.SIT_IN && a.state !== S.SIT_OUT) {
      const air = world.aircraft;
      if (air && a.lookCool <= 0 && (air.x - a.x) ** 2 + (air.z - a.z) ** 2 < 3000 && a.state !== S.SIT) {
        a.resume = a.state === S.WALK ? 1 : 0;
        if (a.state === S.WAIT && a.crossing) {
          a.crossing.waiting--;
          a.crossing = null;
          a.step = Math.max(0, a.step - 1);
        }
        if (a.state === S.WALK || a.state === S.WAIT || a.state === S.DWELL) {
          a.state = S.WATCH;
          a.lookAt = air;
          a.timer = 3.5 + a.rnd() * 2;
          st.act = ACT.SHIELD;
        }
      } else if (world.crash && world.crash.fresh && (world.crash.x - a.x) ** 2 + (world.crash.z - a.z) ** 2 < 1500 && (a.state === S.WALK || a.state === S.DWELL || a.state === S.WAIT)) {
        if (a.state === S.WAIT && a.crossing) {
          a.crossing.waiting--;
          a.crossing = null;
          a.step = Math.max(0, a.step - 1);
        }
        a.resume = 1;
        a.state = S.WATCH;
        a.lookAt = world.crash;
        a.timer = 5 + a.rnd() * 5;
        st.act = a.rnd() < 0.3 ? ACT.PHONE : 0;
      }
    }
    let turn = 0;
    switch (a.state) {
      case S.WALK:
        walk(a, dt);
        break;
      case S.WAIT: {
        a.waited += dt;
        steer(a, dt, a.x, a.z, 0, true);
        turn = face(a, a.faceYaw, dt, 3.5);
        if (a.waited > 1.2 && crossingOpen(a.crossing, a)) {
          a.crossing.waiting--;
          a.crossing.peds++;
          a.state = S.WALK;
          st.act = 0;
          a.faceYaw = null;
        } else if (a.waited > 45) {
          a.crossing.waiting--;
          a.crossing = null;
          st.act = 0;
          choose(a);
        }
        break;
      }
      case S.DWELL:
        steer(a, dt, a.gx, a.gz, 0.6, true);
        turn = face(a, a.faceYaw, dt, 3);
        a.timer -= dt;
        if (a.timer <= 0) choose(a);
        break;
      case S.SIT_IN: {
        a.vx = a.vz = 0;
        turn = face(a, a.faceYaw, dt, 4);
        if (Math.abs(wrap(a.faceYaw - a.yaw)) < 0.12) {
          if (a.timer === 0) {
            st.mode = 'sit';
            st.seat = SEAT / a.scale;
          }
          a.timer += dt / 0.85;
          const k = sstep(0, 1, Math.min(1, a.timer));
          a.x = a.tx + (a.sx - a.tx) * k;
          a.z = a.tz + (a.sz - a.tz) * k;
          if (a.timer >= 1) {
            a.state = S.SIT;
            a.timer = 14 + a.rnd() * 28;
            st.act = a.rnd() < 0.4 ? ACT.PHONE : 0;
          }
        }
        break;
      }
      case S.SIT:
        a.vx = a.vz = 0;
        a.timer -= dt;
        if (a.timer <= 0) {
          a.state = S.SIT_OUT;
          a.timer = 0;
          st.mode = 'foot';
          st.act = 0;
          const b = a.hold.bench;
          a.tx = a.sx + Math.sin(b.yaw) * 0.62;
          a.tz = a.sz + Math.cos(b.yaw) * 0.62;
        }
        break;
      case S.SIT_OUT: {
        a.timer += dt / 0.8;
        const k = sstep(0, 1, Math.min(1, a.timer));
        a.x = a.sx + (a.tx - a.sx) * k;
        a.z = a.sz + (a.tz - a.sz) * k;
        if (a.timer >= 1.15) choose(a);
        break;
      }
      case S.MEET: {
        const p = a.partner;
        a.timer -= dt;
        if (!p || !p.active || a.timer <= 0) {
          if (p && p.partner === a) {
            p.partner = null;
            choose(p);
          }
          choose(a);
          break;
        }
        steer(a, dt, a.gx, a.gz, 0.6, true);
        turn = face(a, Math.atan2(p.x - a.x, p.z - a.z), dt, 3);
        a.lookAt = p;
        a.lookT = 1;
        if (p.state === S.MEET && p.arrived) {
          const span = 9 + a.rnd() * 14;
          a.state = p.state = S.TALK;
          a.timer = p.timer = span;
          a.talkT = 0;
        }
        break;
      }
      case S.TALK: {
        const p = a.partner;
        a.timer -= dt;
        if (!p || !p.active || p.state !== S.TALK || a.timer <= 0) {
          st.act = 0;
          a.lookAt = null;
          if (p && p.partner === a) {
            p.partner = null;
            p.st.act = 0;
            p.lookAt = null;
            choose(p);
          }
          choose(a);
          break;
        }
        steer(a, dt, a.gx, a.gz, 0.5, true);
        turn = face(a, Math.atan2(p.x - a.x, p.z - a.z), dt, 3);
        a.lookAt = p;
        if (a.lead) {
          a.talkT -= dt;
          if (a.talkT <= 0) {
            a.talkT = 1.8 + a.rnd() * 3;
            const mine = st.act !== ACT.TALK;
            st.act = mine ? ACT.TALK : ACT.LISTEN;
            p.st.act = mine ? ACT.LISTEN : ACT.TALK;
          }
        }
        break;
      }
      case S.FLEE: {
        steer(a, dt, a.tx, a.tz, 4.6, false);
        a.timer -= dt;
        if (a.timer <= 0) {
          a.state = S.RECOVER;
          a.timer = 1.6 + a.rnd() * 1.4;
          st.act = 0;
          a.lookAt = a.threat;
        }
        break;
      }
      case S.RECOVER:
        steer(a, dt, a.x, a.z, 0, true);
        if (a.threat) turn = face(a, Math.atan2(a.threat.x - a.x, a.threat.z - a.z), dt, 4);
        a.timer -= dt;
        if (a.timer <= 0) {
          a.lookAt = null;
          a.hurry = 3;
          choose(a);
        }
        break;
      case S.WATCH: {
        steer(a, dt, a.x, a.z, 0, true);
        const t = a.lookAt;
        if (t) turn = face(a, Math.atan2(t.x - a.x, t.z - a.z), dt, 2.6);
        a.timer -= dt;
        const air = st.act === ACT.SHIELD;
        if (a.timer <= 0 && !(air && world.aircraft && (world.aircraft.x - a.x) ** 2 + (world.aircraft.z - a.z) ** 2 < 3000 && a.timer > -6)) {
          st.act = 0;
          a.lookAt = null;
          a.lookCool = 6;
          choose(a);
        }
        break;
      }
      default:
        break;
    }
    if (a.state === S.DOWN || a.state === S.RISE) return;
    const sp = Math.hypot(a.vx, a.vz);
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.speed = sp;
    if (sp > 0.25 && a.faceYaw === null) turn = face(a, Math.atan2(a.vx, a.vz), dt, a.state === S.FLEE ? 12 : 3.2 + sp * 1.6);
    const moving = a.state === S.SIT || a.state === S.SIT_IN || a.state === S.SIT_OUT ? 0 : sp * (0.35 + 0.65 * Math.max(0, (a.vx * Math.sin(a.yaw) + a.vz * Math.cos(a.yaw)) / (sp || 1)));
    st.speed = moving / a.scale;
    st.turn = turn;
    if (a.state !== S.SIT && a.state !== S.SIT_IN && a.state !== S.SIT_OUT) {
      a.groundT -= 1;
      if (a.groundT <= 0) {
        a.groundT = a.dist < 40 ? 3 : 9;
        a.gy = groundAt(a.x, a.y, a.z);
      }
      a.y += (a.gy - a.y) * Math.min(1, dt * 12);
    }
  }

  function assignBodies() {
    const pl = world.player;
    for (const b of bodies) {
      const a = b.actor;
      if (a && (!a.active || !pl.onFoot || a.state === S.DOWN || a.state === S.RISE || (a.x - pl.x) ** 2 + (a.z - pl.z) ** 2 > 400)) {
        b.collider.setEnabled(false);
        a.body = null;
        b.actor = null;
      }
    }
    if (!pl.onFoot) return;
    for (const a of actors) {
      if (!a.active || a.body || a.state === S.DOWN || a.state === S.RISE || (a.x - pl.x) ** 2 + (a.z - pl.z) ** 2 > 200) continue;
      const b = bodies.find((k) => !k.actor);
      if (!b) return;
      b.actor = a;
      a.body = b;
      b.body.setTranslation({ x: a.x, y: a.y + 0.8, z: a.z }, true);
      b.collider.setEnabled(true);
    }
  }

  function update(dt) {
    frame++;
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    if (warm > 0) {
      warm--;
      if (!actors.length) actors.push(build(0));
      const a = actors[0];
      if (!a.active) {
        const g = a.rig.group;
        if (warm > 0) {
          camera.getWorldDirection(tmpV);
          g.position.copy(camera.position).addScaledVector(tmpV, 6);
          g.position.y -= 2.4;
          g.visible = true;
          a.mesh.frustumCulled = false;
        } else {
          g.visible = false;
        }
      }
      return;
    }
    if (frozen) return;
    if (frame % 3 === 0) populate();
    if (frame % 12 === 0) assignBodies();
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.active) continue;
      const dist = Math.hypot(a.x - cx, a.y - cy, a.z - cz);
      a.dist = dist;
      sphere.center.set(a.x, a.y + 0.9, a.z);
      sphere.radius = 1.6;
      a.seen = dist < HIDE && frustum.intersectsSphere(sphere);
      a.unseen = a.seen ? 0 : a.unseen + dt;
      if (dist > 125 || (dist > 62 && a.unseen > 9 && active > target * 0.5) || active > target + 2) {
        if (!a.seen || dist > 125 || active > target + 6) {
          release(a);
          continue;
        }
      }
      think(a, dt);
      gaze(a, dt);
      place(a);
      const show = dist < (a.shown ? HIDE : HIDE - 8);
      if (show !== a.shown) {
        a.shown = show;
        a.rig.group.visible = show;
      }
      const near = dist < (a.near ? NEAR + 2 : NEAR);
      if (near !== a.near || a.mesh.geometry !== (near ? a.person.near : a.person.far)) {
        a.near = near;
        a.mesh.geometry = near ? a.person.near : a.person.far;
      }
      a.mesh.castShadow = dist < 70;
      a.mesh.frustumCulled = a.state !== S.DOWN && a.state !== S.RISE;
      a.animT += dt;
      const every = !a.seen && dist > 14 ? 6 : dist < 32 ? 1 : dist < 70 ? 2 : 4;
      if ((frame + a.index) % every === 0 || a.state === S.DOWN || a.state === S.RISE) {
        a.animator.update(a.animT, a.st);
        a.animT = 0;
        if (a.animator.step && dist < 11 && world.onStep) world.onStep(a);
      }
      if (a.body) a.body.body.setNextKinematicTranslation({ x: a.x, y: a.y + 0.8, z: a.z });
    }
  }

  return {
    graph,
    actors,
    update,
    get count() {
      return active;
    },
    setTarget(n) {
      target = Math.min(MAX, n);
    },
    freeze(on) {
      frozen = on;
    },
    place(x, z, id, state = {}) {
      let a = actors.find((b) => !b.active && (!id || b.meta.id === id));
      if (!a) {
        for (let i = actors.length; i < MAX && !a; i++) {
          actors.push(build(i));
          if (!id || actors[i].meta.id === id) a = actors[i];
        }
      }
      if (!a) return null;
      spawn(a, { x, z }, state.look || 0);
      leavePlace(a);
      if (a.partner) {
        a.partner.partner = null;
        a.partner = null;
      }
      a.x = x;
      a.z = z;
      a.y = a.gy = groundAt(x, state.y ?? a.y, z);
      a.yaw = state.yaw ?? a.yaw;
      a.state = S.DWELL;
      a.goal = 'far';
      a.gx = x;
      a.gz = z;
      a.faceYaw = a.yaw;
      a.timer = state.hold ?? 20;
      a.st.mode = 'foot';
      a.st.act = state.act || 0;
      a.path.length = 0;
      a.animator.snap(a.st);
      place(a);
      return a;
    },
    knock(a, vx = 6, vz = 0) {
      knock(a, { x: a.x - vx * 0.3, z: a.z - vz * 0.3, y: a.y, vx, vz, fx: vx / (Math.hypot(vx, vz) || 1), fz: vz / (Math.hypot(vx, vz) || 1), speed: Math.hypot(vx, vz) }, Math.hypot(vx, vz));
    },
    seat(a, index, side = 0) {
      const b = graph.benches[index];
      leavePlace(a);
      b.taken[side] = a;
      a.hold = { bench: b, seat: side };
      const u = side ? 0.45 : -0.45;
      a.sx = b.x + Math.cos(b.yaw) * u - Math.sin(b.yaw) * 0.04;
      a.sz = b.z - Math.sin(b.yaw) * u - Math.cos(b.yaw) * 0.04;
      a.x = a.sx;
      a.z = a.sz;
      a.yaw = a.faceYaw = b.yaw;
      a.state = S.SIT;
      a.timer = 60;
      a.st.mode = 'sit';
      a.st.seat = SEAT / a.scale;
      a.st.act = 0;
      a.path.length = 0;
      a.animator.snap(a.st);
      place(a);
      return b;
    },
    fill() {
      for (let k = 0; k < 400 && active < target; k++) {
        const n = graph.pool[Math.floor(random() * graph.pool.length)];
        let clear = true;
        for (const b of actors) if (b.active && (b.x - n.x) ** 2 + (b.z - n.z) ** 2 < 6) clear = false;
        if (!clear) continue;
        let slot = actors.find((b) => !b.active);
        if (!slot && actors.length < MAX) {
          slot = build(actors.length);
          actors.push(slot);
        }
        if (!slot) break;
        spawn(slot, n, Math.floor(slot.index / pack.people.length) + generation);
      }
      return active;
    },
    send(a, x, z) {
      leavePlace(a);
      a.state = S.WALK;
      a.st.act = 0;
      a.faceYaw = null;
      a.goal = 'far';
      pathTo(a, x, z);
    },
    clear() {
      for (const a of actors) release(a);
    },
    S,
  };
}

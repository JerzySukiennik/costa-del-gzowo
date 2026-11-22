// Costa del Gzowo: multiplayer session (joins a shared world, shares the vehicle fleet through per-vehicle ownership, broadcasts what this player simulates, shows the other players and their name tags).
import * as THREE from 'three';
import { loadBackend } from './backend.js';
import { joinWorld } from './lobby.js';
import { createMesh } from './mesh.js';
import { createRemote, createTrack } from './remote.js';
import { NET } from './firebaseConfig.js';
import { encode, decode, PARTS, FLAG, VFLAG } from './protocol.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const byte = (x) => clamp(Math.round(x * 255), 0, 255);
const TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

export async function createMultiplayer(ctx, play, profile, hooks = {}) {
  const backend = await loadBackend();
  const { db, ref } = backend;
  const R = ctx.physics.RAPIER;
  const fleet = play.fleet;
  const remotes = new Map();
  const tracks = fleet.map(() => createTrack());
  const owners = fleet.map(() => -1);
  const sentAt = fleet.map(() => 0);
  const tags = hooks.tags || null;
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const v = new THREE.Vector3();
  let players = [];
  let present = new Set();
  let mesh = null;
  let seq = 0;
  let sendIn = 0;
  let sinceSend = 0;
  let entering = -1;

  const authority = (k) => (owners[k] >= 0 && present.has(owners[k]) ? owners[k] : -1);

  function setRemote(item, on) {
    if (item.remote === on) return;
    item.remote = on;
    item.damage.state.remote = on;
    const body = item.car.body;
    if (on) {
      tracks[item.index].reset();
      body.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
      return;
    }
    const last = tracks[item.index].latest;
    body.setBodyType(R.RigidBodyType.Dynamic, true);
    if (last) {
      body.setLinvel({ x: last.v[0], y: last.v[1], z: last.v[2] }, true);
      body.setAngvel({ x: last.w[0], y: last.w[1], z: last.w[2] }, true);
      if (item.damage.parts) PARTS.forEach((name, i) => {
        if (item.damage.parts[name] && (last.parts >> i) & 1) item.damage.parts[name].gone = true;
      });
    }
    item.car.state.occupied = false;
  }

  function claim(item) {
    if (owners[item.index] === lobby.slot) return;
    db.runTransaction(ref(`${lobby.base}/vehicles/${item.index}`), (current) => {
      if (current && current.owner !== lobby.slot && present.has(current.owner) && item.driver === current.owner) return undefined;
      return { owner: lobby.slot, uid: backend.uid };
    }).catch(() => {});
  }

  function reconcile() {
    present = new Set(players.map((p) => p.slot));
    const lowest = Math.min(...present, lobby.slot);
    for (const item of fleet) {
      const a = authority(item.index);
      if (a < 0 && lobby.slot === lowest) claim(item);
      setRemote(item, a >= 0 && a !== lobby.slot);
    }
  }

  function syncRemotes() {
    const others = new Map(players.filter((p) => !p.me).map((p) => [p.slot, p]));
    for (const [slot, remote] of remotes) {
      if (others.has(slot) && others.get(slot).pid === remote.pid) continue;
      remote.dispose();
      remotes.delete(slot);
    }
    for (const [slot, p] of others) {
      let remote = remotes.get(slot);
      if (!remote) {
        remote = createRemote(ctx, ctx.scene, slot);
        remote.pid = p.pid;
        remotes.set(slot, remote);
      }
      remote.setProfile({ name: p.name, avatar: p.avatar });
    }
    reconcile();
    if (hooks.onPlayers) hooks.onPlayers(api.players());
  }

  const lobby = await joinWorld(backend, profile, (list) => {
    players = list;
    if (mesh) mesh.setPlayers(list);
    syncRemotes();
  });
  const stopOwners = db.onValue(ref(`${lobby.base}/vehicles`), (snap) => {
    const value = snap.val() || {};
    fleet.forEach((item, k) => {
      const o = value[k];
      owners[k] = o && Number.isInteger(o.owner) ? o.owner : -1;
    });
    reconcile();
  });
  mesh = createMesh(backend, lobby, {
    onState(slot, buffer) {
      const packet = decode(buffer);
      const remote = remotes.get(slot);
      if (!packet || !remote) return;
      const now = performance.now();
      remote.push(packet.player, now);
      for (const record of packet.vehicles) if (record.index < fleet.length && owners[record.index] === slot) tracks[record.index].push(record, now);
    },
    onLink(slot, kind) {
      const remote = remotes.get(slot);
      if (remote) remote.link = kind;
      if (hooks.onPlayers) hooks.onPlayers(api.players());
    },
  });
  mesh.setPlayers(players);

  function record(item) {
    const c = item.car;
    const cs = c.state;
    const dmg = item.damage;
    const m = item.model;
    let vflags = 0;
    if (dmg.state.burning > 0 && !dmg.state.exploded) vflags |= VFLAG.BURNING;
    if (dmg.state.exploded) vflags |= VFLAG.EXPLODED;
    if (cs.rotorBroken) vflags |= VFLAG.ROTOR_BROKEN;
    if (cs.occupied) vflags |= VFLAG.OCCUPIED;
    if (cs.occupied && play.game.beams) vflags |= VFLAG.BEAMS;
    if (cs.brake > 0.05) vflags |= VFLAG.BRAKE;
    if (cs.reverse) vflags |= VFLAG.REVERSE;
    let parts = 0;
    PARTS.forEach((name, i) => {
      if (dmg.parts && dmg.parts[name] && dmg.parts[name].gone) parts |= 1 << i;
    });
    c.wheels.forEach((w, i) => {
      if (w.gone && i < 4) parts |= 1 << (6 + i);
    });
    const extra = new Uint8Array(8);
    if (item.id === 'roadster') {
      const t = c.sim.thrusters;
      extra[0] = byte(Math.max(...t.rear.map((n) => n.valve)));
      extra[1] = byte(Math.max(...t.front.map((n) => n.valve)));
      extra[2] = byte(Math.max(...t.side.map((n) => n.valve)));
      extra[3] = byte(t.extend);
      extra[4] = byte(t.sideDeploy);
    } else if (item.id === 'heli') {
      extra[0] = byte(cs.rotor);
      extra[1] = clamp(Math.round(cs.lift * 100), 0, 255);
      extra[2] = clamp(Math.round(cs.pitch * 127 + 128), 0, 255);
      extra[3] = clamp(Math.round(cs.roll * 127 + 128), 0, 255);
    } else if (item.netExtra) item.netExtra(extra);
    if (c.netPack) c.netPack(extra);
    const p = m.group.position;
    const q = m.group.quaternion;
    const w = c.body.angvel();
    return { index: item.index, vflags, health: dmg.state.health, roof: m.roof ? m.roof.value : 0, p: [p.x, p.y, p.z], q: [q.x, q.y, q.z, q.w], v: [c.velocity.x, c.velocity.y, c.velocity.z], w: [w.x, w.y, w.z], steer: clamp((cs.steer || 0) / 0.6, -1, 1), throttle: cs.throttle || 0, parts, extra };
  }

  function capture(now) {
    const g = play.game;
    const ps = play.player.state;
    const active = play.vehicle;
    if (entering >= 0 && (g.mode !== 'foot' || !g.transition)) entering = -1;
    const seat = g.mode === 'car' || entering === active.index ? 1 : g.mode === 'ride' ? 2 : 0;
    let flags = 0;
    if (ps.grounded) flags |= FLAG.GROUNDED;
    if (ps.mode === 'swim') flags |= FLAG.SWIM;
    const player = { flags, seat, vehicle: seat ? active.index : 255, speed: ps.speed || 0, x: ps.position.x, y: ps.position.y, z: ps.position.z, yaw: ps.yaw, vy: ps.vy || 0, wade: ps.wade || 0, steer: clamp((active.car.state.steer || 0) / 0.6, -1, 1), throttle: active.car.state.throttle || 0 };
    const vehicles = [];
    for (const item of fleet) {
      if (item.remote || authority(item.index) !== lobby.slot) continue;
      const c = item.car;
      const w = c.body.angvel();
      const asleep = !c.state.occupied && c.velocity.lengthSq() < 0.004 && w.x * w.x + w.y * w.y + w.z * w.z < 0.003 && !(item.damage.state.burning > 0);
      if (asleep && now - sentAt[item.index] < 600 + item.index * 40) continue;
      sentAt[item.index] = now;
      vehicles.push(record(item));
    }
    return { player, vehicles };
  }

  function applyRemote(item, s, dt) {
    const c = item.car;
    const cs = c.state;
    const m = item.model;
    c.position.copy(m.group.position);
    c.quaternion.copy(m.group.quaternion);
    c.forward.set(1, 0, 0).applyQuaternion(c.quaternion);
    c.up.set(0, 1, 0).applyQuaternion(c.quaternion);
    if (c.right) c.right.set(0, 0, 1).applyQuaternion(c.quaternion);
    c.velocity.set(s.v[0], s.v[1], s.v[2]);
    const fwd = c.velocity.dot(c.forward);
    const steer = s.steer * 0.6;
    const occupied = (s.vflags & VFLAG.OCCUPIED) !== 0;
    Object.assign(cs, { speed: c.velocity.length(), forwardSpeed: fwd, occupied, throttle: s.throttle, brake: s.vflags & VFLAG.BRAKE ? 1 : 0, reverse: (s.vflags & VFLAG.REVERSE) !== 0, steer });
    const lights = { brake: s.vflags & VFLAG.BRAKE ? 1 : 0, reverse: (s.vflags & VFLAG.REVERSE) !== 0, beam: (s.vflags & VFLAG.BEAMS) !== 0 };
    if (item.id === 'convertible') {
      c.wheels.forEach((w, i) => {
        w.angle += (fwd / 0.34) * dt;
        w.visual.group.visible = ((s.parts >> (6 + i)) & 1) === 0;
      });
      PARTS.forEach((name, i) => {
        if (m.pivots[name]) m.pivots[name].visible = ((s.parts >> i) & 1) === 0;
      });
      if (Math.abs(m.roof.value - s.roof) > 0.03) m.setRoof(s.roof);
    } else if (item.id === 'roadster') {
      const sim = c.sim;
      sim.steerAngle = steer;
      sim.wheels.forEach((w, i) => {
        w.steer = i < 2 ? steer : 0;
        w.spin = (w.spin || 0) + (fwd / 0.34) * dt;
      });
      sim.thrusters.rear.forEach((n) => (n.valve = s.extra[0] / 255));
      sim.thrusters.front.forEach((n) => (n.valve = s.extra[1] / 255));
      sim.thrusters.side.forEach((n) => (n.valve = s.extra[2] / 255));
      sim.thrusters.extend = s.extra[3] / 255;
      sim.thrusters.sideDeploy = s.extra[4] / 255;
      sim.thrusters.flap = s.extra[0] > 20 ? 1 : 0;
    } else if (item.netApply) item.netApply(s, dt);
    else if (c.netApply) c.netApply(s);
    else {
      Object.assign(cs, { rotor: s.extra[0] / 255, lift: s.extra[1] / 100, pitch: (s.extra[2] - 128) / 127, roll: (s.extra[3] - 128) / 127, rotorBroken: (s.vflags & VFLAG.ROTOR_BROKEN) !== 0 });
    }
    m.setLights(lights);
    const dmg = item.damage;
    const exploded = (s.vflags & VFLAG.EXPLODED) !== 0;
    if (exploded && !dmg.state.exploded) dmg.explode();
    else if (!exploded && dmg.state.exploded && dmg.repair) dmg.repair();
    if (!exploded) dmg.state.health = s.health;
  }

  const api = {
    world: lobby.world,
    slot: lobby.slot,
    remotes,
    owners,
    players() {
      return players.map((p) => ({ slot: p.slot, name: p.name, me: p.me, link: p.me ? 'you' : remotes.get(p.slot) ? remotes.get(p.slot).link : 'joining' }));
    },
    setProfile(next) {
      return lobby.setProfile(next);
    },
    claim(item) {
      entering = item.index;
      claim(item);
    },
    fixed() {
      const now = performance.now();
      for (const item of fleet) {
        if (!item.remote) continue;
        const s = tracks[item.index].sample(now);
        if (!s) continue;
        const { a, b, k, ahead } = s;
        v.set(a.p[0] + (b.p[0] - a.p[0]) * k + b.v[0] * ahead, a.p[1] + (b.p[1] - a.p[1]) * k + b.v[1] * ahead, a.p[2] + (b.p[2] - a.p[2]) * k + b.v[2] * ahead);
        qa.set(a.q[0], a.q[1], a.q[2], a.q[3]);
        qb.set(b.q[0], b.q[1], b.q[2], b.q[3]);
        qa.slerp(qb, k).normalize();
        if (item.id === 'roadster') qa.multiply(TURN);
        item.car.body.setNextKinematicTranslation({ x: v.x, y: v.y, z: v.z });
        item.car.body.setNextKinematicRotation({ x: qa.x, y: qa.y, z: qa.z, w: qa.w });
      }
    },
    update(dt, camera) {
      const now = performance.now();
      for (const item of fleet) {
        item.driver = -1;
        item.passenger = -1;
        item.driverName = '';
      }
      for (const remote of remotes.values()) {
        remote.update(dt, now, fleet);
        const s = remote.now;
        const item = s && s.seat > 0 ? fleet[s.vehicle] : null;
        if (!item) continue;
        if (s.seat === 1) {
          item.driver = remote.slot;
          item.driverName = remote.profile.name;
        } else item.passenger = remote.slot;
      }
      for (const item of fleet) {
        if (!item.remote) continue;
        const latest = tracks[item.index].latest;
        if (latest) applyRemote(item, latest, dt);
      }
      sendIn -= dt;
      sinceSend += dt;
      if (sendIn <= 0) {
        sendIn = 1 / NET.sendHz;
        const state = capture(now);
        mesh.send(encode(state.player, state.vehicles, seq++, now), sinceSend);
        sinceSend = 0;
      }
      if (tags) tags.update(camera, remotes);
    },
    stats() {
      return {
        world: lobby.world, slot: lobby.slot, players: api.players(), owners: [...owners], remote: fleet.map((f) => (f.remote ? 1 : 0)).join(''),
        links: [...mesh.links.values()].map((l) => ({ slot: l.slot, open: l.open, relay: l.relay, channel: l.channel ? l.channel.readyState : 'none' })),
        remotes: [...remotes.values()].map((r) => ({ slot: r.slot, character: !!r.character, seat: r.now ? r.now.seat : null, vehicle: r.now ? r.now.vehicle : null, tag: r.tagOn })),
        drivers: fleet.map((f) => f.driver), passengers: fleet.map((f) => f.passenger),
      };
    },
    leave() {
      stopOwners();
      mesh.close();
      lobby.leave();
      for (const remote of remotes.values()) remote.dispose();
      remotes.clear();
      for (const item of fleet) setRemote(item, false);
      if (tags) tags.clear();
    },
  };
  reconcile();
  return api;
}

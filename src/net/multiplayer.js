// Costa del Gzowo: multiplayer session (joins a shared world, broadcasts the local player and vehicle, keeps the remote players, name tags and passenger rides).
import * as THREE from 'three';
import { loadBackend } from './backend.js';
import { joinWorld } from './lobby.js';
import { createMesh } from './mesh.js';
import { createRemote } from './remote.js';
import { NET } from './firebaseConfig.js';
import { encode, decode, KINDS, PARTS, FLAG, VFLAG } from './protocol.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export async function createMultiplayer(ctx, play, profile, hooks = {}) {
  const backend = await loadBackend();
  const deps = { scene: ctx.scene, physics: ctx.physics, particles: play.particles };
  const remotes = new Map();
  const tags = hooks.tags || null;
  const v = new THREE.Vector3();
  const extra = new Uint8Array(16);
  let players = [];
  let mesh = null;
  let seq = 0;
  let sendIn = 0;
  let sinceSend = 0;
  let riding = null;

  function syncRemotes() {
    const present = new Map(players.filter((p) => !p.me).map((p) => [p.slot, p]));
    for (const [slot, remote] of remotes) {
      if (present.has(slot) && present.get(slot).pid === remote.pid) continue;
      if (riding === remote) riding = null;
      remote.dispose();
      remotes.delete(slot);
    }
    for (const [slot, p] of present) {
      let remote = remotes.get(slot);
      if (!remote) {
        remote = createRemote(ctx, deps, slot);
        remote.pid = p.pid;
        remotes.set(slot, remote);
      }
      remote.setProfile({ name: p.name, car: p.car, avatar: p.avatar });
    }
    if (hooks.onPlayers) hooks.onPlayers(api.players());
  }

  const lobby = await joinWorld(backend, profile, (list) => {
    players = list;
    if (mesh) mesh.setPlayers(list);
    syncRemotes();
  });
  mesh = createMesh(backend, lobby, {
    onState(slot, buffer) {
      const remote = remotes.get(slot);
      const state = decode(buffer);
      if (remote && state) remote.push(state, performance.now());
    },
    onLink(slot, kind) {
      const remote = remotes.get(slot);
      if (remote) remote.link = kind;
      if (hooks.onPlayers) hooks.onPlayers(api.players());
    },
  });
  mesh.setPlayers(players);

  function capture() {
    const g = play.game;
    const ps = play.player.state;
    const car = play.car;
    const cs = car.state;
    const model = play.carModel;
    const dmg = play.damage;
    const kind = Math.max(0, KINDS.indexOf(play.vehicle.id));
    let flags = FLAG.VEHICLE;
    if (g.mode === 'car') flags |= FLAG.DRIVING;
    if (g.mode === 'ride' && riding) flags |= FLAG.RIDING;
    if (g.beams) flags |= FLAG.BEAMS;
    if (ps.grounded) flags |= FLAG.GROUNDED;
    if (ps.mode === 'swim') flags |= FLAG.SWIM;
    if (cs.brake > 0.05) flags |= FLAG.BRAKE;
    if (cs.reverse) flags |= FLAG.REVERSE;
    let vflags = 0;
    if (dmg.state.burning > 0 && !dmg.state.exploded) vflags |= VFLAG.BURNING;
    if (dmg.state.exploded) vflags |= VFLAG.EXPLODED;
    if (cs.rotorBroken) vflags |= VFLAG.ROTOR_BROKEN;
    if (cs.occupied) vflags |= VFLAG.OCCUPIED;
    let parts = 0;
    PARTS.forEach((name, i) => {
      if (dmg.parts && dmg.parts[name] && dmg.parts[name].gone) parts |= 1 << i;
    });
    car.wheels.forEach((w, i) => {
      if (w.gone && i < 4) parts |= 1 << (6 + i);
    });
    extra.fill(0);
    if (kind === 1 && car.sim) {
      car.sim.thrusters.all.forEach((n, i) => {
        if (i < 10) extra[i] = clamp(Math.round(n.valve * 255), 0, 255);
      });
      extra[10] = clamp(Math.round(car.sim.thrusters.extend * 255), 0, 255);
      extra[11] = clamp(Math.round(car.sim.thrusters.sideDeploy * 255), 0, 255);
      car.sim.wheels.forEach((w, i) => {
        if (i < 4) extra[12 + i] = clamp(Math.round((w.length / 0.6) * 255), 0, 255);
      });
    } else if (kind === 2) {
      extra[0] = clamp(Math.round(cs.rotor * 255), 0, 255);
      extra[1] = clamp(Math.round(cs.lift * 100), 0, 255);
      extra[2] = clamp(Math.round(cs.pitch * 127 + 128), 0, 255);
      extra[3] = clamp(Math.round(cs.roll * 127 + 128), 0, 255);
      extra[4] = clamp(Math.round(clamp((cs.lift - 0.12) / 1.1, 0, 1) * 255), 0, 255);
    }
    const w = car.body.angvel();
    const q = car.quaternion;
    return {
      flags, px: ps.position.x, py: ps.position.y, pz: ps.position.z, yaw: ps.yaw, speed: ps.speed || 0, vy: ps.vy || 0, wade: ps.wade || 0, host: riding ? riding.slot : 255, kind, health: dmg.state.health,
      vx: car.position.x, vyPos: car.position.y, vz: car.position.z, q: [q.x, q.y, q.z, q.w], v: [car.velocity.x, car.velocity.y, car.velocity.z], w: [w.x, w.y, w.z],
      steer: clamp((cs.steer || 0) / 0.6, -1, 1), throttle: cs.throttle || 0, vflags, roof: model.roof ? model.roof.value : 0, parts, extra,
    };
  }

  const env = { slot: lobby.slot, model: play.carModel, remotes };
  const api = {
    world: lobby.world,
    slot: lobby.slot,
    remotes,
    get riding() {
      return riding;
    },
    players() {
      return players.map((p) => ({ slot: p.slot, name: p.name, car: p.car, me: p.me, link: p.me ? 'you' : remotes.get(p.slot) ? remotes.get(p.slot).link : 'joining' }));
    },
    setProfile(next) {
      return lobby.setProfile(next);
    },
    fixed() {
      const now = performance.now();
      for (const remote of remotes.values()) remote.fixed(now);
    },
    update(dt, camera) {
      const now = performance.now();
      sendIn -= dt;
      sinceSend += dt;
      if (sendIn <= 0) {
        sendIn = 1 / NET.sendHz;
        mesh.send(encode(capture(), seq++, now), sinceSend);
        sinceSend = 0;
      }
      for (const remote of remotes.values()) remote.update(dt, now, env);
      if (tags) tags.update(camera, remotes);
    },
    rideNear(point) {
      let best = null;
      let bestD = 3.4;
      for (const remote of remotes.values()) {
        if (!remote.vehicle || !remote.driving || remote.proxy.state.speed > 3) continue;
        let taken = false;
        for (const other of remotes.values()) if (other.ridingWith === remote.slot) taken = true;
        if (taken) continue;
        const d = v.copy(remote.vehicle.model.group.position).sub(point).length();
        if (d < bestD) {
          bestD = d;
          best = remote;
        }
      }
      return best;
    },
    startRide(remote) {
      riding = remote;
      return remote;
    },
    stopRide() {
      riding = null;
    },
    stats() {
      return { world: lobby.world, slot: lobby.slot, players: api.players(), links: [...mesh.links.values()].map((l) => ({ slot: l.slot, open: l.open, relay: l.relay, state: l.pc ? l.pc.connectionState : 'none', channel: l.channel ? l.channel.readyState : 'none', ice: l.pc ? l.pc.iceConnectionState : 'none' })), remotes: [...remotes.values()].map((r) => ({ slot: r.slot, vehicle: r.vehicle ? r.vehicle.name : null, character: !!r.character, pos: r.vehicle ? r.vehicle.model.group.position.toArray().map((n) => +n.toFixed(1)) : null, driving: r.driving, ridingWith: r.ridingWith, tag: r.tagOn })) };
    },
    leave() {
      mesh.close();
      lobby.leave();
      for (const remote of remotes.values()) remote.dispose();
      remotes.clear();
      if (tags) tags.clear();
    },
  };
  return api;
}

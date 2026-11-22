// Costa del Gzowo film: in-page choreography runtime (shot list player, kinematic Roadster, posed avatar, scripted camera).
(() => {
  const VIDEOS = (window.__filmVideos = window.__filmVideos || {});
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (x) => {
    const t = clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ease = {
    linear: (t) => clamp(t, 0, 1),
    smooth,
    inOut: (t) => {
      t = clamp(t, 0, 1);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    out: (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
    in: (t) => Math.pow(clamp(t, 0, 1), 3),
    outBack: (t) => {
      t = clamp(t, 0, 1);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  function catmull(points, u) {
    const n = points.length - 1;
    const x = clamp(u, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(x));
    const f = x - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n, i + 2)];
    const out = [];
    for (let k = 0; k < p1.length; k++) {
      const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
      out.push(0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f));
    }
    return out;
  }

  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0].slice(1);
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last.slice(1);
    let i = 0;
    while (keys[i + 1][0] < t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const e = typeof b[b.length - 1] === 'function' ? b[b.length - 1] : ease.inOut;
    const k = e((t - a[0]) / (b[0] - a[0]));
    const n = Math.min(a.length, b.length) - (typeof b[b.length - 1] === 'function' ? 1 : 0);
    const out = [];
    for (let j = 1; j < n; j++) out.push(lerp(a[j], b[j], k));
    return out;
  }

  function mixPose(a, b, k) {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key] ?? b[key];
      const y = b[key] ?? a[key];
      out[key] = lerp(x, y, k);
    }
    return out;
  }

  const F = {
    ready: false,
    clamp, lerp, smooth, ease, seg, catmull, track, mixPose, TAU,
  };
  window.__film = F;

  function bind() {
    const d = window.__dbg;
    const { play, camera, pipeline, scene, ctx } = d;
    const V3 = camera.position.constructor;
    const Q = camera.quaternion.constructor;
    const E = camera.rotation.constructor;
    const M4 = camera.matrix.constructor;
    Object.assign(F, { d, play, camera, pipeline, scene, ctx, V3, Q, E, M4 });
    const car = play.car;
    const sim = car.sim;
    const body = car.body;
    const R = ctx.physics.RAPIER;
    const character = play.character;
    const player = play.player;
    const model = play.carModel;
    const TO_BODY = new Q().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 2);
    const Y = new V3(0, 1, 0);

    const state = {
      t: 0, g: 0, dt: 1 / 30,
      carKin: false, carFrom: null, carTo: null, subT: 0,
      jets: null,
      cam: null,
      ride: null,
      hold: false,
    };
    F.state = state;

    F.carPose = (x, y, z, heading = 0, pitch = 0, roll = 0) => {
      const q = new Q().setFromEuler(new E(roll, heading, pitch, 'YZX'));
      return { p: new V3(x, y, z), q };
    };
    F.carKinematic = (on) => {
      if (on === state.carKin) return;
      state.carKin = on;
      body.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
      if (!on) {
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    };
    F.placeCar = (pose) => {
      const bq = pose.q.clone().multiply(TO_BODY);
      body.setTranslation({ x: pose.p.x, y: pose.p.y, z: pose.p.z }, true);
      body.setRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w }, true);
      if (state.carKin) {
        body.setNextKinematicTranslation({ x: pose.p.x, y: pose.p.y, z: pose.p.z });
        body.setNextKinematicRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w });
      }
      state.carFrom = { p: pose.p.clone(), q: pose.q.clone() };
      state.carTo = { p: pose.p.clone(), q: pose.q.clone() };
      car.sync();
    };
    F.driveCar = (pose) => {
      state.carFrom = state.carTo ? { p: state.carTo.p.clone(), q: state.carTo.q.clone() } : { p: pose.p.clone(), q: pose.q.clone() };
      state.carTo = { p: pose.p.clone(), q: pose.q.clone() };
      state.subT = 0;
    };
    F.setJets = (j) => {
      state.jets = j;
    };

    const baseSub = car.substep;
    const p = new V3();
    const q = new Q();
    car.substep = (dt) => {
      if (state.carKin && state.carTo) {
        state.subT += dt;
        const k = clamp(state.subT / state.dt, 0, 1);
        p.lerpVectors(state.carFrom.p, state.carTo.p, k);
        q.slerpQuaternions(state.carFrom.q, state.carTo.q, k).multiply(TO_BODY);
        body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
        body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
      baseSub(dt);
      const j = state.jets;
      if (j) {
        const th = sim.thrusters;
        th.rear.forEach((n) => (n.valve = j.rear || 0));
        th.front.forEach((n) => (n.valve = j.front || 0));
        th.side.forEach((n) => (n.valve = j.side || 0));
        if (j.extend !== undefined) th.extend = j.extend;
        if (j.deploy !== undefined) th.sideDeploy = j.deploy;
        if (j.flap !== undefined) th.flap = j.flap;
        let rear = 0;
        th.rear.forEach((n) => (rear += n.valve / 4));
        car.state.boost = rear;
      }
    };

    F.ride = (opts) => {
      state.ride = opts;
      if (!opts) return;
      F.stopWalk();
      F.release();
      player.setEnabled(false);
      play.game.mode = 'ride';
      player.state.mode = 'car';
      (opts.world ? scene : model.group).add(character.group);
      F.placeRider(opts);
    };
    F.placeRider = (opts) => {
      const o = opts.pos;
      character.group.position.set(o[0], o[1], o[2]);
      if (opts.up) {
        const yv = new V3(...opts.up).normalize();
        const zv = new V3(...opts.face);
        zv.addScaledVector(yv, -zv.dot(yv)).normalize();
        const xv = new V3().crossVectors(yv, zv);
        character.group.quaternion.setFromRotationMatrix(new M4().makeBasis(xv, yv, zv));
      } else {
        const r = opts.rot || [0, 0, 0];
        character.group.quaternion.setFromEuler(new E(r[0], r[1], r[2], r[3] || 'YXZ'));
      }
      character.group.updateMatrixWorld(true);
    };
    const baseSync = player.sync;
    player.sync = (dt, info) => {
      if (state.ride) {
        character.update(dt, { mode: 'foot', speed: 0, vy: 0, wade: 0 });
        return;
      }
      baseSync(dt, info);
    };
    F.dismount = () => {
      state.ride = null;
      scene.attach(character.group);
    };
    const entry = play.entry;
    const baseEntryUpdate = entry.update;
    entry.update = (...a) => (F.entryOff ? undefined : baseEntryUpdate(...a));
    F.release = () => {
      F.entryOff = true;
      car.state.occupied = false;
      character.reach('L', null);
      character.reach('R', null);
      if (character.group.parent !== scene) scene.attach(character.group);
    };
    F.foot = (x, z, yaw, y) => {
      if (state.ride) F.dismount();
      F.release();
      play.game.mode = 'foot';
      player.state.mode = 'foot';
      player.setEnabled(true);
      const gy = y ?? groundY(x, z);
      player.teleport(x, gy, z, yaw);
      player.state.yaw = yaw;
      play.rig.rig.yaw = yaw;
      character.group.position.set(x, gy, z);
      character.group.rotation.set(0, yaw, 0);
    };
    function groundY(x, z) {
      const hit = d.physics.world.castRay(new R.Ray({ x, y: 60, z }, { x: 0, y: -1, z: 0 }), 120, true, undefined, undefined, player.collider, body);
      const ray = hit ? 60 - (hit.timeOfImpact ?? hit.toi) : -99;
      return F.heightAt ? Math.max(ray, F.heightAt(x, z)) : ray;
    }
    F.groundY = groundY;
    F.floorY = groundY;
    F.charLocal = (x, y, z, out = new V3()) => {
      character.group.updateMatrixWorld(true);
      return out.set(x, y, z).applyMatrix4(character.group.matrixWorld);
    };
    F.camChar = (lp, lt, fov = 45, roll = 0) => {
      const p = F.charLocal(lp[0], lp[1], lp[2]);
      const t = F.charLocal(lt[0], lt[1], lt[2]);
      F.look([p.x, p.y, p.z], [t.x, t.y, t.z], fov, roll);
    };
    F.walk = (dirYaw, run = false) => {
      play.rig.rig.yaw = dirYaw;
      ctx.input.hold('KeyW', dirYaw !== null);
      ctx.input.hold('ShiftLeft', !!run);
    };
    F.stopWalk = () => {
      ctx.input.hold('KeyW', false);
      ctx.input.hold('ShiftLeft', false);
    };
    F.pose = (pose, rate = 30) => character.setScripted(pose, rate);
    F.free = () => character.setScripted(null);

    F.look = (pos, target, fov = 50, roll = 0) => {
      state.cam = { pos: new V3(...pos), target: new V3(...target), fov, roll };
    };
    F.flight = (pts, u, bank = 0.5, pitchK = 1) => {
      const e = 0.004;
      const a = catmull(pts, clamp(u - e, 0, 1));
      const b = catmull(pts, clamp(u + e, 0, 1));
      const c = catmull(pts, clamp(u + 3 * e, 0, 1));
      const p0 = catmull(pts, u);
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const h = Math.atan2(-dz, dx);
      const h2 = Math.atan2(-(c[2] - b[2]), c[0] - b[0]);
      let turn = Math.atan2(Math.sin(h2 - h), Math.cos(h2 - h));
      const pitch = Math.atan2(dy, Math.hypot(dx, dz)) * pitchK;
      return F.carPose(p0[0], p0[1], p0[2], h, pitch, clamp(-turn * bank * 40, -1.2, 1.2));
    };
    F.camCar = (lp, lt, fov = 55, roll = 0) => {
      const p = F.carLocal(lp[0], lp[1], lp[2]);
      const t = F.carLocal(lt[0], lt[1], lt[2]);
      F.look([p.x, p.y, p.z], [t.x, t.y, t.z], fov, roll);
    };
    F.camOrbit = (c, r, h, ang, fov = 55, ty = 0) => {
      F.look([c[0] + Math.cos(ang) * r, c[1] + h, c[2] + Math.sin(ang) * r], [c[0], c[1] + ty, c[2]], fov);
    };
    F.shake = (amp, t, freq = 1) => {
      const c = state.cam;
      if (!c || amp <= 0) return;
      const n = (k) => Math.sin(t * 37 * freq + k) * 0.6 + Math.sin(t * 61 * freq + k * 2.3) * 0.4;
      c.pos.x += n(1) * amp;
      c.pos.y += n(2) * amp;
      c.pos.z += n(3) * amp;
      c.target.x += n(4) * amp * 0.5;
      c.target.y += n(5) * amp * 0.5;
    };
    F.carLocal = (x, y, z, out = new V3()) => {
      model.group.updateMatrixWorld(true);
      return out.set(x, y, z).applyMatrix4(model.group.matrixWorld);
    };
    F.headWorld = (out = new V3()) => {
      character.joints.head.updateWorldMatrix(true, false);
      return out.setFromMatrixPosition(character.joints.head.matrixWorld);
    };
    F.hipsWorld = (out = new V3()) => {
      character.joints.hips.updateWorldMatrix(true, false);
      return out.setFromMatrixPosition(character.joints.hips.matrixWorld);
    };

    const baseUpdate = play.update;
    play.update = (dt, elapsed) => {
      state.dt = dt;
      state.g += dt;
      if (F.shot && F.shot.tick) F.shot.tick(F, state.t, dt);
      baseUpdate(dt, elapsed);
      if (F.shot && F.shot.post) F.shot.post(F, state.t, dt);
      const c = state.cam;
      if (c) {
        camera.position.copy(c.pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(c.target);
        if (c.roll) camera.rotateZ(c.roll);
        camera.fov = c.fov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
      }
    };

    const baseRender = pipeline.render.bind(pipeline);
    pipeline.render = (...a) => {
      if (!F.noRender) baseRender(...a);
    };
    play.game.cinematic = true;
    d.cinematics.update = () => {};
    play.hud.show = () => {};
    play.character.group.visible = true;
    F.carKinematic(true);
    F.ready = true;
  }

  F.start = async (videoId) => {
    if (!F.heightAt) F.heightAt = (await import(new URL('src/world/heightfield.js', document.baseURI).href)).heightAt;
    if (!F.ready) bind();
    const video = VIDEOS[videoId];
    if (!video) throw new Error('no video ' + videoId);
    F.video = video;
    F.shots = video.shots(F);
    F.index = -1;
    F.frame = 0;
    window.__vt.freeze();
    window.__vt.reseed(42);
    const style = document.createElement('style');
    style.textContent = '#hud,#place,#radio,#prompt,#cluster,#damage-note,.deck,.now-playing,#screens,.screen{display:none!important;opacity:0!important}';
    document.head.appendChild(style);
    for (const el of document.body.children) if (el.id !== 'view' && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') el.style.display = 'none';
    let cum = 0;
    const shots = F.shots.map((s) => {
      const a = Math.round(cum * 30);
      cum += s.dur;
      const frames = Math.round(cum * 30) - a;
      s.frames = frames;
      return { name: s.name, start: a, frames, pre: Math.round((s.pre ?? 0.4) * 30), edit: s.edit || {} };
    });
    return { id: videoId, music: video.music || null, overlay: video.overlay || [], shots };
  };

  F.enter = (i) => {
    F.index = i;
    F.shot = F.shots[i];
    F.state.t = -Math.round((F.shot.pre ?? 0.4) * 30) / 30 - 1 / 30;
    F.state.g = F.state.t;
    F.state.cam = null;
    if (F.shot.setup) F.shot.setup(F);
    F.pipeline.reset = true;
    F.pipeline.frame = 0;
    F.pipeline.sunOcclusion = F.shot.flare ? 1 : 0;
  };

  F.advance = (render = true) => {
    F.noRender = !render;
    const s = F.shot;
    const scale = s.speed ?? 1;
    F.state.subT = 0;
    F.state.t += 1 / 30;
    window.__vt.step((1000 / 30) * (typeof scale === 'function' ? scale(F.state.t) : scale));
    return F.state.t;
  };

  F.runShot = (i) => F.enter(i);
})();

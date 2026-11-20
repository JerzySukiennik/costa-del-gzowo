// Costa del Gzowo Roadster: Jurek's synthesised EV motor (from Roadster Jump) and the CC0 cold-gas samples (thrust loops scaled by open valves, start bursts per nozzle group, boost roar, valve puffs, stop hiss, flap servo), placed around the camera.
const MOTOR = { tones: [[515.118885362368, 0.305], [282.5455829795911, 0.26]], wave: 0, detune: 0, cutoff: 331.8235917958316, q: 1.2, idle: 0.05, top: 0.14, topSpeed: 45, throttle: 0.06, pitch: 0.23, gain: 1.2 };
const FILES = {
  thrust_loop: [['thrust_loop', 1]], thrust_start: [['thrust_start_1', 1.7], ['thrust_start_2', 1], ['thrust_start_3', 0.95]], thrust_stop: [['thrust_stop', 1.25]],
  valve_puff: [['valve_puff_1', 1], ['valve_puff_2', 1]], boost_big: [['boost_big_1', 1], ['boost_big_2', 0.9]], flap_servo: [['flap_servo', 1]],
};
const GROUPS = [[0, 1, 2, 3], [4, 5], [6, 7, 8, 9]];

export function createRoadsterAudio(audio, base = '') {
  const ac = audio && audio.context;
  if (!ac) return { update() {} };
  const out = ac.createGain();
  out.gain.value = 0.9;
  const pan = ac.createStereoPanner();
  out.connect(pan);
  pan.connect(ac.destination);
  const cabin = ac.createBiquadFilter();
  cabin.type = 'lowpass';
  cabin.frequency.value = 20000;
  cabin.connect(out);
  const motorBus = ac.createGain();
  motorBus.gain.value = 0;
  motorBus.connect(cabin);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = MOTOR.cutoff;
  lp.Q.value = MOTOR.q;
  lp.connect(motorBus);
  const oscs = [];
  for (const [f, a] of MOTOR.tones) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = a;
    o.connect(g);
    g.connect(lp);
    o.start();
    oscs.push({ o, f });
  }
  const jetBus = ac.createGain();
  jetBus.gain.value = 0.8;
  jetBus.connect(cabin);
  const buf = new Map();
  const loops = new Map();
  const cool = new Map();
  Promise.all(Object.entries(FILES).flatMap(([k, list]) => list.map(async ([f, trim]) => {
    try {
      const data = await (await fetch(base + 'assets/vehicles/roadster/audio/' + f + '.mp3')).arrayBuffer();
      const b = await ac.decodeAudioData(data);
      if (!buf.has(k)) buf.set(k, []);
      buf.get(k).push({ b, trim });
    } catch (e) {
      return null;
    }
    return null;
  })));

  function play(name, gain = 1, rate = 1, cooldown = 0) {
    const list = buf.get(name);
    if (!list || !list.length) return;
    const now = ac.currentTime;
    if (cooldown && (cool.get(name) || 0) > now) return;
    if (cooldown) cool.set(name, now + cooldown);
    const pick = list[Math.floor(Math.random() * list.length)];
    const s = ac.createBufferSource();
    s.buffer = pick.b;
    s.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    const g = ac.createGain();
    g.gain.value = gain * pick.trim;
    s.connect(g);
    g.connect(jetBus);
    s.start();
  }

  function loop(key, name, gain, rate, tc, offset) {
    let L = loops.get(key);
    if (!L) {
      const list = buf.get(name);
      if (!list) return;
      const s = ac.createBufferSource();
      s.buffer = list[0].b;
      s.loop = true;
      const g = ac.createGain();
      g.gain.value = 0;
      s.connect(g);
      g.connect(jetBus);
      s.start(0, offset * list[0].b.duration);
      L = { s, g, trim: list[0].trim };
      loops.set(key, L);
    }
    const t = ac.currentTime;
    L.g.gain.setTargetAtTime(gain * L.trim, t, tc);
    L.s.playbackRate.setTargetAtTime(Math.max(0.2, rate), t, tc);
  }

  const prev = { valves: new Float32Array(10), shut: new Float32Array(10).fill(9), on: [false, false, false], offT: [9, 9, 9], peak: 0, flap: 0, rearHot: false, liftHot: false, air: 0, jr: 0 };
  return {
    update(dt, { sim, inside, camera, position }) {
      if (ac.state !== 'running') return;
      const t = ac.currentTime;
      let gain = 1;
      let p = 0;
      if (camera && position) {
        const dx = position.x - camera.position.x;
        const dy = position.y - camera.position.y;
        const dz = position.z - camera.position.z;
        const d = Math.hypot(dx, dy, dz);
        const e = camera.matrixWorld.elements;
        p = inside ? 0 : Math.max(-1, Math.min(1, (dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(d, 1))) * 0.7;
        gain = inside ? 1 : 1 / (1 + (d / 9) ** 2);
      }
      out.gain.setTargetAtTime(0.9 * gain, t, 0.05);
      pan.pan.setTargetAtTime(p, t, 0.05);
      cabin.frequency.setTargetAtTime(inside ? 2600 : 20000, t, 0.15);
      const sp = sim.speed;
      prev.air = sim.contacts > 0 ? 0 : prev.air + dt;
      const ground = prev.air < 0.25 ? 1 : 0;
      const level = ground * (MOTOR.idle * Math.min(1, sp / 1.5) + MOTOR.top * Math.min(1, sp / MOTOR.topSpeed) + MOTOR.throttle * sim.load * Math.min(1, sp / 3)) * MOTOR.gain;
      motorBus.gain.setTargetAtTime(level * (inside ? 0.95 : 0.6), t, ground ? 0.25 : 0.12);
      const k = 1 + MOTOR.pitch * Math.min(1, sp / MOTOR.topSpeed);
      for (const s of oscs) s.o.frequency.setTargetAtTime(s.f * k, t, 0.08);
      let tot = 0;
      const gs = [0, 0, 0];
      const all = sim.thrusters.all;
      for (let i = 0; i < 10; i++) {
        tot += all[i].valve;
        gs[i < 4 ? 0 : i < 6 ? 1 : 2] += all[i].valve;
      }
      const r0 = Math.sqrt(tot / 10);
      prev.jr += (r0 - prev.jr) * (1 - Math.exp(-dt / (r0 > prev.jr ? 0.04 : 0.14)));
      const r = prev.jr;
      loop('jetA', 'thrust_loop', Math.min(1.1, r * 1.5), 0.94 + r * 0.1, 0.06, 0.1);
      loop('jetB', 'thrust_loop', Math.min(0.8, Math.max(0, r - 0.35) * 1.5), 0.8 + r * 0.08, 0.08, 0.55);
      for (let g = 0; g < 3; g++) {
        const v = gs[g] / GROUPS[g].length;
        if (!prev.on[g] && v > 0.3) {
          prev.on[g] = true;
          if (prev.offT[g] > 0.4) play('thrust_start', 0.8, 1, 0.35);
        } else if (prev.on[g] && v < 0.05) {
          prev.on[g] = false;
          prev.offT[g] = 0;
        }
        if (!prev.on[g]) prev.offT[g] += dt;
      }
      for (let i = 0; i < 10; i++) {
        const v = all[i].valve;
        if (v > 0.3 && prev.valves[i] <= 0.3 && prev.shut[i] > 0.25) play('valve_puff', 0.3, 1, 0.25);
        prev.shut[i] = v < 0.02 ? prev.shut[i] + dt : 0;
        prev.valves[i] = v;
      }
      if (!prev.rearHot && gs[0] > 2.6) {
        prev.rearHot = true;
        play('boost_big', 0.9, 1, 0.8);
      } else if (prev.rearHot && gs[0] < 0.8) prev.rearHot = false;
      if (!prev.liftHot && gs[1] + gs[2] > 3.6) {
        prev.liftHot = true;
        play('boost_big', 0.95, 1, 0.8);
      } else if (prev.liftHot && gs[1] + gs[2] < 1.2) prev.liftHot = false;
      prev.peak = Math.max(prev.peak, tot);
      if (tot < 0.06 && prev.peak > 0.6) {
        prev.peak = 0;
        play('thrust_stop', 0.75, 1, 0.4);
      }
      const flap = sim.thrusters.flap;
      if (flap > 0.05 && prev.flap <= 0.05) play('flap_servo', 0.3, 0.8);
      prev.flap = flap;
    },
  };
}

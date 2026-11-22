// Costa del Gzowo Cyber Truck: order-based synthesised drive units (motor orders, gear mesh, inverter carrier with sidebands, regeneration, air whir) plus recorded tyre roar, doors, vault motor and air suspension, placed around the camera.
const GEAR = 12.4;
const POLES = 4;
const MESH = 23;
const CARRIER = 2650;
const LOOPS = { tyre: 'tyre_loop', vault: 'vault_loop', compressor: 'compressor_loop', hiss: 'hiss_loop' };
const SHOTS = ['door_open', 'door_close', 'hiss_end'];
const LEAD = 0.25;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function saturator(ac) {
  const shaper = ac.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

function noiseBuffer(ac) {
  const len = ac.sampleRate * 2;
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  let seed = 77;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    d[i] = seed / 2147483648 - 1;
  }
  return b;
}

export function createMotor(ac, dest) {
  const bus = ac.createGain();
  bus.gain.value = 0;
  const drive = ac.createGain();
  drive.gain.value = 1;
  const shaper = saturator(ac);
  const post = ac.createGain();
  post.gain.value = 0.8;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2000;
  tone.Q.value = 0.5;
  bus.connect(drive);
  drive.connect(shaper);
  shaper.connect(post);
  post.connect(tone);
  const level = ac.createGain();
  level.gain.value = 0.3;
  tone.connect(level);
  level.connect(dest);
  const voices = {};
  const osc = (key, type, order, detune = 0) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = 40;
    o.detune.value = detune;
    const g = ac.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(bus);
    o.start();
    voices[key] = { o, g, order };
    return voices[key];
  };
  osc('o4a', 'sine', POLES, -3);
  osc('o4b', 'triangle', POLES, 4);
  osc('o8', 'sine', POLES * 2, 2);
  osc('o12', 'sine', POLES * 3, -2);
  osc('meshA', 'sine', MESH, -2.5);
  osc('meshB', 'sine', MESH, 3);
  osc('regen', 'sine', POLES * 2.5, 0);
  osc('hum', 'sine', 0, 0);
  const carrier = ac.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = CARRIER;
  const side = ac.createOscillator();
  side.type = 'sine';
  side.frequency.value = 40;
  const ring = ac.createGain();
  ring.gain.value = 0;
  const sideDepth = ac.createGain();
  sideDepth.gain.value = 1;
  side.connect(sideDepth);
  sideDepth.connect(ring.gain);
  carrier.connect(ring);
  const inverter = ac.createGain();
  inverter.gain.value = 0;
  ring.connect(inverter);
  const carrierDirect = ac.createGain();
  carrierDirect.gain.value = 0.18;
  carrier.connect(carrierDirect);
  carrierDirect.connect(inverter);
  inverter.connect(bus);
  carrier.start();
  side.start();
  const rough = ac.createOscillator();
  rough.type = 'sine';
  const roughDepth = ac.createGain();
  roughDepth.gain.value = 0;
  rough.connect(roughDepth);
  roughDepth.connect(voices.meshA.g.gain);
  rough.start();
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac);
  noise.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.value = 400;
  const air = ac.createGain();
  air.gain.value = 0;
  noise.connect(band);
  band.connect(air);
  air.connect(dest);
  noise.start();
  let drift = 0;
  let driftT = 0;
  const ramp = (param, value, t, k = 0.06) => param.setTargetAtTime(value, t, k);
  return {
    set({ speed, load, regen, reverse, on, open = 1 }, t, dt = 0.016) {
      driftT += dt;
      drift += (Math.random() - 0.5) * dt * 2;
      drift *= 1 - dt * 0.6;
      const fm = Math.max(0, speed / 0.445 / (2 * Math.PI)) * GEAR;
      const kmh = speed * 3.6;
      const s = clamp(kmh / 210, 0, 1);
      const moving = smooth(0.5, 9, kmh);
      const L = clamp(load, 0, 1);
      const rev = reverse ? 1 : 0;
      const wob = 1 + drift * 0.004;
      for (const v of Object.values(voices)) if (v.order) ramp(v.o.frequency, Math.max(1, fm * v.order * wob), t, 0.03);
      ramp(voices.hum.o.frequency, 118, t);
      const quiet = 1 - 0.45 * s;
      ramp(voices.o4a.g.gain, on * moving * (0.035 + 0.2 * L + 0.08 * rev) * quiet, t);
      ramp(voices.o4b.g.gain, on * moving * (0.02 + 0.09 * L) * quiet, t);
      ramp(voices.o8.g.gain, on * moving * (0.018 + 0.11 * L) * (1 - 0.6 * rev), t);
      ramp(voices.o12.g.gain, on * moving * (0.008 + 0.07 * L ** 1.4) * (1 - rev), t);
      const meshLevel = on * moving * (0.014 + 0.03 * s + 0.075 * L) * (1 - 0.7 * smooth(4500, 8000, fm * MESH)) * (1 - 0.8 * rev);
      ramp(voices.meshA.g.gain, meshLevel, t);
      ramp(voices.meshB.g.gain, meshLevel * 0.8, t);
      ramp(rough.frequency, Math.max(1, fm), t);
      ramp(roughDepth.gain, meshLevel * 0.55 * L, t);
      ramp(voices.regen.g.gain, on * clamp(regen, 0, 1) * smooth(3, 25, kmh) * (0.06 + 0.05 * (1 - s)), t, 0.12);
      ramp(voices.hum.g.gain, on * 0.012 * (1 - moving * 0.6), t, 0.2);
      ramp(side.frequency, Math.max(1, fm * POLES * 2), t, 0.03);
      ramp(carrier.frequency, CARRIER * (1 + drift * 0.002), t, 0.2);
      ramp(inverter.gain, on * smooth(0.3, 4, kmh) * (0.012 + 0.07 * L) * (1 - smooth(70, 150, kmh)), t);
      ramp(band.frequency, 250 + fm * 3.5, t);
      ramp(air.gain, on * (0.02 * s + 0.03 * L * s), t, 0.1);
      ramp(drive.gain, 1 + 1.0 * L, t, 0.1);
      ramp(post.gain, 0.8 / (1 + 0.5 * L), t, 0.1);
      ramp(tone.frequency, (1400 + 7600 * (0.35 + 0.65 * L) * (0.6 + 0.4 * s)) * open, t, 0.08);
      ramp(bus.gain, 1, t, 0.1);
    },
  };
}

export function createTruckAudio(audio, base = '') {
  const ac = audio && audio.context;
  if (!ac) return { update() {}, door() {}, vault() {} };
  const out = ac.createGain();
  out.gain.value = 0;
  const pan = ac.createStereoPanner();
  const far = ac.createBiquadFilter();
  far.type = 'lowpass';
  far.frequency.value = 20000;
  out.connect(far);
  far.connect(pan);
  pan.connect(audio.master || ac.destination);
  const motorOut = ac.createGain();
  motorOut.gain.value = 1;
  motorOut.connect(out);
  const motor = createMotor(ac, motorOut);
  const cabin = ac.createBiquadFilter();
  cabin.type = 'lowpass';
  cabin.frequency.value = 20000;
  cabin.connect(out);
  const buffers = {};
  const voices = {};
  const load = async (name) => {
    try {
      const data = await (await fetch(`${base}assets/vehicles/cybertruck/audio/${name}.mp3`)).arrayBuffer();
      buffers[name] = await ac.decodeAudioData(data);
    } catch (e) {
      buffers[name] = null;
    }
  };
  for (const name of Object.values(LOOPS)) load(name);
  for (const name of SHOTS) load(name);

  function loop(key) {
    if (voices[key]) return voices[key];
    const buffer = buffers[LOOPS[key]];
    if (!buffer) return null;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = LEAD;
    source.loopEnd = buffer.duration - LEAD;
    const gain = ac.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(key === 'tyre' ? cabin : out);
    source.start(0, LEAD + Math.random() * (buffer.duration - 2 * LEAD) * 0.8);
    voices[key] = { source, gain };
    return voices[key];
  }

  function set(key, level, rate, k = 0.08) {
    const v = loop(key);
    if (!v) return;
    const t = ac.currentTime;
    v.gain.gain.setTargetAtTime(level, t, k);
    v.source.playbackRate.setTargetAtTime(Math.max(0.3, rate), t, k);
  }

  function shot(name, gain = 1) {
    const buffer = buffers[name];
    if (!buffer || ac.state !== 'running') return;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = gain;
    source.connect(g);
    g.connect(out);
    source.start();
  }

  let speed = 0;
  let load2 = 0;
  let lastLifting = 0;
  let vaultMoving = 0;
  let lastVault = 0;
  return {
    door(open) {
      shot(open ? 'door_open' : 'door_close', open ? 1.0 : 0.85);
    },
    vault() {},
    update(dt, { state, wheels, inside, camera, position, vault }) {
      if (ac.state !== 'running') return;
      const t = ac.currentTime;
      let level = 1;
      let p = 0;
      let distance = 0;
      if (camera && position) {
        const dx = position.x - camera.position.x;
        const dy = position.y - camera.position.y;
        const dz = position.z - camera.position.z;
        distance = Math.hypot(dx, dy, dz);
        const e = camera.matrixWorld.elements;
        p = clamp((dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(distance, 1), -1, 1) * (inside ? 0.15 : 0.7);
        level = inside ? 1 : 0.85 / (1 + (distance / 10) ** 2);
      }
      out.gain.setTargetAtTime(level, t, 0.1);
      pan.pan.setTargetAtTime(p, t, 0.1);
      far.frequency.setTargetAtTime(inside ? 20000 : Math.max(1200, 20000 - distance * 520), t, 0.2);
      let omega = 0;
      let n = 0;
      for (const w of wheels) {
        if (w.gone) continue;
        omega += Math.abs(w.omega);
        n++;
      }
      const wheelSpeed = n ? (omega / n) * 0.445 : 0;
      speed += (wheelSpeed - speed) * Math.min(1, dt * 10);
      const on = state.occupied && !state.stalled ? 1 : 0;
      const want = on * clamp(Math.max(state.throttle, state.pivot * 0.8), 0, 1) * (state.powerScale ?? 1);
      load2 += (want - load2) * Math.min(1, dt * (want > load2 ? 9 : 4));
      motor.set({ speed, load: load2, regen: state.regen, reverse: state.reverse, on, open: inside ? 1 : 0.7 }, t, dt);
      const kmh = state.speed * 3.6;
      const ground = wheels.some((w) => w.contact) ? 1 : 0;
      cabin.frequency.setTargetAtTime(inside ? 1500 : 9000, t, 0.2);
      set('tyre', ground * smooth(3, 120, kmh) * (inside ? 0.55 : 0.75), 0.75 + 0.5 * clamp(kmh / 200, 0, 1), 0.15);
      const lifting = state.lifting || 0;
      set('compressor', lifting > 0 ? (inside ? 0.32 : 0.5) : 0, 1, 0.12);
      set('hiss', lifting < 0 ? (inside ? 0.28 : 0.42) : 0, 1, 0.1);
      if (lastLifting < 0 && lifting === 0) shot('hiss_end', 0.5);
      lastLifting = lifting;
      const v = vault ? vault.value : 0;
      vaultMoving += ((Math.abs(v - lastVault) > 1e-5 ? 1 : 0) - vaultMoving) * Math.min(1, dt * 12);
      lastVault = v;
      set('vault', vaultMoving * (inside ? 0.35 : 0.6), 1, 0.05);
    },
  };
}

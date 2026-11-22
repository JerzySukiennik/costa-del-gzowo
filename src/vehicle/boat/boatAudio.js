// Costa del Gzowo boats: recorded engine, motor, hull-wash, fire and flooding loops mixed per boat by throttle, speed, depth and damage, plus one-shot hull impacts, placed around the camera.
const LEAD = 0.25;
const LENGTH = 8;
const cache = new Map();

function load(ac, base, name) {
  const key = base + name;
  if (!cache.has(key)) {
    cache.set(key, fetch(`${base}assets/vehicles/boat/audio/${name}.mp3`).then((r) => r.arrayBuffer()).then((d) => ac.decodeAudioData(d)).catch(() => null));
  }
  return cache.get(key);
}

export function createBoatAudio(audio, base, layers) {
  const ac = audio && audio.context;
  if (!ac) return { update() {}, play() {} };
  const out = ac.createGain();
  out.gain.value = 0;
  const pan = ac.createStereoPanner();
  const far = ac.createBiquadFilter();
  far.type = 'lowpass';
  far.frequency.value = 20000;
  out.connect(far);
  far.connect(pan);
  pan.connect(audio.master || ac.destination);
  const voices = layers.map((layer) => ({ layer, source: null, gain: null, buffer: null, level: 0, rate: 1 }));
  for (const v of voices) {
    load(ac, base, v.layer.file).then((buffer) => {
      v.buffer = buffer;
    });
  }

  function start(v) {
    if (v.source || !v.buffer) return;
    const source = ac.createBufferSource();
    source.buffer = v.buffer;
    source.loop = true;
    source.loopStart = LEAD;
    source.loopEnd = Math.min(v.buffer.duration - 0.01, LEAD + LENGTH);
    const gain = ac.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(out);
    source.start(0, LEAD + Math.random() * LENGTH * 0.8);
    v.source = source;
    v.gain = gain;
  }

  function stop(v) {
    if (!v.source) return;
    try {
      v.source.stop();
    } catch (e) {
      v.level = 0;
    }
    v.source.disconnect();
    v.gain.disconnect();
    v.source = null;
    v.gain = null;
  }

  const shots = {};
  for (const name of ['hull_crunch', 'hull_crack']) load(ac, base, name).then((buffer) => (shots[name] = buffer));
  let silent = 0;
  let lastShot = 0;
  return {
    play(name, gain = 1) {
      const buffer = shots[name];
      if (!buffer || ac.state !== 'running' || ac.currentTime - lastShot < 0.08) return;
      lastShot = ac.currentTime;
      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.85 + Math.random() * 0.3;
      const g = ac.createGain();
      g.gain.value = gain;
      source.connect(g);
      g.connect(out);
      source.onended = () => g.disconnect();
      source.start();
      silent = 0;
    },
    update(dt, { state, camera, position, inside }) {
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
        p = Math.max(-1, Math.min(1, (dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(distance, 1))) * (inside ? 0.2 : 0.7);
        level = 1 / (1 + (distance / 40) ** 2);
      }
      let total = 0;
      for (const v of voices) {
        v.level = v.layer.gain(state, inside) * level;
        v.rate = v.layer.rate ? v.layer.rate(state, inside) : 1;
        total += v.level;
      }
      silent = total < 0.004 ? silent + dt : 0;
      for (const v of voices) {
        if (silent > 1.5) {
          stop(v);
          continue;
        }
        start(v);
        if (!v.source) continue;
        v.gain.gain.setTargetAtTime(v.level, t, 0.09);
        v.source.playbackRate.setTargetAtTime(Math.max(0.3, v.rate), t, 0.09);
      }
      out.gain.setTargetAtTime(1, t, 0.1);
      pan.pan.setTargetAtTime(p, t, 0.1);
      far.frequency.setTargetAtTime(distance > 50 ? Math.max(900, 20000 - (distance - 50) * 110) : 20000, t, 0.2);
    },
  };
}

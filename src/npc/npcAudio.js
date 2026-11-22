// Costa del Gzowo: positional sounds for pedestrians and traffic from real recordings (horns, engine hum of the nearest cars, tyre squeal, body thud), played through the game's audio context.
const FILES = { horn_a: 'assets/npc/audio/horn_a.mp3', horn_b: 'assets/npc/audio/horn_b.mp3', engine: 'assets/npc/audio/engine.mp3', thud: 'assets/npc/audio/thud.mp3', squeal: 'assets/audio/skid.mp3' };
const VOICES = 3;

export function createNpcAudio(ctx) {
  const audio = ctx.audio;
  const ac = audio && audio.context;
  if (!ac) return { update() {}, horn() {}, squeal() {}, thud() {} };
  const out = audio.master || ac.destination;
  const buffers = {};
  for (const [name, url] of Object.entries(FILES)) {
    fetch(url).then((r) => r.arrayBuffer()).then((data) => ac.decodeAudioData(data)).then((buffer) => {
      buffers[name] = buffer;
    }).catch(() => {});
  }
  const camera = ctx.camera;
  const place = { gain: 0, pan: 0, dist: 0 };
  const voices = [];

  function locate(x, y, z, reach) {
    const dx = x - camera.position.x;
    const dy = y - camera.position.y;
    const dz = z - camera.position.z;
    const d = Math.hypot(dx, dy, dz);
    const e = camera.matrixWorld.elements;
    place.dist = d;
    place.pan = Math.min(1, Math.max(-1, (dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(d, 1))) * 0.7;
    place.gain = 1 / (1 + (d / reach) ** 2);
    return place;
  }

  function shot(name, x, y, z, gain, rate, reach, offset = 0, duration = 0) {
    const buffer = buffers[name];
    if (!buffer || ac.state !== 'running') return;
    const p = locate(x, y, z, reach);
    if (p.gain * gain < 0.004) return;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const g = ac.createGain();
    g.gain.value = gain * p.gain;
    const pan = ac.createStereoPanner();
    pan.pan.value = p.pan;
    source.connect(g);
    g.connect(pan);
    pan.connect(out);
    if (duration) {
      g.gain.setValueAtTime(gain * p.gain, ac.currentTime + Math.max(0.02, duration - 0.12));
      g.gain.linearRampToValueAtTime(0, ac.currentTime + duration);
      source.start(0, offset, duration + 0.02);
    } else source.start(0, offset);
  }

  function voice() {
    const source = ac.createBufferSource();
    source.buffer = buffers.engine;
    source.loop = true;
    source.loopStart = 0.2;
    source.loopEnd = buffers.engine.duration - 0.2;
    const g = ac.createGain();
    g.gain.value = 0;
    const pan = ac.createStereoPanner();
    source.connect(g);
    g.connect(pan);
    pan.connect(out);
    source.start(0, Math.random() * 3);
    return { source, gain: g.gain, pan: pan.pan, car: null };
  }

  return {
    horn(car) {
      const twice = car.index % 3 === 1;
      shot(twice ? 'horn_b' : 'horn_a', car.x, car.y + 1, car.z, twice ? 1.3 : 0.75, 0.92 + (car.index % 5) * 0.04, 26);
    },
    squeal(car) {
      shot('squeal', car.x, car.y, car.z, 0.5, 1.05, 16, 0.4, 1.1);
    },
    thud(x, y, z, speed) {
      shot('thud', x, y, z, Math.min(1, 0.35 + speed * 0.06), 0.9 + Math.random() * 0.2, 12);
    },
    update(cars) {
      if (!buffers.engine || ac.state !== 'running') return;
      while (voices.length < VOICES) voices.push(voice());
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        if (v.car && (!v.car.active || v.car.dist > 75)) v.car = null;
      }
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        if (!car.active || car.dist > 60) continue;
        let slot = null;
        let far = null;
        let taken = false;
        for (let k = 0; k < voices.length; k++) {
          const v = voices[k];
          if (v.car === car) taken = true;
          else if (!v.car) slot = v;
          else if (!far || v.car.dist > far.car.dist) far = v;
        }
        if (taken) continue;
        if (!slot && far && far.car.dist > car.dist + 6) slot = far;
        if (slot) slot.car = car;
      }
      const t = ac.currentTime;
      for (const v of voices) {
        const car = v.car;
        if (!car) {
          v.gain.setTargetAtTime(0, t, 0.15);
          continue;
        }
        const p = locate(car.x, car.y + 0.6, car.z, 11);
        const toward = car.dist > 1 ? (car.hx * (camera.position.x - car.x) + car.hz * (camera.position.z - car.z)) / car.dist : 0;
        v.gain.setTargetAtTime(p.gain * (0.5 + Math.min(1, car.v / 12) * 1.4 + Math.max(0, car.a) * 0.25), t, 0.12);
        v.pan.setTargetAtTime(p.pan, t, 0.1);
        v.source.playbackRate.setTargetAtTime((0.85 + car.v / 16 + Math.max(0, car.a) * 0.06) * (1 + (toward * car.v) / 340), t, 0.12);
      }
    },
  };
}

// Costa del Gzowo: game audio from real recordings (engine layers, tyres, impacts, water, ambience, footsteps) mixed by gameplay state.
import { WORLD } from '../config.js';
import { riverCenter, riverHalfWidth } from '../world/heightfield.js';
import { GROUND } from '../world/terrain.js';

const FILES = ['engine_low', 'engine_high', 'skid', 'gravel', 'wind', 'scrape', 'crash1', 'crash2', 'crash3', 'glass', 'door_open', 'door_close', 'river', 'birds', 'trees', 'splash_big', 'splash_small', 'underwater', 'steps_gravel', 'steps_concrete', 'steps_grass', 'steps_water', 'swim', 'plastic', 'roof'];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export async function createAudio(ctx) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const master = ac.createGain();
  const muffle = ac.createBiquadFilter();
  const limiter = ac.createDynamicsCompressor();
  muffle.type = 'lowpass';
  muffle.frequency.value = 20000;
  limiter.threshold.value = -9;
  limiter.ratio.value = 6;
  master.gain.value = 0.8;
  master.connect(muffle);
  muffle.connect(limiter);
  limiter.connect(ac.destination);

  const buffers = {};
  let onsets = {};
  try {
    onsets = await (await fetch('assets/audio/onsets.json')).json();
  } catch (e) {
    onsets = {};
  }
  await Promise.all(
    FILES.map(async (name) => {
      try {
        const data = await (await fetch(`assets/audio/${name}.mp3`)).arrayBuffer();
        buffers[name] = await ac.decodeAudioData(data);
      } catch (e) {
        buffers[name] = null;
      }
    }),
  );

  function loop(name, { gain = 0, rate = 1, pan = false } = {}) {
    const buffer = buffers[name];
    const g = ac.createGain();
    g.gain.value = gain;
    const p = pan ? ac.createStereoPanner() : null;
    if (p) {
      g.connect(p);
      p.connect(master);
    } else g.connect(master);
    let source = null;
    return {
      gain: g.gain,
      pan: p ? p.pan : null,
      rate: null,
      start() {
        if (!buffer || source) return;
        source = ac.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = Math.min(0.08, buffer.duration * 0.1);
        source.loopEnd = buffer.duration - Math.min(0.12, buffer.duration * 0.1);
        source.playbackRate.value = rate;
        source.connect(g);
        source.start(0, Math.random() * buffer.duration * 0.5);
        this.rate = source.playbackRate;
      },
      set(target, time = 0.08) {
        g.gain.setTargetAtTime(target, ac.currentTime, time);
      },
      setRate(value, time = 0.05) {
        if (this.rate) this.rate.setTargetAtTime(value, ac.currentTime, time);
      },
    };
  }

  const loops = {
    engineLow: loop('engine_low', { pan: true }),
    engineHigh: loop('engine_high', { pan: true }),
    skid: loop('skid'),
    gravel: loop('gravel'),
    wind: loop('wind'),
    scrape: loop('scrape'),
    river: loop('river'),
    birds: loop('birds'),
    trees: loop('trees'),
    underwater: loop('underwater'),
    swim: loop('swim'),
  };
  let cameraRef = ctx.camera;
  let started = false;
  let scrapeLevel = 0;
  function stream() {
    const element = new Audio();
    element.preload = 'auto';
    const s = {
      element, level: 0, target: 0, rate: 1, url: '', failed: false, onEnded: null, onError: null,
      play(url, { offset = 0, loop = true } = {}) {
        s.failed = false;
        element.loop = loop;
        if (s.url !== url) {
          s.url = url;
          element.src = url;
        }
        const begin = () => {
          const length = Number.isFinite(element.duration) ? element.duration : 0;
          element.currentTime = length > 2 ? Math.min(offset, length - 2) : 0;
          const result = element.play();
          if (result && result.catch) result.catch(() => {});
        };
        if (element.readyState >= 1) begin();
        else element.addEventListener('loadedmetadata', begin, { once: true });
      },
      fade(level, seconds = 1) {
        s.target = level;
        s.rate = 1 / Math.max(seconds, 0.05);
        if (level > 0 && element.paused && s.url && !s.failed) {
          const result = element.play();
          if (result && result.catch) result.catch(() => {});
        }
      },
      tick(dt, volume) {
        const diff = s.target - s.level;
        if (diff !== 0) s.level += Math.sign(diff) * Math.min(Math.abs(diff), dt * s.rate);
        element.volume = clamp(s.level * volume, 0, 1);
        if (s.level === 0 && s.target === 0 && !element.paused) element.pause();
      },
    };
    element.addEventListener('error', () => {
      s.failed = true;
      if (s.onError) s.onError();
    });
    element.addEventListener('ended', () => {
      if (s.onEnded) s.onEnded();
    });
    return s;
  }
  const music = stream();
  const radio = stream();
  let musicVolume = 0.6;

  function spatial(point) {
    if (!point || !cameraRef) return { gain: 1, pan: 0 };
    const dx = point.x - cameraRef.position.x;
    const dy = point.y - cameraRef.position.y;
    const dz = point.z - cameraRef.position.z;
    const d = Math.hypot(dx, dy, dz);
    const e = cameraRef.matrixWorld.elements;
    const pan = clamp((dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(d, 1), -1, 1) * 0.7;
    return { gain: 1 / (1 + (d / 9) ** 2), pan };
  }

  function shot(name, { gain = 1, rate = 1, point = null, offset = 0, duration = undefined } = {}) {
    const buffer = buffers[name];
    if (!buffer || !started) return;
    const s = spatial(point);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const g = ac.createGain();
    g.gain.value = gain * s.gain;
    const p = ac.createStereoPanner();
    p.pan.value = s.pan;
    source.connect(g);
    g.connect(p);
    p.connect(master);
    if (duration) {
      g.gain.setValueAtTime(gain * s.gain, ac.currentTime + Math.max(0.02, duration - 0.06));
      g.gain.linearRampToValueAtTime(0, ac.currentTime + duration);
      source.start(0, offset, duration + 0.02);
    } else source.start(0, offset);
  }

  function step(name, point, gain) {
    const list = onsets[name];
    if (!list || !list.length) {
      const buffer = buffers[name];
      shot(name, { gain, point, rate: 0.92 + Math.random() * 0.16, offset: buffer ? Math.random() * Math.max(0, buffer.duration - 0.6) : 0, duration: 0.42 });
      return;
    }
    const o = list[Math.floor(Math.random() * list.length)];
    shot(name, { gain, point, rate: 0.92 + Math.random() * 0.16, offset: Math.max(0, o[0] - 0.015), duration: o[1] });
  }

  const api = {
    context: ac,
    master,
    start() {
      if (started) return;
      started = true;
      ac.resume();
      for (const l of Object.values(loops)) l.start();
    },
    setPaused(on) {
      if (!started) return;
      if (on) ac.suspend();
      else ac.resume();
    },
    setVolume(v) {
      master.gain.setTargetAtTime(v, ac.currentTime, 0.05);
    },
    music,
    radio,
    setMusicVolume(v) {
      musicVolume = v;
    },
    tickMusic(dt) {
      music.tick(dt, musicVolume);
      radio.tick(dt, musicVolume);
    },
    crash(dv, kind, point) {
      const soft = kind === 'plastic' || kind === 'soft' || kind === 'rubber';
      if (soft) {
        shot('plastic', { gain: clamp(dv / 6, 0.2, 1), point, rate: 0.85 + Math.random() * 0.3 });
        return;
      }
      const name = dv > 6 ? 'crash1' : dv > 2.5 ? 'crash2' : 'crash3';
      shot(name, { gain: clamp(0.25 + dv / 9, 0.25, 1.3), point, rate: 0.9 + Math.random() * 0.2 });
    },
    glass(amount) {
      shot('glass', { gain: 0.4 + amount * 0.6, rate: 0.95 + Math.random() * 0.1 });
    },
    door(open) {
      shot(open ? 'door_open' : 'door_close', { gain: 0.8 });
    },
    splash(size, point) {
      shot(size > 0.75 ? 'splash_big' : 'splash_small', { gain: clamp(0.35 + size, 0.3, 1.4), point, rate: size > 0.75 ? 0.92 + Math.random() * 0.1 : 0.9 + Math.random() * 0.25 });
    },
    footstep(surface, point, speed) {
      const gain = clamp(0.25 + speed * 0.07, 0.25, 0.7);
      if (surface === 'water') step('steps_water', point, gain * 1.2);
      else if (surface === 'hard') step('steps_concrete', point, gain);
      else if (surface === GROUND.GRAVEL || surface === GROUND.PEBBLES || surface === GROUND.DIRT || surface === GROUND.ROCK) step('steps_gravel', point, gain);
      else step('steps_grass', point, gain * 1.1);
    },
    land(speed, point) {
      step('steps_gravel', point, clamp(speed / 8, 0.4, 1));
    },
    jump() {},
    roof() {
      shot('roof', { gain: 0.5 });
    },
    setScrape(level) {
      scrapeLevel = level;
    },
    update(dt, { game, car, player, camera, water }) {
      if (!started) return;
      cameraRef = camera;
      const cs = car.state;
      const s = spatial(car.position);
      const inside = game.mode === 'car' ? 1 : 0;
      const carGain = inside ? 1 : s.gain * 0.9;
      const rpm = cs.rpm;
      const on = cs.engineOn && !cs.stalled ? 1 : 0;
      const load = 0.55 + 0.45 * cs.throttle;
      loops.engineLow.set(on * carGain * (1 - smooth(1900, 3600, rpm)) * (0.5 + 0.3 * cs.throttle), 0.06);
      loops.engineHigh.set(on * carGain * smooth(1400, 3200, rpm) * load * 0.8, 0.06);
      loops.engineLow.setRate(clamp(rpm / 950, 0.7, 3.2));
      loops.engineHigh.setRate(clamp(rpm / 4300, 0.42, 1.75));
      if (loops.engineLow.pan) loops.engineLow.pan.value = inside ? 0 : s.pan;
      if (loops.engineHigh.pan) loops.engineHigh.pan.value = inside ? 0 : s.pan;
      const speed = cs.speed;
      const hard = car.wheels.some((w) => w.contact && (w.surface === 'asphalt' || w.surface === 'concrete'));
      const loose = car.wheels.reduce((a, w) => a + (w.contact ? w.surf.loose : 0), 0) / 4;
      loops.skid.set(hard ? clamp(cs.skid * 1.3, 0, 0.9) * carGain : 0, 0.05);
      loops.skid.setRate(0.85 + clamp(speed / 60, 0, 0.4));
      loops.gravel.set(clamp(loose * (speed / 14 + cs.skid), 0, 0.9) * carGain + (hard ? clamp(speed / 55, 0, 0.35) * carGain * 0.5 : 0), 0.1);
      loops.gravel.setRate(0.7 + clamp(speed / 40, 0, 0.8));
      const camSpeed = inside ? speed : player.state.speed + (player.state.grounded ? 0 : Math.abs(player.state.vy));
      const underwater = water && water.cameraUnderwater ? 1 : 0;
      loops.wind.set((0.05 + clamp(camSpeed / 45, 0, 1) ** 1.6 * 0.85) * (1 - underwater), 0.15);
      loops.wind.setRate(0.8 + clamp(camSpeed / 60, 0, 0.6));
      loops.scrape.set(scrapeLevel * 0.8 * carGain, 0.04);
      const cx = camera.position.x;
      const cz = camera.position.z;
      const toRiver = Math.max(0, Math.abs(cx - riverCenter(cz)) - riverHalfWidth(cz));
      const height = Math.max(0, camera.position.y - WORLD.waterLevel);
      const riverGain = 0.75 / (1 + (Math.hypot(toRiver, height * 0.6) / 14) ** 2);
      loops.river.set(riverGain * (1 - underwater) * (1 - inside * clamp(speed / 30, 0, 0.6)), 0.3);
      loops.birds.set(0.3 * (1 - underwater) * (1 - inside * clamp(speed / 25, 0, 0.7)), 0.4);
      loops.trees.set(0.2 * (1 - underwater), 0.4);
      loops.underwater.set(underwater * 0.9, 0.08);
      muffle.frequency.setTargetAtTime(underwater ? 520 : 20000, ac.currentTime, 0.05);
      const swimming = game.mode === 'foot' && player.state.mode === 'swim' ? clamp(player.state.speed / 1.5, 0.15, 1) : 0;
      loops.swim.set(swimming * 0.6, 0.15);
    },
  };
  return api;
}

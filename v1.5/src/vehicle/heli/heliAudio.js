// Costa del Gzowo helicopter: recorded rotor, turbine and cabin loops pitched and mixed by rotor speed and blade load, plus the turbine start, placed around the camera.
const LOOPS = { rotor: ['rotor_loop', 0.25, 2.5366], turbine: ['turbine_loop', 0.25, 7.5897], cabin: ['cabin_loop', 0.25, 7.7553] };

export function createHeliAudio(audio, base = '') {
  const ac = audio && audio.context;
  if (!ac) return { update() {} };
  const out = ac.createGain();
  out.gain.value = 0;
  const pan = ac.createStereoPanner();
  const far = ac.createBiquadFilter();
  far.type = 'lowpass';
  far.frequency.value = 20000;
  out.connect(far);
  far.connect(pan);
  pan.connect(audio.master || ac.destination);
  const buffers = {};
  const voices = {};
  const load = async (name) => {
    try {
      const data = await (await fetch(`${base}assets/vehicles/heli/audio/${name}.mp3`)).arrayBuffer();
      buffers[name] = await ac.decodeAudioData(data);
    } catch (e) {
      buffers[name] = null;
    }
  };
  for (const [name] of Object.values(LOOPS)) load(name);
  load('start');

  function voice(key) {
    if (voices[key]) return voices[key];
    const [name, lead, length] = LOOPS[key];
    const buffer = buffers[name];
    if (!buffer) return null;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = lead;
    source.loopEnd = Math.min(buffer.duration - 0.01, lead + length);
    const gain = ac.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(out);
    source.start(0, lead + Math.random() * length * 0.5);
    voices[key] = { source, gain };
    return voices[key];
  }

  function set(key, level, rate) {
    const v = voice(key);
    if (!v) return;
    const t = ac.currentTime;
    v.gain.gain.setTargetAtTime(level, t, 0.08);
    v.source.playbackRate.setTargetAtTime(Math.max(0.2, rate), t, 0.08);
  }

  let wasOn = false;
  let starter = null;
  return {
    update(dt, { state, camera, position, inside }) {
      if (ac.state !== 'running') return;
      const t = ac.currentTime;
      const r = state.rotor;
      const load = Math.min(1.3, state.lift);
      let level = 1;
      let p = 0;
      let distance = 0;
      if (camera && position) {
        const dx = position.x - camera.position.x;
        const dy = position.y - camera.position.y;
        const dz = position.z - camera.position.z;
        distance = Math.hypot(dx, dy, dz);
        const e = camera.matrixWorld.elements;
        p = Math.max(-1, Math.min(1, (dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(distance, 1))) * (inside ? 0.25 : 0.7);
        level = 1 / (1 + (distance / 55) ** 2);
      }
      out.gain.setTargetAtTime(level * 0.95, t, 0.1);
      pan.pan.setTargetAtTime(p, t, 0.1);
      far.frequency.setTargetAtTime(distance > 60 ? Math.max(900, 20000 - (distance - 60) * 90) : 20000, t, 0.2);
      const turning = state.occupied && !state.stalled && !state.rotorBroken;
      if (turning && !wasOn && r < 0.2 && buffers.start) {
        starter = ac.createBufferSource();
        starter.buffer = buffers.start;
        const g = ac.createGain();
        g.gain.value = 0.7;
        starter.connect(g);
        g.connect(out);
        starter.start();
      }
      if (!turning && starter) {
        try {
          starter.stop(t + 0.4);
        } catch (e) {
          starter = null;
        }
        starter = null;
      }
      wasOn = turning;
      const slap = 0.32 + 0.5 * load + 0.18 * Math.min(1, Math.abs(state.roll) + Math.abs(state.pitch));
      set('rotor', r * r * slap * (inside ? 0.8 : 1), 0.52 + 0.6 * r + 0.035 * (load - 1));
      set('turbine', Math.min(1, r * 1.5) * (turning ? 0.5 : 0.3) * (0.7 + 0.3 * load), 0.5 + 0.55 * r);
      set('cabin', inside ? r * r * 0.42 : 0, 0.82 + 0.2 * r + 0.05 * load);
    },
  };
}

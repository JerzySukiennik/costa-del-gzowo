// Costa del Gzowo: in-car radio with genre stations that keep broadcasting while you are tuned elsewhere.
import { RADIO } from '../config.js';
import { createRadioSwitcher } from '../ui/radioSwitcher.js';

export async function createRadio({ audio }) {
  let library = {};
  try {
    const response = await fetch('assets/music/tracks.json');
    if (response.ok) library = await response.json();
  } catch (e) {
    library = {};
  }
  const stations = RADIO.map((s) => ({ ...s, tracks: library[s.id] || [] })).filter((s) => s.tracks.length > 0);
  const available = stations.length > 0;
  const switcher = available ? createRadioSwitcher(document.getElementById('radio'), stations) : null;
  const stream = audio.radio;
  const offsets = stations.map((station, i) => Math.random() * 900 + i * 131);
  const saved = parseInt(localStorage.getItem('costa-radio'), 10);
  let station = Number.isInteger(saved) && saved >= -1 && saved < stations.length ? saved : 0;
  let active = false;
  let track = 0;

  function position(index) {
    const tracks = stations[index].tracks;
    const total = tracks.reduce((sum, t) => sum + t.duration, 0);
    let t = (performance.now() / 1000 + offsets[index]) % total;
    for (let k = 0; k < tracks.length; k++) {
      if (t < tracks[k].duration) return { k, t };
      t -= tracks[k].duration;
    }
    return { k: 0, t: 0 };
  }

  function announce(text) {
    if (!switcher) return;
    if (station < 0) {
      switcher.show(-1, '');
      return;
    }
    const t = stations[station].tracks[track];
    switcher.show(station, text || `${t.title} · ${t.artist}`);
  }

  function tune() {
    if (!active || station < 0) {
      stream.fade(0, 0.35);
      if (active) announce();
      return;
    }
    const spot = position(station);
    track = spot.k;
    stream.level = 0;
    stream.play('assets/music/' + stations[station].tracks[track].file, { offset: spot.t, loop: false });
    stream.fade(0.9, 0.5);
    announce();
  }

  stream.onEnded = () => {
    if (!active || station < 0) return;
    const tracks = stations[station].tracks;
    track = (track + 1) % tracks.length;
    stream.play('assets/music/' + tracks[track].file, { offset: 0, loop: false });
    announce();
  };
  stream.onError = () => {
    if (active && station >= 0) announce('No signal');
  };

  return {
    available,
    stations,
    get active() {
      return active;
    },
    enter() {
      if (!available || active) return;
      active = true;
      tune();
    },
    exit() {
      active = false;
      stream.fade(0, 0.8);
    },
    kill() {
      if (!active) return;
      active = false;
      stream.fade(0, 0.2);
    },
    step(direction) {
      if (!available || !active) return;
      const slots = stations.length + 1;
      const current = station < 0 ? stations.length : station;
      const next = (current + direction + slots) % slots;
      station = next === stations.length ? -1 : next;
      localStorage.setItem('costa-radio', String(station));
      tune();
    },
    pause(on) {
      if (on) stream.fade(0, 0.3);
      else if (active && station >= 0) stream.fade(0.9, 0.6);
    },
  };
}

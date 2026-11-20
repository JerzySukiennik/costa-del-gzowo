// Costa del Gzowo: in-car radio with genre stations that keep broadcasting while you are tuned elsewhere; tracks come from local files or the now-playing deck.
import { RADIO } from '../config.js';
import { createRadioSwitcher } from '../ui/radioSwitcher.js';

export async function createRadio({ audio, deck = null, folders = ['assets/music/', 'assets/music-public/'] }) {
  let library = {};
  let base = folders[0];
  for (const folder of folders) {
    try {
      const response = await fetch(folder + 'tracks.json');
      if (!response.ok) continue;
      library = await response.json();
      base = folder;
      break;
    } catch (e) {
      library = {};
    }
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
  let onDeck = false;

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

  function silence(seconds) {
    stream.fade(0, seconds);
    if (onDeck && deck) deck.fade(0, seconds, 'radio');
  }

  function next() {
    if (!active || station < 0) return;
    track = (track + 1) % stations[station].tracks.length;
    start(0);
    announce();
  }

  function start(offset) {
    const s = stations[station];
    const t = s.tracks[track];
    if (t.youtube) {
      stream.fade(0, 0.3);
      onDeck = !!deck && deck.play({
        id: t.youtube, start: offset, loop: false, title: t.title, artist: t.artist, label: `${s.name} ${s.frequency}`, place: 'drive', owner: 'radio',
        onEnded: next,
        onError: () => {
          onDeck = false;
          if (active && station >= 0) announce('No signal');
        },
      });
      if (onDeck) deck.fade(0.9, 0.5, 'radio');
      return onDeck;
    }
    if (onDeck && deck) deck.fade(0, 0.3, 'radio');
    onDeck = false;
    stream.level = 0;
    stream.play(base + t.file, { offset, loop: false });
    stream.fade(0.9, 0.5);
    return true;
  }

  function tune() {
    if (!active || station < 0) {
      silence(0.35);
      if (active) announce();
      return;
    }
    const spot = position(station);
    track = spot.k;
    announce(start(spot.t) ? '' : 'No signal');
  }

  stream.onEnded = next;
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
      silence(0.8);
    },
    kill() {
      if (!active) return;
      active = false;
      silence(0.2);
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
      if (on) silence(0.3);
      else if (active && station >= 0) {
        if (stations[station].tracks[track].youtube) tune();
        else stream.fade(0.9, 0.6);
      }
    },
  };
}

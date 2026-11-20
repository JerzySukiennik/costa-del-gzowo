// Costa del Gzowo: title and menu music; local files when present, otherwise the official upload in the now-playing card, otherwise Gzowo Labs' own tracks.
import { MUSIC } from '../config.js';

export function createSoundtrack({ audio, deck, local, onTrack }) {
  const stream = audio.music;
  let mode = local ? 'file' : 'deck';
  let wanted = null;

  function file(url, level, seconds) {
    if (stream.url !== url) {
      stream.level = 0;
      stream.play(url, { loop: true });
    }
    stream.fade(level, seconds);
  }

  function own(name, level, seconds) {
    const track = MUSIC[name].own;
    stream.onError = () => onTrack(null);
    file(track.url, level, seconds);
    onTrack(name === 'title' ? track : null);
  }

  function play(name, level = 1, seconds = 1.5) {
    const track = MUSIC[name];
    wanted = name;
    if (mode === 'deck' && deck && !deck.usable) {
      onTrack(null);
      deck.ready.then((ok) => {
        if (!ok) mode = 'own';
        if (wanted === name) play(name, level, seconds);
      });
      return;
    }
    if (mode === 'file') {
      stream.onError = () => onTrack(null);
      file(track.url, level, seconds);
      onTrack(name === 'title' ? track : null);
      return;
    }
    const started = mode === 'deck' && deck && deck.play({
      id: track.youtube, loop: true, title: track.title, artist: track.artist, label: 'Now playing', place: 'menu', owner: 'music',
      onError: () => {
        mode = 'own';
        own(name, level, seconds);
      },
    });
    if (started) {
      stream.fade(0, 0.3);
      deck.fade(level, seconds, 'music');
      onTrack(null);
    } else own(name, level, seconds);
  }

  return {
    play,
    fade(level, seconds) {
      if (level === 0) wanted = null;
      stream.fade(level, seconds);
      if (deck) deck.fade(level, seconds, 'music');
    },
    get mode() {
      return mode;
    },
  };
}

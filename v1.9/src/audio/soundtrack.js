// Costa del Gzowo: title and menu music; the local library when present, otherwise the game's own soundtrack.
import { MUSIC } from '../config.js';

export function createSoundtrack({ audio, local, onTrack }) {
  const stream = audio.music;
  const mode = local ? 'file' : 'own';

  function play(name, level = 1, seconds = 1.5) {
    const track = local ? MUSIC[name] : MUSIC[name].own;
    stream.onError = () => onTrack(null);
    if (stream.url !== track.url) {
      stream.level = 0;
      stream.play(track.url, { loop: true });
    }
    stream.fade(level, seconds);
    onTrack(name === 'title' ? track : null);
  }

  return {
    play,
    fade(level, seconds) {
      stream.fade(level, seconds);
    },
    get mode() {
      return mode;
    },
  };
}

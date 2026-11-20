// Costa del Gzowo: now-playing card with the official YouTube player, for tracks that are streamed instead of shipped with the game.
const API = 'https://www.youtube.com/iframe_api';

export function createDeck() {
  const card = document.createElement('aside');
  card.id = 'deck';
  card.setAttribute('aria-label', 'Now playing');
  card.innerHTML = '<div class="deck-frame"><div id="deck-player"></div></div><div class="deck-meta"><div class="deck-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="deck-text"><div class="deck-label"></div><div class="deck-title"></div><div class="deck-artist"></div></div></div>';
  document.body.append(card);
  const label = card.querySelector('.deck-label');
  const title = card.querySelector('.deck-title');
  const artist = card.querySelector('.deck-artist');

  let player = null;
  let usable = false;
  let level = 0;
  let target = 0;
  let rate = 1;
  let sentVolume = -1;
  let current = null;

  const ready = new Promise((resolve) => {
    const fail = () => resolve(false);
    const timer = setTimeout(fail, 9000);
    const build = () => {
      player = new window.YT.Player('deck-player', {
        width: 356,
        height: 200,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: () => {
            clearTimeout(timer);
            usable = true;
            resolve(true);
          },
          onStateChange: (e) => {
            card.classList.toggle('live', e.data === 1);
            if (e.data !== 0 || !current) return;
            if (current.loop) {
              player.seekTo(0, true);
              player.playVideo();
            } else if (current.onEnded) current.onEnded();
          },
          onError: () => {
            const failedTrack = current;
            current = null;
            target = 0;
            level = 0;
            card.classList.remove('on', 'live');
            if (failedTrack && failedTrack.onError) failedTrack.onError();
          },
        },
      });
    };
    if (window.YT && window.YT.Player) build();
    else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previous) previous();
        build();
      };
      const script = document.createElement('script');
      script.src = API;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      document.head.append(script);
    }
  });

  return {
    ready,
    get usable() {
      return usable;
    },
    get owner() {
      return current ? current.owner : null;
    },
    get state() {
      return { usable, level, target, id: current ? current.id : null, player: player && player.getPlayerState ? player.getPlayerState() : null };
    },
    play({ id, start = 0, loop = false, owner = 'music', place = 'menu', onEnded = null, onError = null, ...text }) {
      if (!usable) return false;
      const same = current && current.id === id && current.owner === owner;
      current = { id, loop, owner, onEnded, onError };
      label.textContent = text.label || 'Now playing';
      title.textContent = text.title || '';
      artist.textContent = text.artist || '';
      card.dataset.place = place;
      card.classList.add('on');
      if (same && loop) player.playVideo();
      else {
        level = 0;
        sentVolume = -1;
        player.setVolume(0);
        player.loadVideoById({ videoId: id, startSeconds: Math.max(0, Math.floor(start)) });
      }
      return true;
    },
    fade(next, seconds = 1, owner = 'music') {
      if (!usable || !current || current.owner !== owner) return;
      target = next;
      rate = 1 / Math.max(seconds, 0.05);
      if (next > 0) {
        card.classList.add('on');
        if (player.getPlayerState() === 2) player.playVideo();
      }
    },
    tick(dt, volume) {
      if (!usable || !current) return;
      const diff = target - level;
      if (diff !== 0) level += Math.sign(diff) * Math.min(Math.abs(diff), dt * rate);
      const wanted = Math.round(Math.min(1, Math.max(0, level * volume)) * 100);
      if (wanted !== sentVolume) {
        sentVolume = wanted;
        player.setVolume(wanted);
      }
      if (level === 0 && target === 0 && card.classList.contains('on')) {
        card.classList.remove('on', 'live');
        player.pauseVideo();
      }
    },
  };
}

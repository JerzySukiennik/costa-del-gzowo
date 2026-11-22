// Costa del Gzowo: shared worlds; claims one of four player slots in the first world that has room and keeps the list of who else is there.
import { NET } from './firebaseConfig.js';

const clean = (text, max) => String(text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

export async function joinWorld(backend, profile, onPlayers) {
  const { db, ref, uid, pid, now } = backend;
  const entry = () => ({ uid, pid, ts: db.serverTimestamp(), name: clean(profile.name, 16) || 'Player', car: clean(profile.car, 16) || 'convertible', avatar: clean(profile.avatar, 16) || 'default' });
  let world = null;
  let slot = -1;
  for (const w of NET.worlds.includes(profile.world) ? [profile.world] : NET.worlds) {
    const snap = await db.get(ref(`${NET.root}/worlds/${w}/slots`));
    const slots = snap.val() || {};
    for (let n = 0; n < NET.maxPlayers && slot < 0; n++) {
      const s = slots[n];
      if (s && s.pid !== pid && s.ts > now() - NET.staleMs) continue;
      try {
        const result = await db.runTransaction(ref(`${NET.root}/worlds/${w}/slots/${n}`), (current) => (current && current.pid !== pid && current.ts > now() - NET.staleMs ? undefined : entry()));
        if (result.committed) slot = n;
      } catch (error) {
        continue;
      }
    }
    if (slot >= 0) {
      world = w;
      break;
    }
  }
  if (slot < 0) throw new Error('Every world is full');
  const base = `${NET.root}/worlds/${world}`;
  const mine = ref(`${base}/slots/${slot}`);
  db.onDisconnect(ref(`${base}/signal/${slot}`)).remove();
  db.onDisconnect(ref(`${base}/relay/${slot}`)).remove();
  db.onDisconnect(mine).remove();
  const beat = setInterval(() => db.update(mine, { ts: db.serverTimestamp() }).catch(() => {}), NET.heartbeatMs);
  const stop = db.onValue(ref(`${base}/slots`), (snap) => {
    const slots = snap.val() || {};
    const players = [];
    for (let n = 0; n < NET.maxPlayers; n++) {
      const s = slots[n];
      if (!s || !s.pid) continue;
      if (n !== slot && s.ts && s.ts < now() - NET.staleMs * 1.5) continue;
      players.push({ slot: n, pid: s.pid, name: s.name || 'Player', car: s.car || 'convertible', avatar: s.avatar || 'default', me: n === slot });
    }
    if (!slots[slot] || slots[slot].pid !== pid) db.set(mine, entry()).catch(() => {});
    onPlayers(players);
  });
  return {
    world,
    slot,
    pid,
    base,
    setProfile(next) {
      Object.assign(profile, next);
      return db.set(mine, entry()).catch(() => {});
    },
    leave() {
      clearInterval(beat);
      stop();
      db.remove(ref(`${base}/signal/${slot}`)).catch(() => {});
      db.remove(ref(`${base}/relay/${slot}`)).catch(() => {});
      db.remove(mine).catch(() => {});
    },
  };
}

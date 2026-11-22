// Costa del Gzowo: peer-to-peer links between the players of one world (WebRTC data channels, signalled through the database, with a slow database relay when a direct link cannot be made).
import { NET } from './firebaseConfig.js';

const toBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0)).buffer;

export function createMesh(backend, lobby, { onState, onLink }) {
  const { db, ref } = backend;
  const links = new Map();
  const stops = [];
  let relayTimer = 0;
  let relayLast = null;

  const outbox = (to) => ref(`${lobby.base}/signal/${to}/${lobby.slot}`);
  const post = (to, link, message) => db.push(outbox(to), JSON.stringify({ ...message, p: lobby.pid, t: link.pid, s: link.session })).catch(() => {});

  function wire(link, channel) {
    channel.binaryType = 'arraybuffer';
    link.channel = channel;
    channel.onclose = () => {
      if (link.channel === channel) link.open = false;
    };
    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) onState(link.slot, event.data);
    };
  }

  function close(link) {
    if (link.relayStop) link.relayStop();
    link.relayStop = null;
    if (link.channel) link.channel.onmessage = null;
    try {
      if (link.pc) link.pc.close();
    } catch (error) {
      link.pc = null;
    }
    link.pc = null;
    link.channel = null;
    link.open = false;
  }

  function start(link) {
    close(link);
    link.since = performance.now();
    link.queue = [];
    link.described = false;
    const pc = new RTCPeerConnection({ iceServers: NET.iceServers });
    link.pc = pc;
    pc.onicecandidate = (event) => {
      if (event.candidate) post(link.slot, link, { k: 'i', d: JSON.stringify(event.candidate) });
    };
    pc.onconnectionstatechange = () => {
      if (link.pc !== pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        link.open = false;
        link.retry = performance.now() + 4000;
      }
    };
    pc.ondatachannel = (event) => wire(link, event.channel);
    return pc;
  }

  async function offer(link) {
    link.session = Math.random().toString(36).slice(2, 9);
    const pc = start(link);
    wire(link, pc.createDataChannel('state', { ordered: false, maxRetransmits: 0 }));
    await pc.setLocalDescription(await pc.createOffer());
    post(link.slot, link, { k: 'o', d: pc.localDescription.sdp });
  }

  async function handle(link, message) {
    if (message.t !== lobby.pid || message.p !== link.pid) return;
    if (message.k === 'o') {
      link.session = message.s;
      const pc = start(link);
      await pc.setRemoteDescription({ type: 'offer', sdp: message.d });
      link.described = true;
      await pc.setLocalDescription(await pc.createAnswer());
      post(link.slot, link, { k: 'a', d: pc.localDescription.sdp });
    } else if (message.s !== link.session || !link.pc) return;
    else if (message.k === 'a') {
      await link.pc.setRemoteDescription({ type: 'answer', sdp: message.d });
      link.described = true;
    } else if (message.k === 'i') {
      if (link.described) await link.pc.addIceCandidate(JSON.parse(message.d)).catch(() => {});
      else link.queue.push(message.d);
      return;
    }
    for (const c of link.queue.splice(0)) await link.pc.addIceCandidate(JSON.parse(c)).catch(() => {});
  }

  for (let from = 0; from < NET.maxPlayers; from++) {
    if (from === lobby.slot) continue;
    const inbox = ref(`${lobby.base}/signal/${lobby.slot}/${from}`);
    stops.push(db.onChildAdded(inbox, (snap) => {
      const raw = snap.val();
      db.remove(snap.ref).catch(() => {});
      const link = links.get(from);
      if (!link || typeof raw !== 'string') return;
      let message = null;
      try {
        message = JSON.parse(raw);
      } catch (error) {
        return;
      }
      link.chain = link.chain.then(() => handle(link, message)).catch(() => {});
    }));
  }

  return {
    links,
    setPlayers(players) {
      const present = new Map(players.filter((p) => !p.me).map((p) => [p.slot, p]));
      for (const [slot, link] of links) {
        const p = present.get(slot);
        if (p && p.pid === link.pid) continue;
        close(link);
        links.delete(slot);
        onLink(slot, 'gone');
      }
      for (const [slot, p] of present) {
        if (links.has(slot)) continue;
        const link = { slot, pid: p.pid, pc: null, channel: null, open: false, relay: false, relayStop: null, session: '', queue: [], described: false, since: performance.now(), retry: 0, chain: Promise.resolve() };
        links.set(slot, link);
        onLink(slot, 'joining');
        if (lobby.slot < slot) link.chain = link.chain.then(() => offer(link)).catch(() => {});
      }
    },
    send(buffer, dt) {
      const now = performance.now();
      let needRelay = false;
      for (const link of links.values()) {
        if (link.channel && link.channel.readyState === 'open') {
          if (!link.open) {
            link.open = true;
            link.relay = false;
            if (link.relayStop) link.relayStop();
            link.relayStop = null;
            onLink(link.slot, 'direct');
          }
          if (link.channel.bufferedAmount < 16384) link.channel.send(buffer);
          continue;
        }
        link.open = false;
        if (link.retry && now > link.retry && lobby.slot < link.slot) {
          link.retry = 0;
          link.chain = link.chain.then(() => offer(link)).catch(() => {});
        }
        if (now - link.since > NET.relayAfterMs) {
          needRelay = true;
          if (!link.relay) {
            link.relay = true;
            link.relayStop = db.onValue(ref(`${lobby.base}/relay/${link.slot}`), (snap) => {
              const value = snap.val();
              if (typeof value === 'string' && !link.open) onState(link.slot, fromBase64(value));
            });
            onLink(link.slot, 'relay');
          }
        }
      }
      relayTimer -= dt;
      if (needRelay && relayTimer <= 0) {
        relayTimer = 1 / NET.relayHz;
        const text = toBase64(buffer);
        if (text !== relayLast) db.set(ref(`${lobby.base}/relay/${lobby.slot}`), text).catch(() => {});
        relayLast = text;
      }
    },
    close() {
      for (const stop of stops) stop();
      for (const link of links.values()) close(link);
      links.clear();
    },
  };
}

// Costa del Gzowo film: stepped virtual clock, seeded randomness and worker bookkeeping, injected before the game loads.
(() => {
  if (window.__vt) return;
  const realRAF = window.requestAnimationFrame.bind(window);
  const realPerfNow = performance.now.bind(performance);
  const realDateNow = Date.now.bind(Date);
  let frozen = false;
  let vt = 0;
  let dateOff = 0;
  let id = 1;
  const queue = new Map();
  let seed = 1234567;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__vt = {
    freeze() {
      if (frozen) return;
      vt = realPerfNow();
      dateOff = realDateNow() - vt;
      frozen = true;
    },
    step(ms) {
      vt += ms;
      const cbs = [...queue.values()];
      queue.clear();
      for (const cb of cbs) cb(vt);
      return cbs.length;
    },
    reseed(s) {
      seed = s | 0;
    },
    get frozen() {
      return frozen;
    },
    pending: 0,
  };
  performance.now = () => (frozen ? vt : realPerfNow());
  Date.now = () => (frozen ? Math.round(vt + dateOff) : realDateNow());
  window.requestAnimationFrame = (cb) => {
    const my = id++;
    if (frozen) queue.set(my, cb);
    else realRAF((t) => (frozen ? queue.set(my, cb) : cb(t)));
    return my;
  };
  window.cancelAnimationFrame = (my) => queue.delete(my);
  const RealWorker = window.Worker;
  window.Worker = class extends RealWorker {
    constructor(...a) {
      super(...a);
      this.track = String(a[0]).startsWith('blob:');
      this.addEventListener('message', () => {
        if (this.track) window.__vt.pending = Math.max(0, window.__vt.pending - 1);
      });
    }
    postMessage(...a) {
      if (this.track) window.__vt.pending++;
      return super.postMessage(...a);
    }
  };
})();

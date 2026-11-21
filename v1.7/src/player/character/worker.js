// Costa del Gzowo: background worker that meshes the avatar sculpt off the main thread.
import { meshRegions, LAYERS } from './regions.js';

self.onmessage = (e) => {
  try {
    const out = meshRegions(e.data);
    const transfer = [];
    for (const k of LAYERS) for (const a of Object.values(out[k])) transfer.push(a.buffer);
    self.postMessage({ ok: true, out }, transfer);
  } catch (error) {
    self.postMessage({ ok: false, error: String(error && error.stack ? error.stack : error) });
  }
};

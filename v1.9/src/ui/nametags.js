// Costa del Gzowo: name tags floating over the other players, projected from the world onto the screen.
import * as THREE from 'three';

export function createNameTags() {
  const layer = document.createElement('div');
  layer.id = 'tags';
  document.body.appendChild(layer);
  const tags = new Map();
  const p = new THREE.Vector3();
  return {
    update(camera, remotes) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const [slot, el] of tags) {
        if (remotes.has(slot)) continue;
        el.remove();
        tags.delete(slot);
      }
      for (const remote of remotes.values()) {
        let el = tags.get(remote.slot);
        if (!el) {
          el = document.createElement('div');
          el.className = 'tag';
          layer.appendChild(el);
          tags.set(remote.slot, el);
        }
        if (el.textContent !== remote.profile.name) el.textContent = remote.profile.name;
        const distance = remote.tagOn ? camera.position.distanceTo(remote.tag) : Infinity;
        p.copy(remote.tag).project(camera);
        const visible = distance < 220 && p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
        el.style.opacity = visible ? String(Math.min(1, Math.max(0.35, 1.25 - distance / 160))) : '0';
        if (visible) el.style.transform = `translate(-50%, -100%) translate(${((p.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((0.5 - p.y * 0.5) * h).toFixed(1)}px)`;
      }
    },
    clear() {
      for (const el of tags.values()) el.remove();
      tags.clear();
    },
  };
}

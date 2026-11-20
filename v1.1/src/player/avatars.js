// Costa del Gzowo: avatar list and live switching between the built-in character and loaded skins that follow its joints.
import { createJurekSkin } from './jurek.js';

export const AVATARS = [
  { id: 'default', name: 'Dario', note: 'Fitted tee, denim shorts, white sneakers', figure: 'plain' },
  { id: 'jurek', name: 'Jurek', note: 'Hood up, sweatpants, green Crocs', figure: 'hood' },
];

const LOADERS = { jurek: createJurekSkin };

export function createAvatars(ctx, character) {
  const builtin = [];
  character.group.traverse((o) => {
    if (o.isMesh) builtin.push(o);
  });
  const skins = new Map();
  let active = null;
  let current = 'default';
  let request = 0;
  let last = { mode: 'foot', speed: 0, vy: 0, wade: 0 };
  const update = character.update;
  const snap = character.snap;
  character.update = (dt, state) => {
    update(dt, state);
    last = state;
    if (active) active.sync(dt, state);
  };
  character.snap = (state) => {
    snap(state);
    last = state;
    if (active) active.sync(0, state);
  };

  async function set(id) {
    if (!AVATARS.some((a) => a.id === id)) id = 'default';
    const mine = ++request;
    let skin = null;
    if (LOADERS[id]) {
      if (!skins.has(id)) skins.set(id, LOADERS[id](ctx, character));
      skin = await skins.get(id);
      if (mine !== request) return current;
    }
    for (const other of skins.values()) (await other).setVisible(false);
    if (mine !== request) return current;
    for (const mesh of builtin) mesh.visible = !skin;
    active = skin;
    current = id;
    if (skin) {
      skin.setVisible(true);
      skin.sync(0, last);
    }
    return current;
  }

  return {
    set,
    get current() {
      return current;
    },
    get active() {
      return active;
    },
  };
}

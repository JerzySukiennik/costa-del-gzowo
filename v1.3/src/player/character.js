// Costa del Gzowo: avatar registry and factory; every avatar returns the same rig contract (group, joints, update, snap, setScripted, reach).
import { createDefaultAvatar, prepareDefaultAvatar } from './character/avatar.js';

export const AVATARS = [{ id: 'default', name: 'Dario', note: 'Hand-sculpted procedural avatar: fitted tee, denim shorts, white sneakers.' }];

const FACTORIES = { default: createDefaultAvatar };

function requested(id) {
  return id || (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('avatar') : null) || 'default';
}

if (requested() === 'default') prepareDefaultAvatar();

export async function createCharacter(ctx, { id } = {}) {
  const factory = FACTORIES[requested(id)] || FACTORIES.default;
  return factory(ctx);
}

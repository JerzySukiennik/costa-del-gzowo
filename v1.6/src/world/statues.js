// Costa del Gzowo: the avatars standing on plinths by the car park; walk up to one and take its place.
import * as THREE from 'three';
import { hookMaterial } from '../render/shaderHooks.js';
import { heightAt } from './heightfield.js';
import { createCharacter } from '../player/character.js';
import { createAvatars, AVATARS } from '../player/avatars.js';

const PLINTH = 0.42;

export async function createStatues(ctx, spots) {
  const stone = hookMaterial(new THREE.MeshStandardMaterial({ color: 0x8d8778, roughness: 0.86, metalness: 0 }), { key: 'statue-plinth' });
  if (ctx.lighting && ctx.lighting.register) ctx.lighting.register(stone);
  const items = [];
  for (const spot of spots) {
    const info = AVATARS.find((a) => a.id === spot.id);
    if (!info) continue;
    const y = heightAt(spot.x, spot.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, PLINTH, 28), stone);
    base.position.set(spot.x, y + PLINTH / 2 - 0.03, spot.z);
    base.castShadow = true;
    base.receiveShadow = true;
    ctx.scene.add(base);
    ctx.physics.staticCylinder(spot.x, y - 0.2, y + PLINTH, spot.z, 0.55, 'concrete');
    const rig = await createCharacter(ctx, { id: 'default' });
    const skins = createAvatars(ctx, rig);
    if (spot.id !== 'default') await skins.set(spot.id);
    rig.group.position.set(spot.x, y + PLINTH - 0.03, spot.z);
    rig.group.rotation.set(0, spot.yaw, 0);
    ctx.scene.add(rig.group);
    rig.snap({ mode: 'foot', speed: 0, vy: 0, wade: 0 });
    items.push({ id: spot.id, name: info.name, rig, position: new THREE.Vector3(spot.x, y, spot.z), yaw: spot.yaw });
  }
  return {
    items,
    near(point, current) {
      for (const item of items) if (item.id !== current && Math.hypot(point.x - item.position.x, point.z - item.position.z) < 1.9 && Math.abs(point.y - item.position.y) < 2.5) return item;
      return null;
    },
    update(dt, camera) {
      for (const item of items) {
        if (camera.position.distanceToSquared(item.position) > 90 * 90) continue;
        item.rig.update(dt, { mode: 'foot', speed: 0, vy: 0, wade: 0, heading: item.yaw });
      }
    },
  };
}

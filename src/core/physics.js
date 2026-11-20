// Riverside: Rapier world wrapper with fixed stepping, surface tags and static collider helpers.
import RAPIER from 'rapier';

export const GROUPS = {
  WORLD: 0x0001,
  CAR: 0x0002,
  PLAYER: 0x0004,
  PROP: 0x0008,
  DEBRIS: 0x0010,
};

export const groups = (membership, filter) => ((membership & 0xffff) << 16) | (filter & 0xffff);

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const dt = 1 / 120;
  world.timestep = dt;
  const events = new RAPIER.EventQueue(true);
  const surfaces = new Map();
  const handlers = new Map();
  const worldGroups = groups(GROUPS.WORLD, 0xffff);

  function tag(collider, surface) {
    surfaces.set(collider.handle, surface);
    collider.setCollisionGroups(worldGroups);
    return collider;
  }

  return {
    RAPIER,
    world,
    events,
    dt,
    surfaces,
    surfaceOf(collider) {
      return collider ? surfaces.get(collider.handle) || 'terrain' : 'terrain';
    },
    staticBox(x0, x1, y0, y1, z0, z1, surface = 'concrete', friction = 0.9) {
      const desc = RAPIER.ColliderDesc.cuboid(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2)
        .setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        .setFriction(friction);
      return tag(world.createCollider(desc), surface);
    },
    staticCylinder(x, y0, y1, z, radius, surface = 'concrete') {
      const desc = RAPIER.ColliderDesc.cylinder((y1 - y0) / 2, radius).setTranslation(x, (y0 + y1) / 2, z).setFriction(0.8);
      return tag(world.createCollider(desc), surface);
    },
    staticTrimesh(vertices, indices, surface = 'asphalt', friction = 1) {
      const desc = RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(friction);
      return tag(world.createCollider(desc), surface);
    },
    tag,
    onContact(collider, fn) {
      handlers.set(collider.handle, fn);
    },
    offContact(collider) {
      handlers.delete(collider.handle);
    },
    step() {
      world.step(events);
      events.drainContactForceEvents((e) => {
        const a = e.collider1();
        const b = e.collider2();
        const fa = handlers.get(a);
        const fb = handlers.get(b);
        if (fa) fa(b, e);
        if (fb) fb(a, e);
      });
    },
  };
}

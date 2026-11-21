// Costa del Gzowo: another player's character in the world (avatar, walking, sitting in a shared vehicle), driven by interpolated network snapshots.
import * as THREE from 'three';
import { createCharacter } from '../player/character.js';
import { createAvatars } from '../player/avatars.js';
import { NET } from './firebaseConfig.js';
import { FLAG } from './protocol.js';

const TAG = { convertible: 1.75, roadster: 1.6, heli: 3.3 };
const lerp = (a, b, k) => a + (b - a) * k;

export function createTrack() {
  const snaps = [];
  let offset = null;
  let gap = 1000 / NET.sendHz;
  return {
    get latest() {
      return snaps.length ? snaps[snaps.length - 1] : null;
    },
    reset() {
      snaps.length = 0;
      offset = null;
    },
    push(s, now) {
      const last = snaps[snaps.length - 1];
      if (last && s.time - last.time <= 0 && Math.abs(s.time - last.time) < 60000) return;
      if (last) gap += (Math.min(1000, s.time - last.time) - gap) * 0.1;
      const o = now - s.time;
      offset = offset === null || o < offset || Math.abs(o - offset) > 5000 ? o : offset + 0.4;
      snaps.push(s);
      if (snaps.length > 40) snaps.shift();
    },
    sample(now) {
      if (!snaps.length || offset === null) return null;
      const t = now - offset - Math.min(480, Math.max(NET.delayMs, gap * 1.6 + 35));
      let i = snaps.length - 1;
      while (i > 0 && snaps[i - 1].time > t) i--;
      const b = snaps[i];
      const a = snaps[Math.max(0, i - 1)];
      const span = b.time - a.time;
      return { a, b, k: span > 0 ? Math.min(1, Math.max(0, (t - a.time) / span)) : 1, ahead: i === snaps.length - 1 ? Math.min(0.25, Math.max(0, (t - b.time) / 1000)) : 0 };
    },
  };
}

export function createRemote(ctx, scene, slot) {
  const track = createTrack();
  let character = null;
  let building = false;
  let gone = false;
  const self = {
    slot,
    pid: '',
    profile: { name: 'Player', avatar: 'default' },
    link: 'joining',
    now: null,
    tag: new THREE.Vector3(),
    tagOn: false,
    get character() {
      return character;
    },
    setProfile(p) {
      const avatar = self.profile.avatar;
      Object.assign(self.profile, p);
      if (character && avatar !== self.profile.avatar) character.avatars.set(self.profile.avatar).catch(() => {});
    },
    push(s, now) {
      track.push(s, now);
    },
    update(dt, now, fleet) {
      const s = track.sample(now);
      if (!s) return;
      const { a, b, k } = s;
      self.now = b;
      if (!character) {
        if (!building) build();
        self.tagOn = false;
        return;
      }
      const item = b.seat > 0 ? fleet[b.vehicle] : null;
      if (item) {
        const host = item.model;
        if (character.group.parent !== host.group) host.group.add(character.group);
        character.group.position.set(host.seat.x, host.seat.y, b.seat === 1 ? host.seat.z : -host.seat.z);
        character.group.rotation.set(0, Math.PI / 2, 0);
        character.group.visible = true;
        character.update(dt, { mode: 'sit', steer: b.seat === 1 ? b.steer : 0, throttle: b.seat === 1 ? b.throttle : 0 });
        host.group.getWorldPosition(self.tag);
        self.tag.y += (TAG[item.id] || TAG.convertible) + (b.seat === 2 ? 0.35 : 0);
        self.tagOn = true;
        return;
      }
      if (character.group.parent !== scene) scene.add(character.group);
      let dy = b.yaw - a.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const yaw = a.yaw + dy * k;
      character.group.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
      character.group.rotation.set(0, yaw, 0);
      character.group.visible = true;
      character.update(dt, { mode: b.flags & FLAG.SWIM ? 'swim' : b.flags & FLAG.GROUNDED ? 'foot' : 'air', speed: lerp(a.speed, b.speed, k), vy: b.vy, wade: b.wade, heading: yaw });
      self.tag.copy(character.group.position);
      self.tag.y += 2.02;
      self.tagOn = true;
    },
    dispose() {
      gone = true;
      if (character && character.group.parent) character.group.parent.remove(character.group);
      character = null;
    },
  };

  async function build() {
    building = true;
    try {
      const rig = await createCharacter(ctx, { id: 'default' });
      rig.avatars = createAvatars(ctx, rig);
      if (self.profile.avatar !== 'default') await rig.avatars.set(self.profile.avatar).catch(() => {});
      if (!gone) {
        rig.group.visible = false;
        scene.add(rig.group);
        rig.snap({ mode: 'foot', speed: 0, vy: 0, wade: 0 });
        character = rig;
      }
    } catch (error) {
      console.warn('Remote character unavailable.', error);
    }
    building = false;
  }

  return self;
}

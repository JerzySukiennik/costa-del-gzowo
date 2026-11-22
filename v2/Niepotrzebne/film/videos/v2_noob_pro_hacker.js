// Costa del Gzowo film: video 2 "Noob vs Pro vs Hacker: getting in the car" cut to Monkeys Spinning Monkeys.
(window.__filmVideos = window.__filmVideos || {}).v2 = {
  music: { file: 'monkeys_spinning_monkeys.wav', songAt: 0.835, videoAt: 0 },
  shots: (F) => {
    const PO = window.__filmPoses;
    const Bar = (m) => 1.66667 * m;
    const PX = -122, PZ = 13;
    const ground = (x = PX, z = PZ) => F.groundY(x, z);
    const parked = () => F.carPose(PX, ground(), PZ, Math.PI);
    const S = (name, a, b, o) => ({ name, dur: Bar(b) - Bar(a), pre: o.pre ?? 0.6, ...o });
    const reset = (beams = false) => {
      F.play.game.beams = beams;
      F.placeCar(parked());
      F.setJets(null);
    };
    const standAt = (x, z, yaw) => {
      F.foot(x, z, yaw);
      F.stopWalk();
    };
    const hackerFloss = (t) => PO.floss(t, 144);
    return [
      S('title', 0, 2, {
        setup(F) { reset(true); standAt(-131, 18, 0.4); },
        tick(F, t) { F.pose(PO.stand(), 10); },
        post(F, t) {
          const c = F.carLocal(0, 0.7, 0);
          F.camOrbit([c.x, c.y, c.z], 8.5, 1.6, 0.9 + 0.5 * (t / 3.33), 55, 0.3);
        },
        edit: {
          captions: [[0.0, 3.33, 'NOOB', 'label-noob', 470], [0.42, 3.33, 'vs', 'vs', 680], [0.83, 3.33, 'PRO', 'label-pro', 880], [1.25, 3.33, 'vs', 'vs', 1090], [1.67, 3.33, 'HACKER', 'label-hacker', 1300]],
          sfx: [[0.0, 'hitmarker', 0.7], [0.83, 'hitmarker', 0.7], [1.67, 'hitmarker', 0.7], [2.5, 'whoosh_fast', 0.6]],
          grade: [[0, 3.33, 'punch', 0.5]],
        },
      }),
      S('noob-label', 2, 3, {
        setup(F) { reset(); standAt(-112.5, 15.6, -Math.PI / 2 + 0.25); },
        tick(F, t) { F.pose(PO.shrug(), 14); },
        post(F, t) {
          const h = F.headWorld();
          F.look([h.x - 2.4, h.y - 0.4, h.z + 2.4], [h.x, h.y - 0.45, h.z], 48);
        },
        edit: { captions: [[0, 1.67, 'NOOB', 'label-noob', 420]], sfx: [[0, 'boing', 0.5]] },
      }),
      S('noob-walk', 3, 5, {
        setup(F) { reset(); standAt(-113, 15.7, -Math.PI / 2); },
        tick(F, t) { F.free(); F.walk(-Math.PI / 2); },
        post(F, t) {
          const h = F.hipsWorld();
          F.look([-124.5, ground() + 1.5, 23.5], [h.x, h.y + 0.1, h.z], 46);
        },
        edit: { captions: [[1.6, 3.33, 'the car is right there', 'meme-small', 1330]] },
      }),
      S('noob-facepalm', 5, 6, {
        setup(F) { reset(); standAt(-131.5, 15.7, 0.2); },
        tick(F, t) { F.pose(t < 0.35 ? PO.stand() : PO.facepalm(), 18); },
        post(F, t) {
          const h = F.headWorld();
          F.look([h.x + 0.5, h.y - 0.15, h.z + 1.7], [h.x, h.y - 0.25, h.z], 42);
        },
        edit: { sfx: [[0.4, 'bruh', 1.0]], zoom: [[0.35, 1.0, 0.5, 0.4], [0.45, 1.25, 0.5, 0.37]] },
      }),
      S('noob-flop', 6, 8, {
        setup(F) { reset(); F.ride({ pos: [1.35, 1.12, -1.15], up: [0, 0, 1], face: [0, -1, 0] }); },
        tick(F, t) {
          F.play.game.beams = Math.floor(t * 4) % 2 === 1;
          const p = PO.P({ leg_: -1.25, knee_: 0.35 + 0.25 * Math.sin(t * 9), legOut_: 0.2, armOut_: 1.25, arm_: -0.3, elbow_: 0.2, headYaw: 1.25, headPitch: -0.2, grip_: 0.1 });
          p.legL += 0.4 * Math.sin(t * 8);
          p.legR -= 0.4 * Math.sin(t * 8);
          F.pose(p, 30);
          if (t > 2.3) F.placeRider({ pos: [1.35, 1.12 - (t - 2.3) * 0.9, -1.15 - (t - 2.3) * 0.5], up: [0, -(t - 2.3) * 0.6, 1], face: [0, -1, 0] });
        },
        post(F, t) { F.camCar([4.2, 1.9, -3.1], [1.3, 0.8, -0.3], 46); },
        edit: { sfx: [[0.05, 'bonk', 0.9], [0.5, 'xp_error', 0.5], [1.75, 'xp_error', 0.5]], captions: [[0.3, 3.33, 'how do i\nget in???', 'meme', 1300]] },
      }),
      S('noob-oof', 8, 10, {
        setup(F) {
          reset();
          const x = PX + 1.2, z = PZ + 2.6;
          F.ride({ world: true, pos: [x, ground(x, z) + 0.08, z - 0.9], up: [0, 0, 1], face: [0, -1, 0] });
        },
        tick(F, t) { F.pose(PO.P({ armOut_: 1.3, arm_: 0.1, elbow_: 0.1, legOut_: 0.28, headYaw: 1.3, grip_: 0.1 }), 30); },
        post(F, t) {
          const x = PX + 1.2, z = PZ + 2.6;
          const a = 0.5 + 0.35 * (t / 3.33);
          F.look([x + Math.cos(a) * 0.4, ground(x, z) + 5.5 - 1.4 * F.ease.out(t / 3.33), z + Math.sin(a) * 0.4], [x, ground(x, z), z], 52, 0.3 * t);
        },
        edit: { sfx: [[0.0, 'oof', 1.0], [0.45, 'sad_violin', 0.75]], captions: [[0.1, 3.33, 'NOOB', 'label-noob', 420]], grade: [[0, 3.33, 'bw', 0.85]] },
      }),
      S('pro-label', 10, 11, {
        setup(F) {
          reset();
          const d = F.carLocal(F.play.entry.doorLocal.x, 0, F.play.entry.doorLocal.z);
          F.door = d;
          standAt(d.x + 5.5, d.z + 1.3, -Math.PI / 2);
        },
        tick(F, t) { F.pose(PO.P({ armL: 0.25, armR: 0.25, armOutL: 0.18, armOutR: 0.18, headPitch: -0.12, spinePitch: -0.06 }), 10); },
        post(F, t) { F.camChar([1.3, 0.45, 2.7 - 0.3 * t], [0, 1.15, 0], 54); },
        edit: { captions: [[0, 1.67, 'PRO', 'label-pro', 420]], sfx: [[0, 'ding', 0.6]], grade: [[0, 1.67, 'punch', 0.6]] },
      }),
      S('pro-walk', 11, 13, {
        speed: 0.5,
        setup(F) {
          reset();
          const d = F.carLocal(F.play.entry.doorLocal.x, 0, F.play.entry.doorLocal.z);
          F.door = d;
          standAt(d.x + 3.4, d.z + 1.3, -Math.PI / 2);
          F.walkCam = null;
        },
        tick(F, t) { F.free(); F.walk(-Math.PI / 2 - 0.03); },
        post(F, t) {
          const h = F.hipsWorld();
          F.look([h.x - 2.2, h.y - 0.55, h.z + 1.1], [h.x, h.y + 0.45, h.z], 58);
        },
        edit: { captions: [[0.3, 3.33, '*slow motion*', 'meme-small', 1330]] },
      }),
      S('pro-vault', 13, 14.5, {
        speed: 0.5,
        setup(F) {
          reset();
          F.play.seat();
          F.seatLocal = F.play.character.group.position.toArray();
          F.ride({ pos: F.seatLocal, up: [0, 1, 0], face: [1, 0, 0] });
        },
        tick(F, t) {
          const k = F.ease.inOut(F.clamp((t - 0.15) / 1.0, 0, 1));
          const s0 = F.seatLocal;
          const out = [s0[0] - 0.15, s0[1] - 0.45, -1.75];
          F.placeRider({ pos: [F.lerp(out[0], s0[0], k), F.lerp(out[1], s0[1], k) + 1.05 * Math.sin(Math.PI * k), F.lerp(out[2], s0[2], k)], up: [0, 1, 0], face: [1, 0, 0] });
          const tuck = Math.sin(Math.PI * k);
          F.pose(PO.P({ leg_: -0.2 - 1.3 * tuck - 1.2 * (k > 0.9 ? 1 : 0), knee_: 0.3 + 1.6 * tuck + 1.2 * (k > 0.9 ? 1 : 0), arm_: -0.4 - 1.0 * tuck, armOut_: 0.6, elbow_: 0.4, spinePitch: 0.2 * tuck, headPitch: -0.1 }), 20);
        },
        post(F, t) { F.camCar([0.6, 1.05, -5.2], [-0.1, 1.0, -0.6], 46); },
        edit: { sfx: [[0.7, 'whoosh_fast', 0.6]] },
      }),
      S('pro-seat', 14.5, 16, {
        setup(F) { reset(); F.dismount(); F.play.seat(); },
        post(F, t) { F.camCar([2.6 - 0.3 * t, 1.5, -2.0], [-0.2, 1.05, -0.35], 40); },
        edit: { sfx: [[0.45, 'ding', 0.5]], captions: [[0.45, 2.5, 'sir, this is\na roadster', 'meme-small', 1330]] },
      }),
      S('pro-drive', 16, 18, {
        pre: 0,
        tick(F, t) {
          const u = F.ease.in(F.clamp(t / 3.4, 0, 1)) * 0.75 + F.clamp(t / 3.4, 0, 1) * 0.25;
          const pose = F.flight([[PX, 0, PZ], [PX - 6, 0, PZ - 0.8], [PX - 20, 0, PZ - 5.5], [PX - 42, 0, PZ - 11]], u * 0.85, 0, 0);
          pose.p.y = ground(pose.p.x, pose.p.z);
          F.driveCar(pose);
        },
        post(F, t) {
          const c = F.carLocal(0, 0.7, 0);
          F.look([PX - 8, ground() + 0.8, PZ + 6.5], [c.x, c.y, c.z], 50);
        },
        edit: { sfx: [[0.2, 'wow', 1.0]], captions: [[0.1, 3.33, 'PRO', 'label-pro', 420]] },
      }),
      S('hacker-label', 18, 19, {
        setup(F) {
          F.play.game.beams = true;
          F.setJets(null);
          F.placeCar(F.carPose(PX, ground() + 40, PZ, Math.PI));
          standAt(PX - 1, PZ + 4.5, 0.25);
        },
        tick(F, t) { F.pose(t < 0.6 ? PO.stand() : PO.point(), 14); },
        post(F, t) {
          const h = F.headWorld();
          F.look([h.x + 0.9, h.y - 0.2, h.z + 2.3], [h.x, h.y - 0.2, h.z], 44);
        },
        edit: { grade: [[0, 1.67, 'matrix', 0.85]], glitch: [[0, 0.12, 1.0]], captions: [[0.05, 1.67, 'HACKER', 'label-hacker', 420], [0.6, 1.67, '> sudo summon car', 'terminal', 1330]], sfx: [[0.0, 'xp_startup', 0.55]] },
      }),
      S('hacker-summon', 19, 21, {
        setup(F) { F.play.game.beams = true; standAt(PX - 1, PZ + 4.5, 0.25 + Math.PI); },
        tick(F, t) {
          F.pose(PO.point(), 14);
          const k = F.ease.out(t / 3.0);
          F.setJets({ side: 1, front: k < 0.95 ? 0.6 : 0, rear: 0, deploy: 1, extend: 1 });
          F.driveCar(F.carPose(PX + 2, ground() + 1.3 + 30 * (1 - k), PZ - 2 + 3 * (1 - k), Math.PI + 1.6 * (1 - k), 0.0, 0.25 * (1 - k)));
        },
        post(F, t) {
          const h = F.hipsWorld();
          const c = F.carLocal(0, 0.6, 0);
          F.look([h.x - 1.2, h.y - 0.6, h.z + 3.2], [F.lerp(c.x, h.x, 0.25), F.lerp(c.y, h.y, 0.25) + 0.5, F.lerp(c.z, h.z, 0.25)], 62);
        },
        edit: { grade: [[0, 3.33, 'matrix', 0.35]], sfx: [[0.1, 'whoosh', 0.7]] },
      }),
      S('hacker-glitch', 21, 22, {
        setup(F) {
          F.play.game.beams = true;
          F.placeCar(F.carPose(PX + 2, ground() + 1.3, PZ - 2, Math.PI));
          F.setJets({ side: 1, rear: 0, deploy: 1, extend: 1 });
          F.ride({ pos: [1.15, 0.9, 0], up: [0, 1, 0], face: [1, 0, 0] });
        },
        tick(F, t) {
          F.driveCar(F.carPose(PX + 2, ground() + 1.3 + 0.05 * Math.sin(t * 6), PZ - 2, Math.PI));
          F.pose(hackerFloss(t), 40);
        },
        post(F, t) { F.camCar([5.2, 1.6, 1.8], [1.1, 1.7, 0], 50); },
        edit: { glitch: [[0, 0.25, 1.4], [0.83, 0.95, 0.8]], grade: [[0, 1.67, 'matrix', 0.3]], sfx: [[0.0, 'xp_error', 0.6]], captions: [[0.25, 1.67, '> teleport', 'terminal', 1330]] },
      }),
      S('hacker-roll', 22, 25, {
        setup(F) {
          F.play.game.beams = true;
          F.placeCar(F.carPose(6, 5, -150, -Math.PI / 2));
          F.ride({ pos: [1.15, 0.9, 0], up: [0, 1, 0], face: [1, 0, 0] });
        },
        tick(F, t) {
          const z = -150 + 14 * t + 2.2 * t * t;
          const roll = -F.TAU * 2 * F.ease.inOut(F.clamp((t - 0.4) / 4.2, 0, 1));
          F.setJets({ rear: 1, side: 0.8, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(6 + 2 * Math.sin(t * 0.8), 5 + 0.8 * Math.sin(t * 1.3), z, -Math.PI / 2, 0.02, roll));
          F.pose(hackerFloss(t), 40);
        },
        post(F, t) {
          const c = F.carLocal(0.5, 0.9, 0);
          F.look([c.x - 3.5, c.y + 2.0, c.z - 8.5], [c.x, c.y + 0.6, c.z], 52, -0.15 * Math.sin(t * 1.5));
        },
        edit: { captions: [[0.4, 5, 'spinning monkeys mode', 'meme-small', 1330]], sfx: [[0.4, 'whoosh', 0.6], [2.4, 'whoosh', 0.6]] },
      }),
      S('hacker-loop', 25, 27, {
        setup(F) {
          F.play.game.beams = true;
          F.ride({ pos: [1.15, 0.9, 0], up: [0, 1, 0], face: [1, 0, 0] });
          F.placeCar(F.carPose(12, 3, 18, -Math.PI / 2));
        },
        tick(F, t) {
          const ph = F.TAU * F.ease.inOut(F.clamp(t / 3.2, 0, 1));
          const R = 10;
          const z = 18 + 6 * t + Math.sin(ph) * R;
          const y = 3 + R - Math.cos(ph) * R;
          F.setJets({ rear: 1, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(12, y, z, -Math.PI / 2, ph, 0));
          F.pose(PO.tpose(), 40);
        },
        post(F, t) { F.look([1, 7, 38], [12, 11, 27], 70); },
        edit: { sfx: [[0.1, 'airhorn', 0.6]], captions: [[0.1, 3.33, 'HACKER', 'label-hacker', 420]] },
      }),
      S('hacker-dab', 27, 28, {
        setup(F) {
          F.play.game.beams = true;
          F.placeCar(F.carPose(12, 4, 40, -Math.PI / 2));
          F.setJets({ side: 1, rear: 0.2, deploy: 1, extend: 1 });
          F.ride({ pos: [1.15, 0.9, 0], up: [0, 1, 0], face: [1, 0, 0] });
        },
        tick(F, t) { F.driveCar(F.carPose(12, 4 + 0.05 * Math.sin(t * 5), 40 + 0.4 * t, -Math.PI / 2)); F.pose(PO.dab(), 30); },
        post(F, t) { F.camCar([5.0, 1.2, 1.2], [1.1, 1.6, 0], 48); },
        edit: { freeze: [[0.25, 1.5]], zoom: [[0.25, 1.0, 0.5, 0.45], [0.3, 1.2, 0.5, 0.42]], sfx: [[0.25, 'airhorn', 0.8], [0.25, 'hitmarker', 0.8], [0.35, 'hitmarker', 0.8], [0.45, 'hitmarker', 0.8]], captions: [[0.25, 1.67, 'GG EZ', 'meme-big', 1300]], grade: [[0.25, 1.67, 'punch', 1.0]], flash: [0.25] },
      }),
    ];
  },
};

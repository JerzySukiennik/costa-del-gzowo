// Costa del Gzowo film: video 4 "When the flying car has a subwoofer", a beat-cut dance on the Roadster to the seamless loop of Jurek's reel song.
(window.__filmVideos = window.__filmVideos || {}).v4 = {
  music: { file: 'song4_loop.wav', songAt: 0, videoAt: 0 },
  overlay: [[0.15, 5.2, 'when the flying car\nhas a subwoofer', 'meme', 330]],
  shots: (F) => {
    const PO = window.__filmPoses;
    const BEAT = 0.65125;
    const b = (n) => 0.012 + BEAT * n;
    const PX = -120, PZ = 14;
    const gy = (x = PX, z = PZ) => F.groundY(x, z);
    const parked = (lift = 0, pitch = 0, roll = 0) => F.carPose(PX, gy() + lift, PZ, Math.PI, pitch, roll);
    const kick = (T) => {
      const ph = (((T - b(0)) / BEAT) % 1 + 1) % 1;
      return Math.exp(-ph * 6);
    };
    const river = (T) => F.carPose(12 + 0.6 * Math.sin(T * 0.7), 3.4 + 0.12 * kick(T) + 0.1 * Math.sin(T * 1.9), -30 + 6 * T, -Math.PI / 2 + 0.1 * Math.sin(T * 0.5), -0.04 * kick(T), 0.04 * Math.sin(T * 1.3));
    const dance = (T) => {
      const bb = (T - b(0)) / BEAT;
      const ph = ((bb % 1) + 1) % 1;
      const down = Math.exp(-ph * 5);
      const side = Math.floor(bb) % 2 ? 1 : -1;
      const pump = { arm: -2.5 + 0.7 * down, armOut: 0.55, elbow: 0.35 + 0.9 * down, grip: 0.95, armTwist: 0.3 };
      const rest = { arm: -0.7, armOut: 0.35, elbow: 1.7, grip: 0.9, armTwist: 0.4 };
      const L = side > 0 ? pump : rest;
      const R = side > 0 ? rest : pump;
      return PO.P({
        hipsY: 0.9 - 0.09 * down, hipsRoll: 0.09 * side, hipsShift: 0.035 * side,
        spinePitch: 0.08 + 0.12 * down, spineRoll: -0.06 * side, headPitch: -0.05 + 0.28 * down, headYaw: 0.22 * side,
        leg_: -0.1 - 0.22 * down, knee_: 0.15 + 0.42 * down, foot_: -0.05 - 0.2 * down, legOut_: 0.12,
        armL: L.arm, armOutL: L.armOut, elbowL: L.elbow, gripL: L.grip, armTwistL: L.armTwist,
        armR: R.arm, armOutR: R.armOut, elbowR: R.elbow, gripR: R.grip, armTwistR: R.armTwist,
      });
    };
    const STAND = { pos: [1.2, 0.9, 0], up: [0, 1, 0], face: [1, 0, 0] };
    const LIE = { pos: [2.05, 0.6, 0], up: [-0.93, 0.36, 0], face: [0.36, 0.93, 0] };
    const HUE = [0, 115, 250, 300];
    const hue = (a, from = 0, to = 99) => [[from, to, BEAT, b(0) - a, HUE, 0.5]];
    const S = (name, a, z, o) => ({ name, dur: b(z) - b(a), pre: o.pre ?? 0.6, ...o, edit: o.edit || {} });
    const flying = (name, a, z, camera, edit = {}, extra = {}) => S(name, a, z, {
      flare: !!extra.flare,
      setup(F) { F.play.game.beams = true; F.placeCar(river(b(a) - b(8) - 0.6)); F.ride(STAND); },
      tick(F, t) {
        const T = b(a) - b(8) + t;
        F.setJets({ side: 0.85, rear: 0.15 + 0.85 * kick(b(a) + t), deploy: 1, extend: 1, flap: 1 });
        const pose = river(T);
        if (extra.roll) pose.q.multiply(new F.Q().setFromAxisAngle(new F.V3(1, 0, 0), extra.roll(t)));
        F.driveCar(pose);
        F.pose(dance(b(a) + t), 40);
      },
      post(F, t) { camera(F, t); },
      edit: { huebeat: hue(b(a)), ...edit },
    });
    return [
      S('walkup', 0, 4, {
        setup(F) { F.play.game.beams = false; F.placeCar(parked()); F.setJets(null); F.foot(PX - 8.6, PZ + 0.4, Math.PI / 2); },
        tick(F) { F.free(); F.walk(Math.PI / 2); },
        post(F, t) {
          const h = F.hipsWorld();
          F.look([h.x - 3.4, h.y + 0.75, h.z + 2.1], [PX - 2.4, gy() + 0.8, PZ - 0.2], 44);
        },
      }),
      S('press', 4, 6, {
        setup(F) { F.play.game.beams = false; F.placeCar(parked()); F.setJets(null); F.foot(PX - 3.5, PZ + 0.3, Math.PI / 2); },
        tick(F, t) { F.stopWalk(); F.pose(t < 0.25 ? PO.stand() : PO.point(), 16); },
        post(F, t) {
          const h = F.headWorld();
          F.look([h.x + 2.3 - 0.2 * t, h.y - 0.35, h.z + 0.9], [h.x, h.y - 0.25, h.z], 42);
        },
        edit: { sfx: [[0.25, 'hitmarker', 0.7]], captions: [[0.25, 1.3, '*turns on\nbass boost*', 'meme', 1320]] },
      }),
      S('thump', 6, 8, {
        setup(F) { F.play.game.beams = true; F.placeCar(parked()); F.foot(PX - 4.2, PZ + 1.6, Math.PI / 2 + 0.3); },
        tick(F, t) {
          const k = kick(b(6) + t);
          F.stopWalk();
          F.setJets({ side: k, rear: 0, deploy: 1, extend: 1 });
          F.driveCar(parked(0.45 * k, 0.04 * k, 0));
          F.pose(PO.shrug(), 20);
        },
        post(F, t) {
          F.look([PX - 9.5, gy() + 0.5, PZ + 6.5], [PX - 1.6, gy() + 1.0, PZ + 0.5], 46);
          F.shake(0.06 * kick(b(6) + t), t);
        },
        edit: { sfx: [[0, 'vine_boom', 0.75]], zoom: [[0, 1.12, 0.5, 0.55], [0.25, 1.0, 0.5, 0.5], [0.65, 1.12, 0.5, 0.55], [0.9, 1.0, 0.5, 0.5]] },
      }),
      S('rise', 8, 12, {
        setup(F) { F.play.game.beams = true; F.placeCar(parked()); F.ride(STAND); },
        tick(F, t) {
          const up = F.ease.inOut(t / 2.4);
          F.setJets({ side: 1, rear: 0.2 * kick(b(8) + t), deploy: 1, extend: 1, flap: 1 });
          F.driveCar(parked(7 * up + 0.15 * kick(b(8) + t), -0.04 * kick(b(8) + t), 0.03 * Math.sin(t * 1.7)));
          F.pose(dance(b(8) + t), 40);
        },
        post(F, t) {
          const c = F.carLocal(0, 1.4, 0);
          F.look([PX - 7, gy() + 0.35, PZ + 7], [c.x, c.y + 0.4, c.z], 54);
        },
        edit: { huebeat: hue(b(8)), flash: [0] },
      }),
      flying('orbit', 12, 16, (F, t) => { const c = F.carLocal(1.2, 1.6, 0); F.camOrbit([c.x, c.y, c.z], 3.8, 0.3, 2.2 + 1.6 * F.ease.inOut(t / 2.6), 56, 0.1); }),
      flying('crocs', 16, 18, (F, t) => F.camCar([2.25 + 0.1 * t, 1.05, 0.6], [1.2, 0.95, 0.0], 40)),
      flying('face', 18, 20, (F, t) => F.camCar([3.0 - 0.4 * t, 2.25, 0.35], [1.2, 2.2, 0], 34)),
      flying('topdown', 20, 24, (F, t) => { const c = F.carLocal(1.2, 1.0, 0); F.look([c.x + 0.01, c.y + 6.5 - 1.2 * t, c.z], [c.x, c.y, c.z], 55, 1.6 * t); }),
      flying('bridge', 24, 28, (F, t) => { const c = F.carLocal(1.2, 1.6, 0); F.look([27, 1.3, 26], [c.x, c.y, c.z], 50); }),
      flying('roll', 28, 32, (F, t) => { const c = F.carLocal(0, 1.0, 0); F.look([c.x - 7.5, c.y + 1.2, c.z - 7], [c.x, c.y + 0.4, c.z], 48); }, {
        sfx: [[b(30) - b(28), 'xp_error', 0.7]],
        captions: [[b(30) - b(28), 2.62, 'physics.exe has\nstopped working', 'meme', 1320]],
      }, { roll: (t) => -F.TAU * F.ease.inOut((t - (b(29) - b(28))) / (2 * BEAT)) }),
      flying('silhouette', 32, 36, (F, t) => { const c = F.carLocal(1.2, 1.5, 0); F.look([c.x - 3, c.y + 0.2, c.z - 15 + 0.8 * t], [c.x, c.y + 0.3, c.z], 44); }, {}, { flare: true }),
      S('drop', 36, 40, {
        setup(F) { F.play.game.beams = true; F.placeCar(river(b(36) - b(8))); F.ride(LIE); F.cam0 = null; },
        tick(F, t) {
          const T = b(36) - b(8);
          const p0 = river(T).p;
          const s = Math.max(0, t - 0.05);
          F.setJets({ rear: t > 0.05 ? 1 : 0.2, side: 0.7, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(p0.x, p0.y + 1.6 * s * s, p0.z + 6 * t + 7 * s * s, -Math.PI / 2, 0.12 * F.smooth(s / 0.8), 0));
          F.pose(PO.P({ arm_: -0.6 - 0.4 * Math.sin(t * 13), armOut_: 1.1 + 0.4 * Math.sin(t * 11), elbow_: 0.3, legOut_: 0.25 + 0.15 * Math.sin(t * 15), headPitch: 0.2, foot_: 0.6 }), 25);
        },
        post(F, t) {
          const p0 = river(b(36) - b(8)).p;
          if (!F.cam0) F.cam0 = [p0.x + 3.2, p0.y + 1.2, p0.z + 7.5];
          const c = F.carLocal(1.0, 0.9, 0);
          F.look(F.cam0, [c.x, c.y, c.z], 50 - 12 * F.smooth(t / 2.6));
          F.shake(0.1 * Math.exp(-t * 2), t);
        },
        edit: { flash: [0.02], sfx: [[0.02, 'airhorn', 0.75]], captions: [[0.05, 1.3, 'BASS DROP', 'meme-big', 1320]], zoom: [[0, 1.15, 0.5, 0.5], [0.35, 1.0, 0.5, 0.5]] },
      }),
      S('away', 40, 44, {
        setup(F) { F.play.game.beams = true; F.placeCar(F.flight([[12, 14, 105], [10, 22, 140], [0, 34, 175], [-20, 46, 205]], 0, 0.6)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 1, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.flight([[12, 14, 105], [10, 22, 140], [0, 34, 175], [-20, 46, 205]], F.clamp(t / 2.9, 0, 1) * 0.9, 0.6, 0.7));
          F.pose(PO.lieBack(t), 8);
        },
        post(F, t) { F.camCar([-6.0, 4.6, 1.0], [1.8, 0.7, 0], 50); },
        edit: { huebeat: hue(b(40)) },
      }),
      S('island', 44, 48, {
        setup(F) { F.play.game.beams = true; F.placeCar(F.carPose(-30, 60, 215, -Math.PI / 2 - 0.5)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 1, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(-30 - 9 * t, 60 + 2 * t, 215 + 16 * t, -Math.PI / 2 - 0.5, 0.05, 0.2));
          F.pose(PO.lieBack(t), 8);
        },
        post(F, t) {
          const k = F.ease.out(t / 2.6);
          F.look([F.lerp(-60, -120, k), F.lerp(260, 520, k), F.lerp(-220, -430, k)], [0, 0, 20], 52);
        },
        edit: { huebeat: hue(b(44)), captions: [[0.1, 2.62, 'the whole island\nhearing the bass:', 'meme', 360]] },
      }),
      S('end', 48, 48, {
        setup(F) { F.play.game.beams = true; F.placeCar(F.carPose(-70, 70, 280, -Math.PI / 2 - 0.5)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 1, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(-70 - 9 * t, 70, 280 + 16 * t, -Math.PI / 2 - 0.5, 0.05, 0.1));
          F.pose(PO.lieBack(t), 8);
        },
        post(F, t) { F.camCar([3.6, 2.3, 0.5], [1.5, 1.1, 0], 38); },
        dur: 3.7,
        pre: 1.2,
        edit: {
          freeze: [[0.05, 3.7]],
          grade: [[0.05, 3.7, 'bw', 0.9]],
          zoom: [[0.05, 1.0, 0.5, 0.45], [0.13, 1.25, 0.5, 0.42]],
          sfx: [[0.05, 'vine_boom', 1.0], [0.85, 'bruh', 1.0]],
          captions: [[0.05, 3.7, 'subwoofer: 1\nphysics: 0', 'meme', 1320]],
          musicEnd: 0.0,
        },
      }),
    ];
  },
};

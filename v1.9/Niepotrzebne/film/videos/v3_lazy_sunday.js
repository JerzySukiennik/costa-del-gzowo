// Costa del Gzowo film: video 3 "Lazy Sunday: nobody is driving" cut to If I Had a Chicken.
(window.__filmVideos = window.__filmVideos || {}).v3 = {
  music: { file: 'if_i_had_a_chicken.wav', songAt: 1.0, videoAt: 0 },
  shots: (F) => {
    const PO = window.__filmPoses;
    const Bar = (m) => 1.88976 * m;
    const beat = 0.47244;
    const S = (name, a, b, o) => ({ name, dur: Bar(b) - Bar(a), pre: o.pre ?? 0.6, ...o });
    const GX = -127, GZ = 27.5;
    const gy = () => F.groundY(GX, GZ);
    const starfish = (t = 0) => PO.P({ armOut_: 1.35, arm_: 0.15, elbow_: 0.2, legOut_: 0.3, grip_: 0.25, headPitch: 0.05, headYaw: 0.15 * Math.sin(t * 0.6), foot_: 0.5 });
    const lieGrass = () => F.ride({ world: true, pos: [GX + 0.85, gy() + 0.1, GZ], up: [-1, 0, 0], face: [0, 1, 0] });
    const carAway = () => F.carPose(-113.5, F.groundY(-113.5, 17), 17, Math.atan2(-(GZ - 17), GX - -113.5));
    const LIE = { pos: [2.05, 0.6, 0], up: [-0.93, 0.36, 0], face: [0.36, 0.93, 0] };
    const SIT = { pos: [0.95, 0.96, 0], up: [-0.1, 1, 0], face: [1, 0.1, 0] };
    const chill = (t) => {
      const p = PO.lieBack(t);
      const bob = Math.sin((t / beat) * Math.PI) * 0.12;
      p.legL = -0.05;
      p.legR = -0.22 + bob;
      p.kneeR = 0.15;
      p.legOutL = 0.02;
      p.legOutR = -0.12;
      return p;
    };
    const sitHood = (extra = {}) => PO.P({ hipsY: 0.1, spinePitch: 0.05, leg_: -1.45, knee_: 0.25, foot_: 0.25, legOut_: 0.08, arm_: 0.3, armOut_: 0.35, elbow_: 0.3, grip_: 0.3 }, extra);
    const river = (z0, v, y = 1.5) => (t) => F.carPose(3 + 0.6 * Math.sin(t * 0.4), y + 0.12 * Math.sin(t * 1.7), z0 + v * t, -Math.PI / 2 + 0.05 * Math.sin(t * 0.4), 0.02 * Math.sin(t * 1.1), 0.03 * Math.sin(t * 0.9));
    return [
      S('sunday', 0, 2, {
        setup(F) { F.play.game.beams = false; F.placeCar(carAway()); F.setJets(null); lieGrass(); },
        tick(F, t) { F.pose(starfish(t), 20); },
        post(F, t) { F.look([GX, gy() + 3.4 + 1.2 * F.ease.out(t / 3.8), GZ + 0.001], [GX, gy(), GZ], 55, 0.5 + 0.35 * t / 3.8); },
        edit: { captions: [[0.15, 3.78, 'me on a sunday:', 'meme', 360]] },
      }),
      S('far', 2, 4, {
        setup(F) { F.placeCar(carAway()); lieGrass(); },
        tick(F, t) { F.pose(starfish(t), 20); },
        post(F, t) {
          const c = F.carLocal(0, 0.7, 0);
          F.look([GX - 1.6, gy() + 0.45, GZ + 0.9], [c.x, c.y + 0.2, c.z], 40 - 6 * F.smooth(t / 3.78));
        },
        edit: { captions: [[0.3, 3.78, 'the car is SO far', 'meme', 360], [1.4, 3.78, '(15 meters)', 'meme-small', 520]], sfx: [[1.4, 'dundun', 0.55]] },
      }),
      S('come', 4, 6, {
        setup(F) { F.placeCar(carAway()); lieGrass(); },
        tick(F, t) {
          const p = starfish(t);
          if (t > 0.3 && t < 2.2) {
            p.armR = -1.4;
            p.armOutR = 0.5;
            p.elbowR = 0.3 + 0.6 * Math.max(0, Math.sin((t - 0.3) * 9));
            p.gripR = 0.6;
          }
          F.pose(p, 14);
          const k = F.ease.inOut((t - 0.6) / 2.8);
          const a = carAway();
          const tx = GX + 4.2, tz = GZ - 2.6;
          const x = F.lerp(a.p.x, tx, k), z = F.lerp(a.p.z, tz, k);
          F.driveCar(F.carPose(x, F.groundY(x, z), z, Math.atan2(-(GZ - 17), GX - -113.5)));
        },
        post(F, t) {
          F.look([GX - 2.4, gy() + 0.55, GZ + 1.1], [GX + 3.5, gy() + 0.7, GZ - 2.0], 52);
        },
        edit: { captions: [[0.4, 3.78, 'come here', 'meme', 360]], sfx: [[0.4, 'whoosh', 0.0]] },
      }),
      S('moments', 6, 7, {
        setup(F) { F.dismount(); },
        edit: { cards: [[0, 1.89]], sfx: [[0.05, 'few_moments', 1.0]] },
      }),
      S('float', 7, 9, {
        setup(F) { F.placeCar(river(-70, 2.2)(0)); F.setJets({ side: 0.8, rear: 0.1, deploy: 1, extend: 1 }); F.ride(LIE); },
        tick(F, t) { F.driveCar(river(-70, 2.2)(t)); F.pose(chill(t), 20); },
        post(F, t) {
          const c = F.carLocal(0.6, 0.6, 0);
          F.look([c.x + 6.5 - 1.0 * t / 3.78, 0.9, c.z + 3.2], [c.x, c.y + 0.4, c.z], 50);
        },
        edit: { captions: [[0.3, 3.78, 'living my\nbest life', 'meme', 1320]] },
      }),
      S('chill', 9, 11, {
        setup(F) { F.placeCar(river(-61.7, 2.2)(0)); F.setJets({ side: 0.8, rear: 0.1, deploy: 1, extend: 1 }); F.ride(LIE); },
        tick(F, t) { F.driveCar(river(-61.7, 2.2)(t)); F.pose(chill(t + 3.8), 20); },
        post(F, t) {
          const c = F.carLocal(1.2, 1.0, 0);
          F.camOrbit([c.x, c.y, c.z], 2.4, 3.2, 1.2 + 0.9 * (t / 3.78), 48);
        },
        edit: { captions: [[0.3, 3.78, '*vibing*', 'meme-small', 1360]] },
      }),
      S('whosdriving', 11, 13, {
        setup(F) { F.placeCar(river(-53.4, 2.2)(0)); F.setJets({ side: 0.8, rear: 0.1, deploy: 1, extend: 1 }); F.ride(LIE); },
        tick(F, t) { F.driveCar(river(-53.4, 2.2)(t)); F.pose(t < 1.2 ? chill(t + 7.6) : PO.mix(chill(t + 7.6), PO.P({ arm_: -2.7, armOut_: 0.9, elbow_: 2.3, headPitch: -0.1, headYaw: 0.6 }), F.smooth((t - 1.2) / 0.4)), 20); },
        post(F, t) {
          const k = F.ease.inOut(t / 1.2);
          F.camCar([F.lerp(1.0, 1.1, k), F.lerp(2.3, 1.8, k), F.lerp(0.9, -1.2, k)], [F.lerp(0.4, -0.5, k), F.lerp(1.4, 0.7, k), F.lerp(0, -0.4, k)], F.lerp(44, 52, k));
        },
        edit: { zoom: [[1.2, 1.0, 0.5, 0.5], [1.35, 1.3, 0.5, 0.55]], sfx: [[1.25, 'vine_boom', 0.8], [1.6, 'who_are_you', 1.0]], captions: [[1.25, 3.78, "wait...\nwho's driving??", 'meme', 1300]] },
      }),
      S('shrug', 13, 14, {
        setup(F) { F.placeCar(river(-45, 2.2)(0)); F.setJets({ side: 0.8, rear: 0.1, deploy: 1, extend: 1 }); F.ride(SIT); },
        tick(F, t) { F.driveCar(river(-45, 2.2)(t)); F.pose(sitHood({ shrug_: 0.08, armOut_: 0.55, arm_: -0.35, elbow_: 1.5, forearm_: -1.2, grip_: 0, spread_: 0.9, headRoll: 0.18 }), 16); },
        post(F, t) { F.camCar([3.7, 1.75, 0.5], [1.0, 1.55, 0], 44); },
        edit: { captions: [[0.2, 1.89, '*shrug*', 'meme', 1340]], sfx: [[0.2, 'nope', 0.0]] },
      }),
      S('boost', 14, 16, {
        setup(F) { F.placeCar(F.carPose(4, 2.2, -42, -Math.PI / 2)); F.ride(LIE); },
        tick(F, t) {
          const z = -42 + 6 * t + 5.5 * t * t;
          F.setJets({ rear: 1, side: 0.9, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(4 + 0.4 * Math.sin(t * 3), 2.2 + 0.6 * t + 0.15 * Math.sin(t * 9), z, -Math.PI / 2, 0.08, 0.06 * Math.sin(t * 7)));
          F.pose(PO.P({ arm_: -2.9, armOut_: 0.3 + 0.3 * Math.sin(t * 17), elbow_: 0.1, legOut_: 0.3 + 0.2 * Math.sin(t * 19), leg_: -0.1, knee_: 0.4 + 0.3 * Math.sin(t * 15), headPitch: 0.1, grip_: 0.9 }), 30);
        },
        post(F, t) {
          const c = F.carLocal(0.6, 1.0, 0);
          F.look([c.x - 2.2, c.y + 1.6, c.z - 7.5 + 1.5 * F.smooth(t / 1.5)], [c.x, c.y + 0.3, c.z], 54);
          F.shake(0.07, t, 1.4);
        },
        edit: { flash: [0.02], sfx: [[0.02, 'airhorn', 0.7]], captions: [[0.15, 3.78, 'AAAAAAAAA', 'meme-big', 1320]], zoom: [[0, 1.15, 0.5, 0.5], [0.35, 1.0, 0.5, 0.5]] },
      }),
      S('overbridge', 16, 18, {
        setup(F) { F.ride(LIE); F.placeCar(F.flight([[12, 4, -46], [12, 6, -22], [12, 15, -4], [12, 24, 20]], 0, 0.5)); },
        tick(F, t) {
          F.setJets({ rear: 1, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.flight([[12, 4, -46], [12, 6, -22], [12, 15, -4], [12, 24, 20]], F.clamp(t / 3.9, 0, 1), 0.5, 0.9));
          F.pose(PO.lieBack(t), 8);
        },
        post(F, t) {
          const c = F.carLocal(0, 0.8, 0);
          F.look([24, 15, 9], [c.x, c.y, c.z], 58);
        },
        edit: { sfx: [[1.9, 'whoosh', 0.8]] },
      }),
      S('peace', 18, 20, {
        setup(F) { F.placeCar(F.carPose(-2, 36, 70, -Math.PI / 2 + 0.4)); F.setJets({ side: 0.9, rear: 0.15, deploy: 1, extend: 1 }); F.ride({ pos: [0.95, 0.96, 0], up: [-0.05, 1, 0], face: [1, 0.05, 0] }); },
        tick(F, t) {
          F.driveCar(F.carPose(-2 + 0.5 * t, 36 + 0.3 * Math.sin(t * 1.3), 70 + 1.0 * t, -Math.PI / 2 + 0.4 + 0.05 * t, 0.02 * Math.sin(t), 0.03 * Math.sin(t * 0.8)));
          F.pose(PO.meditate(t), 12);
        },
        post(F, t) {
          const c = F.carLocal(1.0, 1.4, 0);
          F.camOrbit([c.x, c.y, c.z], 4.2, 0.6, 0.6 + 0.8 * F.ease.inOut(t / 3.78), 50);
        },
        edit: { captions: [[0.3, 3.78, 'inner peace', 'meme', 1340]], sfx: [[0.3, 'ding', 0.35]] },
      }),
      S('land', 20, 22, {
        setup(F) {
          F.ride({ pos: [0.95, 0.96, 0], up: [-0.05, 1, 0], face: [1, 0.05, 0] });
          F.placeCar(F.carPose(-118, F.groundY(-118, 15) + 12, 15, 0.4));
        },
        tick(F, t) {
          const g = F.groundY(-118, 15);
          const k = F.clamp(t / 2.6, 0, 1);
          const y = g + 12 * (1 - F.ease.out(k)) - (t > 2.6 ? 0.08 * Math.exp(-(t - 2.6) * 6) * Math.sin((t - 2.6) * 30) : 0);
          F.setJets({ side: t < 2.7 ? 1 : 0, front: 0, rear: 0, deploy: t < 3.0 ? 1 : 0, extend: 1 });
          F.driveCar(F.carPose(-118, y, 15, 0.4 - 0.4 * F.ease.out(k)));
          F.pose(PO.meditate(t), 12);
        },
        post(F, t) {
          F.look([-109, F.groundY(-118, 15) + 2.2, 22], [-118, F.groundY(-118, 15) + 1.6 + 6 * (1 - F.ease.out(F.clamp(t / 2.6, 0, 1))), 15], 50);
        },
        edit: { captions: [[2.7, 3.78, 'home in time\nfor lunch', 'meme', 1300]] },
      }),
      S('sunday2', 22, 24, {
        setup(F) { F.placeCar(carAway()); F.setJets(null); lieGrass(); },
        tick(F, t) { F.pose(starfish(t), 20); },
        post(F, t) { F.look([GX, gy() + 4.6 - 1.2 * F.ease.out(t / 3.8), GZ + 0.001], [GX, gy(), GZ], 55, 0.85 - 0.35 * t / 3.8); },
        edit: { captions: [[0.15, 3.78, 'productive day', 'meme', 360]] },
      }),
      S('end', 24, 24.8, {
        pre: 0,
        tick(F, t) { F.pose(starfish(t + 3.8), 20); },
        post(F, t) { F.look([GX, gy() + 3.4, GZ + 0.001], [GX, gy(), GZ], 55, 0.5); },
        edit: { freeze: [[0, 1.6]], grade: [[0, 1.6, 'bw', 0.7]], sfx: [[0.02, 'xp_shutdown', 0.8]], captions: [[0, 1.6, 'productive day', 'meme', 360]] },
      }),
    ];
  },
};

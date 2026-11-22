// Costa del Gzowo: the pedestrian cast for the bake (build, face, hair, outfit, carried things, colour sets and manner of each person).
const SKIN = { pale: 0xd6a586, light: 0xc79572, warm: 0xbd8d68, tan: 0xa87a5f, olive: 0x9a7150, brown: 0x7b5338, dark: 0x593a27, deep: 0x432a1c };
const HAIRC = { black: 0x0d0b09, espresso: 0x1d130c, brown: 0x38230f, chestnut: 0x4f2a14, auburn: 0x6a2f16, blonde: 0xa98549, sand: 0x8a6c3e, grey: 0x7d7b76, silver: 0xb4b1a8 };
const TEE = { sleeve: 'short', sleeveLen: -0.142, hem: 0.962, neckR: 0.074, neckY: 1.42, scoop: 0.12 };
const TANK = { sleeve: 'none', hem: 0.962, neckR: 0.088, neckY: 1.37, scoop: 0.45 };
const SHIRT = { sleeve: 'long', hem: 0.935, neckR: 0.077, neckY: 1.4, scoop: 0.3, ease: 0.003 };

export const CAST = [
  {
    id: 'marco', gender: 'm', height: 1.0, pace: 1.38,
    body: { upper: 'M' },
    head: { scale: 1.0, width: 1.0, jaw: 1.0, chin: 1.0, nose: 1.0, cheek: 0 },
    hair: 'short', top: { ...TEE }, bottom: { kind: 'shorts', len: -0.305 }, glasses: true,
    manner: { swing: 1.0, sway: 0.5, slouch: 0.0, chin: 0.03 },
    looks: [
      { skin: SKIN.tan, hair: HAIRC.espresso, top: 0xe9e4d6, top2: 0xe9e4d6, bottom: 0x4c627c, shoe: 0xe6e3dc, sole: 0xdcd8cf, iris: 0x4a321c, stubble: 0.55 },
      { skin: SKIN.olive, hair: HAIRC.black, top: 0x2f6f74, top2: 0x2f6f74, bottom: 0xb9a888, shoe: 0x23262b, sole: 0xd9d5cc, iris: 0x38260f, stubble: 0.35 },
      { skin: SKIN.light, hair: HAIRC.sand, top: 0xd8884a, top2: 0xd8884a, bottom: 0x2d3a4a, shoe: 0xdedbd2, sole: 0xdcd8cf, iris: 0x4c6a7a, stubble: 0.2 },
    ],
  },
  {
    id: 'sofia', gender: 'f', height: 0.93, pace: 1.3,
    body: { upper: 'F', chestW: 0.88, chestD: 0.9, waistW: 0.8, waistD: 0.84, hipW: 0.98, hipD: 0.96, bust: 0.9, pec: 0.5, delt: 0.85, arm: -0.004, leg: -0.003 },
    head: { scale: 0.955, width: 0.96, jaw: 0.9, chin: 0.96, nose: 0.88, cheek: 0.001 },
    hair: 'long', top: { sleeve: 'none', neckR: 0.086, neckY: 1.36, scoop: 0.5, ease: 0.002, skirt: { hem: 0.56, spread: 0.085, radius: 0.15 } }, bottom: null, bag: { kind: 'tote', side: 'L' },
    manner: { swing: 0.85, sway: 1.0, slouch: -0.02, chin: 0.05 },
    looks: [
      { skin: SKIN.light, hair: HAIRC.espresso, top: 0xe2735c, top2: 0xf2e6d2, bottom: 0xe2735c, shoe: 0xeee8dc, sole: 0xd8ccb4, accent: 0xd9c8a4, accent2: 0x8a5a34, iris: 0x4a321c, pattern: 2, lip: [0xa23a3a, 0.7] },
      { skin: SKIN.tan, hair: HAIRC.black, top: 0xf0ead9, top2: 0x7aa7b0, bottom: 0xf0ead9, shoe: 0xc98b5a, sole: 0xb89a74, accent: 0x7aa7b0, accent2: 0x4a3524, iris: 0x33200f, pattern: 0, lip: [0x9a4640, 0.5] },
      { skin: SKIN.pale, hair: HAIRC.auburn, top: 0x3f7f86, top2: 0xe9dcc0, bottom: 0x3f7f86, shoe: 0xe9e3d6, sole: 0xd8ccb4, accent: 0xe9dcc0, accent2: 0x6b4a2f, iris: 0x4f7359, pattern: 1, lip: [0xab4a4a, 0.6] },
    ],
  },
  {
    id: 'tyrell', gender: 'm', height: 1.05, pace: 1.5, jog: true,
    body: { upper: 'L', chestW: 1.08, chestD: 1.08, waistW: 0.98, pec: 1.25, delt: 1.2, arm: 0.005, leg: 0.004 },
    head: { scale: 1.02, width: 1.03, jaw: 1.06, chin: 1.0, nose: 1.12, cheek: 0.001 },
    hair: 'buzz', top: { ...TANK }, bottom: { kind: 'shorts', len: -0.255 },
    manner: { swing: 1.15, sway: 0.35, slouch: -0.03, chin: 0.06 },
    looks: [
      { skin: SKIN.dark, hair: HAIRC.black, top: 0xe8e4da, top2: 0xe8e4da, bottom: 0x1d2026, shoe: 0xd94f2e, sole: 0xe6e2d8, iris: 0x24160b, stubble: 0.3 },
      { skin: SKIN.deep, hair: HAIRC.black, top: 0x3a7ca5, top2: 0x3a7ca5, bottom: 0x2a2d33, shoe: 0xe9e6de, sole: 0xe6e2d8, iris: 0x1f130a, stubble: 0.15 },
      { skin: SKIN.brown, hair: HAIRC.black, top: 0x24272c, top2: 0x24272c, bottom: 0x8f2f2a, shoe: 0x202328, sole: 0xe6e2d8, iris: 0x2b1a0c, stubble: 0.4 },
    ],
  },
  {
    id: 'helen', gender: 'f', height: 0.9, pace: 1.12,
    body: { upper: 'F', chestW: 1.02, chestD: 1.1, waistW: 1.12, waistD: 1.2, hipW: 1.14, hipD: 1.15, glute: 1.1, bust: 1.05, pec: 0.5, belly: 0.25, arm: 0.004, leg: 0.005 },
    head: { scale: 0.975, width: 1.02, jaw: 1.04, chin: 0.97, nose: 0.95, cheek: 0.004 },
    hair: 'bob', top: { ...SHIRT, hem: 0.925, ease: 0.005, neckR: 0.08 }, bottom: { kind: 'trousers', ankle: 0.07 }, carry: { hand: 'L', what: 'handbag' },
    manner: { swing: 0.7, sway: 0.7, slouch: 0.05, chin: -0.02 },
    looks: [
      { skin: SKIN.pale, hair: HAIRC.silver, top: 0xdfe6e4, top2: 0x7f9fb0, bottom: 0x3d4654, shoe: 0x6b4a36, sole: 0x3a2a20, accent: 0x7a3f2c, accent2: 0xb89a5a, iris: 0x56707a, pattern: 1, lip: [0xa85a56, 0.5] },
      { skin: SKIN.light, hair: HAIRC.grey, top: 0xe6c9b0, top2: 0xe6c9b0, bottom: 0xcfc6b2, shoe: 0xd8d2c6, sole: 0xb8ae9c, accent: 0x2f5d62, accent2: 0xb89a5a, iris: 0x4a321c, pattern: 0, lip: [0x9c4f4c, 0.45] },
      { skin: SKIN.olive, hair: HAIRC.chestnut, top: 0x8fb39a, top2: 0xeae4d2, bottom: 0x2e3440, shoe: 0x30262a, sole: 0x1f1a1c, accent: 0xb5653c, accent2: 0xb89a5a, iris: 0x3b2712, pattern: 2, lip: [0x8f3d3d, 0.55] },
    ],
  },
  {
    id: 'diego', gender: 'm', height: 0.97, pace: 1.15,
    body: { upper: 'L', chestW: 1.1, chestD: 1.15, waistW: 1.22, waistD: 1.3, hipW: 1.1, hipD: 1.12, belly: 0.75, arm: 0.007, leg: 0.006 },
    head: { scale: 1.03, width: 1.06, jaw: 1.12, chin: 1.03, nose: 1.08, cheek: 0.006 },
    hair: null, beard: { thick: 0.011 }, top: { sleeve: 'short', sleeveLen: -0.165, hem: 0.905, neckR: 0.078, neckY: 1.385, scoop: 0.35, ease: 0.006, drape: 0.003 }, bottom: { kind: 'shorts', len: -0.37 }, carry: { hand: 'R', what: 'cup' },
    manner: { swing: 0.8, sway: 0.9, slouch: 0.03, chin: 0.0, wide: 0.02 },
    looks: [
      { skin: SKIN.olive, hair: HAIRC.espresso, top: 0x2f7f86, top2: 0xf0d9a8, bottom: 0xc7b592, shoe: 0x6f5238, sole: 0xd8ccb4, accent2: 0xf2efe8, iris: 0x3a2610, pattern: 2 },
      { skin: SKIN.tan, hair: HAIRC.grey, top: 0xd9603f, top2: 0xf3e3c0, bottom: 0x3b4a5c, shoe: 0xe4e0d6, sole: 0xd8ccb4, accent2: 0xf2efe8, iris: 0x46301a, pattern: 2 },
      { skin: SKIN.brown, hair: HAIRC.black, top: 0xece6d8, top2: 0x3d6f9a, bottom: 0x5a5f4a, shoe: 0x2a2c30, sole: 0xd8ccb4, accent2: 0xf2efe8, iris: 0x2b1a0c, pattern: 1 },
    ],
  },
  {
    id: 'mei', gender: 'f', height: 0.89, pace: 1.34,
    body: { upper: 'F', chestW: 0.86, chestD: 0.88, waistW: 0.78, waistD: 0.82, hipW: 0.93, hipD: 0.92, bust: 0.7, pec: 0.5, delt: 0.8, arm: -0.005, leg: -0.004 },
    head: { scale: 0.96, width: 0.99, jaw: 0.92, chin: 0.94, nose: 0.85, cheek: 0.002 },
    hair: 'ponytail', top: { ...TEE, sleeveLen: -0.1, hem: 0.985, neckR: 0.078 }, bottom: { kind: 'skirt', hem: 0.66, spread: 0.075, radius: 0.135 }, carry: { hand: 'R', what: 'phone' },
    manner: { swing: 0.9, sway: 0.85, slouch: 0.0, chin: 0.02 },
    looks: [
      { skin: SKIN.warm, hair: HAIRC.black, top: 0xf2ede2, top2: 0xf2ede2, bottom: 0x2c3340, shoe: 0xf0ece4, sole: 0xe0dccf, iris: 0x2e1c0e, lip: [0xa64a4a, 0.5] },
      { skin: SKIN.light, hair: HAIRC.espresso, top: 0xf0b8c0, top2: 0xf0b8c0, bottom: 0xe9e2d0, shoe: 0xe9e3d6, sole: 0xe0dccf, iris: 0x38230f, lip: [0xb2505a, 0.6] },
      { skin: SKIN.tan, hair: HAIRC.black, top: 0x1f2227, top2: 0x1f2227, bottom: 0xb04a3a, shoe: 0x1f2227, sole: 0xe0dccf, iris: 0x2b1a0c, lip: [0x8f3a3a, 0.6] },
    ],
  },
  {
    id: 'andre', gender: 'm', height: 1.08, pace: 1.42,
    body: { upper: 'M', chestW: 0.94, chestD: 0.92, waistW: 0.9, waistD: 0.9, hipW: 0.94, pec: 0.8, arm: -0.003, leg: -0.003 },
    head: { scale: 0.99, width: 0.97, jaw: 0.96, chin: 1.04, nose: 1.06, cheek: -0.001 },
    hair: 'afro', top: { ...SHIRT }, bottom: { kind: 'trousers', ankle: 0.06 }, bag: { kind: 'backpack' },
    manner: { swing: 1.05, sway: 0.45, slouch: 0.04, chin: -0.01 },
    looks: [
      { skin: SKIN.brown, hair: HAIRC.black, top: 0xd9e3ea, top2: 0x9db7c7, bottom: 0xb9a888, shoe: 0xe6e3dc, sole: 0xdcd8cf, accent: 0x9a3f2e, accent2: 0x2a2c30, iris: 0x2b1a0c, pattern: 1, stubble: 0.3 },
      { skin: SKIN.dark, hair: HAIRC.black, top: 0xe8c87a, top2: 0xe8c87a, bottom: 0x2a3140, shoe: 0x6a4630, sole: 0x3a2a20, accent: 0x33544a, accent2: 0x2a2c30, iris: 0x24160b, pattern: 0, stubble: 0.2 },
      { skin: SKIN.olive, hair: HAIRC.espresso, top: 0xeee9df, top2: 0xeee9df, bottom: 0x4f5f47, shoe: 0x25282d, sole: 0xdcd8cf, accent: 0x5a5f66, accent2: 0x2a2c30, iris: 0x3a2610, pattern: 0, stubble: 0.45 },
    ],
  },
  {
    id: 'olga', gender: 'f', height: 0.96, pace: 1.45, jog: true,
    body: { upper: 'F', chestW: 0.9, chestD: 0.92, waistW: 0.82, waistD: 0.86, hipW: 0.98, glute: 1.05, bust: 0.8, pec: 0.5 },
    head: { scale: 0.955, width: 0.97, jaw: 0.93, chin: 0.98, nose: 0.9, cheek: 0 },
    hair: 'bun', top: { ...TEE, sleeveLen: -0.085, hem: 1.0, neckR: 0.084, neckY: 1.385, scoop: 0.35 }, bottom: { kind: 'leggings' },
    manner: { swing: 1.05, sway: 0.75, slouch: -0.03, chin: 0.05 },
    looks: [
      { skin: SKIN.pale, hair: HAIRC.blonde, top: 0xf06a5a, top2: 0xf06a5a, bottom: 0x1f2329, shoe: 0xf0ede6, sole: 0xe6e2d8, iris: 0x4c6a7a, lip: [0xb05a58, 0.4] },
      { skin: SKIN.light, hair: HAIRC.sand, top: 0x8ed1c6, top2: 0x8ed1c6, bottom: 0x2b3550, shoe: 0xe85a8a, sole: 0xe6e2d8, iris: 0x56707a, lip: [0xa85250, 0.4] },
      { skin: SKIN.tan, hair: HAIRC.chestnut, top: 0xeeeae0, top2: 0xeeeae0, bottom: 0x5a2f48, shoe: 0x20242a, sole: 0xe6e2d8, iris: 0x3b2712, lip: [0x9a4444, 0.45] },
    ],
  },
  {
    id: 'frank', gender: 'm', height: 0.95, pace: 1.05,
    body: { upper: 'M', chestW: 0.98, chestD: 1.04, waistW: 1.1, waistD: 1.18, belly: 0.35, pec: 0.8, delt: 0.9, arm: -0.002 },
    head: { scale: 1.0, width: 1.0, jaw: 1.0, chin: 1.0, nose: 1.14, cheek: -0.002 },
    hair: 'receding', hat: 'sun', top: { ...TEE, sleeveLen: -0.15, hem: 0.95, neckR: 0.078, neckY: 1.4, scoop: 0.3, ease: 0.003 }, bottom: { kind: 'trousers', ankle: 0.068 },
    manner: { swing: 0.65, sway: 0.5, slouch: 0.08, chin: -0.03 },
    looks: [
      { skin: SKIN.light, hair: HAIRC.silver, top: 0x9fc2d8, top2: 0xeeeae0, bottom: 0xd2c8b0, shoe: 0x7a5a3e, sole: 0x3a2a20, accent: 0xd8c08a, accent2: 0x3a2a1c, iris: 0x5a7482, pattern: 1, stubble: 0.25 },
      { skin: SKIN.tan, hair: HAIRC.grey, top: 0xf0ead8, top2: 0xf0ead8, bottom: 0x4a5a6c, shoe: 0xdedad0, sole: 0xc8c2b4, accent: 0xcdb27c, accent2: 0x7a2f24, iris: 0x46301a, pattern: 0, stubble: 0.4 },
      { skin: SKIN.pale, hair: HAIRC.silver, top: 0xe59a6a, top2: 0xe59a6a, bottom: 0x5b5f52, shoe: 0x4a3626, sole: 0x2a1f18, accent: 0xe2d2a4, accent2: 0x2f4a5a, iris: 0x4f7359, pattern: 0, stubble: 0.15 },
    ],
  },
  {
    id: 'nia', gender: 'f', height: 0.94, pace: 1.3,
    body: { upper: 'F', chestW: 0.95, chestD: 0.98, waistW: 0.86, waistD: 0.9, hipW: 1.1, hipD: 1.1, glute: 1.15, bust: 1.1, pec: 0.5, leg: 0.004 },
    head: { scale: 0.97, width: 1.0, jaw: 0.97, chin: 0.97, nose: 1.02, cheek: 0.003 },
    hair: 'curls', top: { ...TEE, sleeveLen: -0.11, hem: 1.035, neckR: 0.084, neckY: 1.385, scoop: 0.35 }, bottom: { kind: 'shorts', len: -0.2 }, glasses: true,
    manner: { swing: 0.95, sway: 1.1, slouch: -0.02, chin: 0.05 },
    looks: [
      { skin: SKIN.dark, hair: HAIRC.black, top: 0xf2c94c, top2: 0xf2c94c, bottom: 0x6f8fb0, shoe: 0xf0ede6, sole: 0xe6e2d8, iris: 0x24160b, lip: [0x8a3438, 0.7] },
      { skin: SKIN.brown, hair: HAIRC.espresso, top: 0xeeeae0, top2: 0xeeeae0, bottom: 0x2a3140, shoe: 0xd9603f, sole: 0xe6e2d8, iris: 0x2b1a0c, lip: [0x9a3a44, 0.6] },
      { skin: SKIN.deep, hair: HAIRC.black, top: 0xe58a9c, top2: 0xe58a9c, bottom: 0xe6e0d0, shoe: 0xe9e6de, sole: 0xe6e2d8, iris: 0x1f130a, lip: [0x7f2f3a, 0.7] },
    ],
  },
  {
    id: 'kenji', gender: 'm', height: 0.98, pace: 1.36,
    body: { upper: 'M', chestW: 0.93, chestD: 0.92, waistW: 0.9, waistD: 0.9, hipW: 0.95, pec: 0.85, delt: 0.9, arm: -0.004, leg: -0.003 },
    head: { scale: 0.985, width: 0.99, jaw: 0.95, chin: 0.97, nose: 0.92, cheek: 0.001 },
    hair: 'buzz', hat: 'cap', top: { ...TEE, sleeveLen: -0.175, hem: 0.925, ease: 0.008, neckR: 0.076 }, bottom: { kind: 'shorts', len: -0.4 }, carry: { hand: 'R', what: 'phone' },
    manner: { swing: 0.9, sway: 0.4, slouch: 0.06, chin: -0.04 },
    looks: [
      { skin: SKIN.warm, hair: HAIRC.black, top: 0x24272c, top2: 0x24272c, bottom: 0x8a8f86, shoe: 0xeeeae2, sole: 0xe0dccf, accent: 0xb5382e, accent2: 0xb5382e, iris: 0x2e1c0e },
      { skin: SKIN.light, hair: HAIRC.brown, top: 0xeae6dc, top2: 0xeae6dc, bottom: 0x2b2f38, shoe: 0x2a2d33, sole: 0xe0dccf, accent: 0x2f5f8a, accent2: 0x2f5f8a, iris: 0x4a321c, stubble: 0.2 },
      { skin: SKIN.tan, hair: HAIRC.black, top: 0x7fae8a, top2: 0x7fae8a, bottom: 0xcbbf9f, shoe: 0xe6e3dc, sole: 0xe0dccf, accent: 0xe8e2d0, accent2: 0xe8e2d0, iris: 0x38260f, stubble: 0.1 },
    ],
  },
  {
    id: 'rosa', gender: 'f', height: 0.92, pace: 1.22,
    body: { upper: 'F', chestW: 0.92, chestD: 0.95, waistW: 0.86, waistD: 0.9, hipW: 1.03, hipD: 1.02, bust: 0.95, pec: 0.5 },
    head: { scale: 0.96, width: 0.98, jaw: 0.94, chin: 0.97, nose: 0.92, cheek: 0.002 },
    hair: 'wavy', top: { sleeve: 'short', sleeveLen: -0.07, neckR: 0.083, neckY: 1.38, scoop: 0.42, ease: 0.002, skirt: { hem: 0.34, spread: 0.1, radius: 0.172 } }, bottom: null,
    manner: { swing: 0.8, sway: 1.05, slouch: -0.01, chin: 0.03 },
    looks: [
      { skin: SKIN.tan, hair: HAIRC.auburn, top: 0xf0e8d8, top2: 0xd98a5a, bottom: 0xf0e8d8, shoe: 0xc9a074, sole: 0xa88a64, iris: 0x4f7359, pattern: 2, lip: [0xa23f3f, 0.65] },
      { skin: SKIN.olive, hair: HAIRC.espresso, top: 0x2f4f6a, top2: 0xe9dcc0, bottom: 0x2f4f6a, shoe: 0xe9e3d6, sole: 0xd8ccb4, iris: 0x3b2712, pattern: 2, lip: [0x963a3e, 0.6] },
      { skin: SKIN.light, hair: HAIRC.blonde, top: 0xe8b84a, top2: 0xe8b84a, bottom: 0xe8b84a, shoe: 0xeeeae2, sole: 0xd8ccb4, iris: 0x4c6a7a, pattern: 0, lip: [0xb0504e, 0.55] },
    ],
  },
];

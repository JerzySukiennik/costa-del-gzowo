// Costa del Gzowo: assembles the full avatar sculpt from bind-pose frames (skin parts, garments, trim fields, weight fields).
import { Frame, WORLD, union, tagAll, leaves } from './sdf.js';
import { weightField } from './mesher.js';
import { SIDES } from './anatomy.js';
import { sculptHead, sculptNeck } from './sculptHead.js';
import { sculptTorso, sculptArm, sculptHand, sculptLeg } from './sculptBody.js';
import { sculptShirt, shirtClip, sculptShorts, shortsClip, sculptShoe, shoeClip, sculptHair, hairClip } from './sculptWear.js';

export function createSculpt({ bind, index }) {
  const cache = {};
  const F = (name) => (cache[name] ||= Frame.fromMatrix(bind[name]));
  const W = WORLD;
  const H = F('head');
  const torso = sculptTorso(F, W);
  const neck = sculptNeck(H, W);
  const face = tagAll(sculptHead(H, W), { head: 1 });
  const arm = {};
  const hand = {};
  const leg = {};
  const shoe = {};
  const shoeG = {};
  for (const [t, s] of SIDES) {
    arm[t] = sculptArm(F, s);
    hand[t] = sculptHand(F, s);
    leg[t] = sculptLeg(F, s);
    shoe[t] = sculptShoe(F, s);
    shoeG[t] = shoeClip(F, s);
  }
  const skinLeaves = [...torso, ...neck, ...leaves(face)];
  for (const [t] of SIDES) skinLeaves.push(...arm[t], ...hand[t].palm, ...hand[t].fingers.flatMap((f) => leaves(f)), ...leg[t]);
  const shoeLeaves = SIDES.flatMap(([t]) => leaves(shoe[t]));
  return {
    F, W, H, torso, neck, face, arm, hand, leg, shoe, shoeG, index,
    skinWeights: weightField(skinLeaves, index),
    shoeWeights: weightField(shoeLeaves, index),
    shirt: () => sculptShirt(F, W),
    shirtG: shirtClip(F),
    shorts: () => sculptShorts(F, W),
    shortsG: shortsClip(F),
    hair: () => sculptHair(H, face),
    hairG: hairClip(),
    headSdf: () => union(0.02, face, union(0.018, ...neck), union(0.04, ...torso)),
  };
}

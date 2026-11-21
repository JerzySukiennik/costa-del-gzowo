// Costa del Gzowo: the look of the game as one set of numbers (colour grade, lens, film and camera feel), a dozen ready-made looks and the slider layout for the live editor.
export const ORIGINAL = {
  exposure: 0.56, contrast: 1.23, saturation: 1.3, vibrance: 0.3, temperature: 0, tint: 0, split: 1, olive: 0.3, matte: 0,
  shadowTint: [-0.02, 0.008, 0.036], highlightTint: [0.036, 0.014, -0.032],
  bloom: 0.065, glare: 0.08, halation: 0, streak: 0, vignette: 0.2, aberration: 0.0035, distortion: 0, sharpen: 0.55, flare: 1, dof: 0,
  grain: 0.018, grainSize: 1, letterbox: 0, scanlines: 0, flicker: 0, motionBlur: 1,
  fov: 55, speedFov: 1, shake: 1, roll: 0, distance: 1, handheld: 0,
};

const TEAL = [-0.045, 0.015, 0.05];
const ORANGE = [0.06, 0.02, -0.05];

export const LOOKS = [
  { id: 'costa', name: 'Costa', note: 'Richer golden hour, the new default', set: { contrast: 1.27, saturation: 1.34, vibrance: 0.4, split: 1.4, matte: 0.018, bloom: 0.075, glare: 0.11, halation: 0.28, vignette: 0.26, sharpen: 0.62, grain: 0.022, roll: 0.25, handheld: 0.12 } },
  { id: 'original', name: 'Original', note: 'The look up to v1.5', set: {} },
  { id: 'blockbuster', name: 'Blockbuster', note: 'Teal and orange, wide bars, long lens', set: { contrast: 1.36, saturation: 1.18, split: 1.8, shadowTint: TEAL, highlightTint: ORANGE, bloom: 0.09, streak: 0.7, vignette: 0.3, dof: 0.55, grain: 0.02, letterbox: 2.39, fov: 48, shake: 1.2, roll: 0.5 } },
  { id: 'vice', name: 'Vice', note: 'Pink and violet neon nights', set: { contrast: 1.3, saturation: 1.5, vibrance: 0.5, temperature: -0.1, tint: -0.3, split: 2.2, shadowTint: [-0.01, -0.02, 0.07], highlightTint: [0.07, -0.01, 0.03], bloom: 0.12, glare: 0.2, halation: 0.6, aberration: 0.009, vignette: 0.3, grain: 0.04, fov: 60 } },
  { id: 'kodak', name: 'Kodak 35', note: 'Soft film stock with halation and grain', set: { contrast: 1.12, saturation: 1.15, temperature: 0.25, split: 1.2, matte: 0.07, bloom: 0.09, halation: 0.8, sharpen: 0.3, vignette: 0.3, aberration: 0.005, dof: 0.3, grain: 0.06, grainSize: 1.6, flicker: 0.5, letterbox: 1.85, handheld: 0.3 } },
  { id: 'postcard', name: 'Postcard', note: 'Crisp, bright and very colourful', set: { exposure: 0.6, contrast: 1.3, saturation: 1.65, vibrance: 0.6, temperature: -0.05, split: 0.6, olive: 0.1, sharpen: 0.9, vignette: 0.1, aberration: 0, grain: 0 } },
  { id: 'sunset', name: 'Sunset', note: 'Deep orange and purple dusk', set: { contrast: 1.3, saturation: 1.4, temperature: 0.45, tint: -0.15, split: 2, shadowTint: [0.02, -0.02, 0.06], highlightTint: [0.08, 0.02, -0.05], bloom: 0.1, halation: 0.5, vignette: 0.4 } },
  { id: 'dream', name: 'Dream', note: 'Glowing, soft and pastel', set: { contrast: 1.05, saturation: 1.2, temperature: 0.15, matte: 0.08, bloom: 0.2, glare: 0.3, halation: 0.5, sharpen: 0.1, vignette: 0.15, aberration: 0.006, dof: 0.6 } },
  { id: 'noir', name: 'Noir', note: 'Black and white, hard contrast', set: { exposure: 0.52, contrast: 1.55, saturation: 0, vibrance: 0, split: 0, olive: 0, matte: 0.03, bloom: 0.08, vignette: 0.5, grain: 0.07, grainSize: 1.5, letterbox: 1.85 } },
  { id: 'documentary', name: 'Documentary', note: 'Neutral colours, handheld camera', set: { contrast: 1.15, saturation: 1.05, temperature: -0.08, split: 0.4, olive: 0.15, bloom: 0.04, glare: 0.03, vignette: 0.12, grain: 0.03, handheld: 0.7 } },
  { id: 'vhs', name: 'VHS 2003', note: 'Home video: scanlines, colour fringes, shaky hands', set: { contrast: 1.12, saturation: 1.05, temperature: 0.1, tint: 0.15, matte: 0.09, bloom: 0.1, sharpen: 0, aberration: 0.014, distortion: 0.06, grain: 0.07, grainSize: 2.2, scanlines: 0.8, flicker: 0.6, fov: 62, shake: 1.5, handheld: 0.9 } },
  { id: 'arcade', name: 'Arcade', note: 'Wide lens, big speed rush, lots of shake', set: { contrast: 1.3, saturation: 1.5, bloom: 0.09, aberration: 0.008, distortion: 0.08, motionBlur: 1.5, fov: 68, speedFov: 1.8, shake: 1.6, roll: 0.8, distance: 0.9 } },
];

export const GROUPS = [
  { name: 'Colour', items: [['exposure', 'Exposure', 0.3, 1, 0.01], ['contrast', 'Contrast', 0.9, 1.7, 0.01], ['saturation', 'Saturation', 0, 2, 0.01], ['vibrance', 'Vibrance', 0, 1, 0.01], ['temperature', 'Warmth', -1, 1, 0.01], ['tint', 'Green or magenta', -1, 1, 0.01], ['split', 'Shadow and highlight tint', 0, 3, 0.05], ['olive', 'Olive greens', 0, 0.6, 0.01], ['matte', 'Faded blacks', 0, 0.15, 0.002]] },
  { name: 'Lens', items: [['bloom', 'Bloom', 0, 0.25, 0.005], ['glare', 'Glare', 0, 0.4, 0.01], ['halation', 'Halation', 0, 1.2, 0.02], ['streak', 'Anamorphic streaks', 0, 1.5, 0.02], ['flare', 'Sun flare', 0, 2.5, 0.05], ['dof', 'Depth of field', 0, 1, 0.01], ['vignette', 'Vignette', 0, 0.8, 0.01], ['aberration', 'Colour fringes', 0, 0.03, 0.0005], ['distortion', 'Lens distortion', -0.2, 0.2, 0.005], ['sharpen', 'Sharpness', 0, 1.2, 0.01]] },
  { name: 'Film', items: [['grain', 'Grain', 0, 0.12, 0.002], ['grainSize', 'Grain size', 1, 3, 0.1], ['letterbox', 'Cinema bars', 0, 2.76, 0.01], ['scanlines', 'Scanlines', 0, 1, 0.02], ['flicker', 'Flicker', 0, 1, 0.02], ['motionBlur', 'Motion blur', 0, 2, 0.05]] },
  { name: 'Camera', items: [['fov', 'Field of view', 38, 80, 0.5], ['speedFov', 'Speed rush', 0, 2.5, 0.05], ['shake', 'Shake', 0, 2.5, 0.05], ['roll', 'Lean into corners', 0, 1.5, 0.05], ['distance', 'Camera distance', 0.6, 1.6, 0.01], ['handheld', 'Handheld sway', 0, 1.5, 0.02]] },
];

const KEY = 'costa-look';

export function createLook(onChange) {
  const values = {};
  let id = LOOKS[0].id;
  const fill = (preset) => {
    Object.assign(values, JSON.parse(JSON.stringify(ORIGINAL)), JSON.parse(JSON.stringify(preset.set)));
    id = preset.id;
  };
  fill(LOOKS[0]);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.values) {
      const preset = LOOKS.find((l) => l.id === saved.id);
      if (preset) fill(preset);
      for (const [k, v] of Object.entries(saved.values)) if (k in ORIGINAL && typeof v === typeof ORIGINAL[k]) values[k] = v;
      id = saved.id || 'custom';
    }
  } catch (error) {
    fill(LOOKS[0]);
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ id, values }));
    } catch (error) {
      return;
    }
  };
  const api = {
    values,
    get id() {
      return id;
    },
    set(key, value) {
      if (!(key in ORIGINAL)) return;
      values[key] = value;
      save();
      if (onChange) onChange(api);
    },
    apply(presetId) {
      const preset = LOOKS.find((l) => l.id === presetId);
      if (!preset) return;
      fill(preset);
      save();
      if (onChange) onChange(api);
    },
    preview(presetId) {
      const preset = LOOKS.find((l) => l.id === presetId);
      return preset ? { ...JSON.parse(JSON.stringify(ORIGINAL)), ...JSON.parse(JSON.stringify(preset.set)) } : null;
    },
    export() {
      return JSON.stringify({ id, values });
    },
  };
  return api;
}

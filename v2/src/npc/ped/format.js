// Costa del Gzowo: pedestrian asset format shared by the bake and the loader (palette slots, surface kinds, binary block order).
export const SLOT = { SKIN: 0, HAIR: 1, TOP: 2, BOTTOM: 3, SHOE: 4, ACCENT: 5, TOP2: 6, SOLE: 7, DARK: 8, EYE: 9, IRIS: 10, ACCENT2: 11 };
export const SLOT_COUNT = 12;
export const KIND = { PLAIN: 0, SKIN: 1, PATTERN: 2, HAIR: 3, GLOSS: 4 };
export const FACE_RANGE = 0.3;
export const BLOCKS = ['position', 'normal', 'skinIndex', 'skinWeight', 'mat', 'face', 'index', 'far'];

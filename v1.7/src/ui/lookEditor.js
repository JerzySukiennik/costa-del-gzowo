// Costa del Gzowo: live look editor (ready-made looks plus sliders for colour, lens, film and camera feel) shown over the running game.
import { LOOKS, GROUPS } from '../render/look.js';

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const kid of kids.flat()) if (kid) node.append(kid);
  return node;
}

const digits = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : step >= 0.001 ? 3 : 4);

export function createLookEditor(look, { onClose, onCompare }) {
  const rows = new Map();
  const chips = new Map();
  const note = el('div', { class: 'lk-note' });
  const refresh = () => {
    for (const [key, row] of rows) {
      row.input.value = String(look.values[key]);
      row.value.textContent = look.values[key].toFixed(row.digits);
    }
    for (const [id, chip] of chips) chip.classList.toggle('on', id === look.id);
    const preset = LOOKS.find((l) => l.id === look.id);
    note.textContent = preset ? preset.note : 'Your own mix';
  };
  const presetGrid = el('div', { class: 'lk-presets' }, LOOKS.map((preset) => {
    const chip = el('button', { type: 'button', class: 'lk-chip', text: preset.name });
    chip.addEventListener('click', () => {
      look.apply(preset.id);
      refresh();
    });
    chips.set(preset.id, chip);
    return chip;
  }));
  const groups = GROUPS.map((group) => el('section', { class: 'lk-group' }, el('h3', { text: group.name }), group.items.map(([key, label, min, max, step]) => {
    const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    const value = el('span', { class: 'lk-value' });
    const row = { input, value, digits: digits(step) };
    rows.set(key, row);
    input.addEventListener('input', () => {
      look.set(key, parseFloat(input.value));
      value.textContent = look.values[key].toFixed(row.digits);
      for (const chip of chips.values()) chip.classList.remove('on');
      note.textContent = 'Your own mix';
    });
    input.addEventListener('change', () => input.blur());
    return el('label', { class: 'lk-row' }, el('span', { class: 'lk-label', text: label }), value, input);
  })));
  const compare = el('button', { type: 'button', class: 'lk-button', text: 'Hold to compare' });
  const copy = el('button', { type: 'button', class: 'lk-button', text: 'Copy settings' });
  const done = el('button', { type: 'button', class: 'lk-button lk-main', text: 'Done' });
  const holdOn = () => onCompare(true);
  const holdOff = () => onCompare(false);
  compare.addEventListener('pointerdown', holdOn);
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) compare.addEventListener(type, holdOff);
  copy.addEventListener('click', () => {
    const text = look.export();
    const ok = () => {
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy settings'), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => window.prompt('Copy these settings', text));
    else window.prompt('Copy these settings', text);
  });
  done.addEventListener('click', () => onClose());
  const panel = el('aside', { id: 'look', 'aria-label': 'Look editor' },
    el('header', { class: 'lk-head' }, el('h2', { text: 'Look' }), el('span', { class: 'lk-hint', text: 'The game keeps running. O or a click on the game closes this.' })),
    presetGrid, note, groups,
    el('footer', { class: 'lk-foot' }, compare, copy, done));
  panel.hidden = true;
  panel.addEventListener('pointerup', () => {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  });
  for (const type of ['wheel', 'mousedown', 'click']) panel.addEventListener(type, (event) => event.stopPropagation());
  document.body.appendChild(panel);
  refresh();
  return {
    get open() {
      return !panel.hidden;
    },
    show(on) {
      panel.hidden = !on;
      if (on) refresh();
      else onCompare(false);
    },
  };
}

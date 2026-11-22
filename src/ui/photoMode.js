// Costa del Gzowo: photo mode (time stands still, a free camera, looks, lens and depth of field, and a still rendered at up to 4K and saved as a PNG).
import * as THREE from 'three';
import { LOOKS } from '../render/look.js';

const SIZES = [
  { id: 'screen', label: 'Screen' },
  { id: 'uhd', label: '4K', w: 3840, h: 2160 },
  { id: 'tall', label: '4K tall', w: 2160, h: 3840 },
  { id: 'square', label: 'Square', w: 2880, h: 2880 },
];

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

export function createPhotoMode(api) {
  const { camera, input, canvas } = api;
  const state = { fov: 50, tilt: 0, dof: 0, focus: 12, look: null, hide: false, detail: true, size: 'uhd' };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const chips = new Map();
  const sizeChips = new Map();
  const rows = new Map();
  let active = false;
  let busy = false;
  let yaw = 0;
  let pitch = 0;

  const status = el('div', { class: 'lk-note' });
  const frame = el('div', { id: 'photo-frame' });
  frame.hidden = true;

  const pushLook = () => {
    const base = state.look ? api.previewLook(state.look) : { ...api.baseLook() };
    api.applyLook({ ...base, dof: state.dof, motionBlur: 0, shake: 0, handheld: 0 });
    api.setFocus(state.focus);
  };

  const lookGrid = el('div', { class: 'lk-presets' }, [{ id: null, name: 'Mine' }, ...LOOKS].map((preset) => {
    const chip = el('button', { type: 'button', class: 'lk-chip', text: preset.name });
    chip.addEventListener('click', () => {
      state.look = preset.id;
      refresh();
      pushLook();
    });
    chips.set(preset.id, chip);
    return chip;
  }));

  function slider(key, label, min, max, step, digits, unit = '') {
    const input_ = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    const value = el('span', { class: 'lk-value' });
    rows.set(key, { input: input_, value, digits, unit });
    input_.addEventListener('input', () => {
      state[key] = parseFloat(input_.value);
      value.textContent = state[key].toFixed(digits) + unit;
      pushLook();
    });
    input_.addEventListener('change', () => input_.blur());
    return el('label', { class: 'lk-row' }, el('span', { class: 'lk-label', text: label }), value, input_);
  }

  function toggle(key, label, onChange) {
    const box = el('input', { type: 'checkbox' });
    box.addEventListener('change', () => {
      state[key] = box.checked;
      box.blur();
      if (onChange) onChange(box.checked);
    });
    rows.set(key, { box });
    return el('label', { class: 'pf-switch' }, box, el('span', {}, el('b', { text: label })));
  }

  const sizeRow = el('div', { class: 'ph-sizes' }, SIZES.map((size) => {
    const chip = el('button', { type: 'button', class: 'lk-chip', text: size.label });
    chip.addEventListener('click', () => {
      state.size = size.id;
      refresh();
      layout();
    });
    sizeChips.set(size.id, chip);
    return chip;
  }));
  const focusMe = el('button', { type: 'button', class: 'lk-button', text: 'Focus on me' });
  focusMe.addEventListener('click', () => {
    state.focus = Math.min(300, Math.max(1, camera.position.distanceTo(api.playerPosition())));
    refresh();
    pushLook();
  });
  const shoot = el('button', { type: 'button', class: 'lk-button lk-main', text: 'Take photo' });
  const leave = el('button', { type: 'button', class: 'lk-button', text: 'Leave' });

  const panel = el('aside', { id: 'photo', 'aria-label': 'Photo mode' },
    el('header', { class: 'lk-head' }, el('h2', { text: 'Photo mode' }),
      el('span', { class: 'lk-hint', text: 'Time stands still. Click the picture to fly: W A S D move, Q and E go down and up, Shift is fast, the wheel zooms. Enter takes the photo, P or Esc leaves.' })),
    el('section', { class: 'lk-group' }, el('h3', { text: 'Look' }), lookGrid),
    el('section', { class: 'lk-group' }, el('h3', { text: 'Lens' }),
      slider('fov', 'Field of view', 12, 100, 1, 0, '°'), slider('tilt', 'Tilt', -45, 45, 1, 0, '°'),
      slider('dof', 'Background blur', 0, 1, 0.01, 2), slider('focus', 'Focus distance', 1, 300, 0.5, 1, ' m'), focusMe),
    el('section', { class: 'lk-group' }, el('h3', { text: 'Photo' }), sizeRow,
      toggle('hide', 'Hide my character', (on) => api.setPlayerVisible(!on)), toggle('detail', 'Best detail for the photo (slower)'), status),
    el('footer', { class: 'lk-foot' }, leave, shoot));
  panel.hidden = true;
  panel.addEventListener('pointerup', () => {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  });
  for (const type of ['wheel', 'mousedown', 'click']) panel.addEventListener(type, (event) => event.stopPropagation());
  document.body.append(frame, panel);

  function refresh() {
    for (const [id, chip] of chips) chip.classList.toggle('on', id === state.look);
    for (const [id, chip] of sizeChips) chip.classList.toggle('on', id === state.size);
    for (const [key, row] of rows) {
      if (row.box) row.box.checked = state[key];
      else {
        row.input.value = String(state[key]);
        row.value.textContent = state[key].toFixed(row.digits) + row.unit;
      }
    }
  }

  function target() {
    const size = SIZES.find((s) => s.id === state.size);
    return size && size.w ? size : null;
  }

  function layout() {
    const size = target();
    frame.hidden = !active || !size;
    if (!size) return { fov: state.fov };
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = size.w / size.h;
    const fw = Math.min(w, h * aspect);
    const fh = fw / aspect;
    frame.style.width = `${fw}px`;
    frame.style.height = `${fh}px`;
    frame.style.left = `${(w - fw) / 2}px`;
    frame.style.top = `${(h - fh) / 2}px`;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(state.fov) / 2) * (fh / h)));
    return { fov, width: size.w, height: size.h };
  }

  async function take() {
    if (!active || busy) return;
    busy = true;
    shoot.disabled = true;
    const plan = layout();
    status.textContent = plan.width ? `Rendering ${plan.width} x ${plan.height}...` : 'Rendering...';
    frame.hidden = true;
    try {
      const blob = await api.capture({ width: plan.width, height: plan.height, fov: plan.fov, detail: state.detail, onProgress: (k) => (status.textContent = `Rendering, ${Math.round(k * 100)}%`) });
      if (!blob) throw new Error('empty picture');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      const link = el('a', { href: URL.createObjectURL(blob), download: `costa-del-gzowo-${stamp}.png` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 20000);
      status.textContent = 'Saved to your downloads.';
    } catch (error) {
      status.textContent = 'This size did not fit in the graphics memory. Try Screen.';
    }
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
    busy = false;
    shoot.disabled = false;
    layout();
  }
  shoot.addEventListener('click', take);
  leave.addEventListener('click', () => api.exit());
  window.addEventListener('resize', () => {
    if (active) layout();
  });

  return {
    take,
    state,
    get active() {
      return active;
    },
    get busy() {
      return busy;
    },
    enter() {
      active = true;
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
      yaw = euler.y;
      pitch = euler.x;
      state.fov = Math.round(camera.fov);
      state.tilt = 0;
      state.look = null;
      state.focus = Math.min(300, Math.max(1, camera.position.distanceTo(api.playerPosition())));
      state.hide = false;
      status.textContent = '';
      panel.hidden = false;
      refresh();
      pushLook();
      layout();
    },
    exit() {
      active = false;
      panel.hidden = true;
      frame.hidden = true;
      api.setPlayerVisible(true);
    },
    update(dt) {
      if (busy) {
        input.endFrame();
        return;
      }
      const speed = (input.key('ShiftLeft', 'ShiftRight') ? 26 : 6) * dt;
      yaw -= input.mouse.dx * 0.0022;
      pitch = Math.min(1.5, Math.max(-1.5, pitch - input.mouse.dy * 0.0022));
      if (input.mouse.wheel) {
        state.fov = Math.min(100, Math.max(12, state.fov + input.mouse.wheel * 2));
        refresh();
        layout();
      }
      euler.set(pitch, yaw, THREE.MathUtils.degToRad(state.tilt));
      camera.quaternion.setFromEuler(euler);
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(forward, input.axis(['KeyS'], ['KeyW']) * speed);
      camera.position.addScaledVector(right, input.axis(['KeyA'], ['KeyD']) * speed);
      camera.position.y += input.axis(['KeyQ'], ['KeyE']) * speed;
      const floor = api.heightAt(camera.position.x, camera.position.z) + 0.25;
      if (camera.position.y < floor && floor > 0.25) camera.position.y = floor;
      if (camera.fov !== state.fov) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
      }
      input.endFrame();
    },
  };
}

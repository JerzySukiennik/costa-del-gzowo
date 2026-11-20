// Riverside: keyboard and pointer-lock mouse input with edge detection.
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { dx: 0, dy: 0, locked: false, wheel: 0 };
  const blocked = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  window.addEventListener('keydown', (e) => {
    if (blocked.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
  canvas.addEventListener('click', () => {
    if (mouse.locked || !canvas.requestPointerLock) return;
    const result = canvas.requestPointerLock();
    if (result && result.catch) result.catch(() => {});
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!mouse.locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });
  canvas.addEventListener('wheel', (e) => {
    mouse.wheel += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });
  const key = (...codes) => codes.some((c) => down.has(c));
  return {
    mouse,
    down,
    key,
    hit(...codes) {
      return codes.some((c) => pressed.has(c));
    },
    axis(neg, pos) {
      return (key(...pos) ? 1 : 0) - (key(...neg) ? 1 : 0);
    },
    endFrame() {
      pressed.clear();
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.wheel = 0;
    },
    press(code) {
      pressed.add(code);
    },
    hold(code, on) {
      if (on) down.add(code);
      else down.delete(code);
    },
  };
}

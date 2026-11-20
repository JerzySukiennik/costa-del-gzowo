// Riverside: minimal HUD (speed cluster, context prompt, damage note, place title).
export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const prompt = el('prompt');
  const cluster = el('cluster');
  const speed = el('speed-value');
  const gear = el('gear');
  const rpm = el('rpm-bar');
  const note = el('damage-note');
  const place = el('place');
  let lastPrompt = '';
  let lastSpeed = -1;
  return {
    show() {
      hud.hidden = false;
      place.classList.add('on');
      setTimeout(() => place.classList.remove('on'), 6000);
    },
    prompt(key, text) {
      const html = text ? `<b>${key}</b>${text}` : '';
      if (html === lastPrompt) return;
      lastPrompt = html;
      if (text) prompt.innerHTML = html;
      prompt.classList.toggle('on', !!text);
    },
    drive(on, state) {
      cluster.classList.toggle('on', on);
      if (!on) return;
      const kmh = Math.round(Math.abs(state.speed) * 3.6);
      if (kmh !== lastSpeed) {
        speed.textContent = kmh;
        lastSpeed = kmh;
      }
      gear.textContent = state.stalled ? 'STALLED' : state.reverse ? 'R' : 'D' + state.gear;
      rpm.style.width = `${Math.min(100, (state.rpm / 7200) * 100)}%`;
    },
    note(text) {
      if (note.textContent !== text) note.textContent = text;
    },
  };
}

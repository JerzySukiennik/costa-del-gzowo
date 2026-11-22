// Costa del Gzowo: local testing panel for quality and speed (quality buttons that switch live, speed-up switches, a frame readout and a built-in benchmark that times every quality with the speed-ups off and on).
import { QUALITY, QUALITY_ORDER, SPEEDUPS } from '../render/quality.js';
import { VIEWS } from '../dev/benchViews.js';

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

const million = (n) => `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)} M`;

export function createPerfPanel(api, { onClose }) {
  const chips = new Map();
  const boxes = new Map();
  const note = el('div', { class: 'lk-note' });
  const readout = el('dl', { class: 'pf-stats' });
  const results = el('div', { class: 'pf-results' });
  let timer = 0;
  let running = false;
  let last = null;

  const refresh = () => {
    const quality = api.quality();
    for (const [id, chip] of chips) chip.classList.toggle('on', id === quality);
    for (const [id, box] of boxes) box.checked = api.perf[id];
    note.textContent = QUALITY[quality].note;
  };
  const stat = (label, value) => [el('dt', { text: label }), el('dd', { text: value })];
  const tick = () => {
    const s = api.stats();
    readout.replaceChildren(...[
      stat('Frames per second', `${s.fps} (${s.ms.toFixed(1)} ms)`),
      stat('Rendered at', `${s.width} x ${s.height}`),
      stat('Triangles per frame', million(s.triangles)),
      stat('Draw calls', String(s.calls)),
      stat('Grass tiles drawn', `${s.grassShown} of ${s.grassTiles}`),
      stat('Trees as full models', `${s.treeMeshes} + ${s.forest} at the edge`),
      stat('Water reflection', s.reflection ? 'drawn' : 'skipped, no water in view'),
      stat('Shapes with a lighter version', String(s.lodReady)),
      stat('Models out of view', `${s.modelsHidden} of ${s.models} skipped`),
    ].flat());
  };

  const qualityRow = el('div', { class: 'pf-quality' }, QUALITY_ORDER.map((id, i) => {
    const chip = el('button', { type: 'button', class: 'lk-chip', title: `Key ${i + 1}` }, el('span', { text: QUALITY[id].label }), el('small', { text: String(i + 1) }));
    chip.addEventListener('click', () => {
      api.setQuality(id);
      refresh();
    });
    chips.set(id, chip);
    return chip;
  }));
  const switches = SPEEDUPS.map((s) => {
    const box = el('input', { type: 'checkbox' });
    box.addEventListener('change', () => {
      api.perf[s.id] = box.checked;
      box.blur();
    });
    boxes.set(s.id, box);
    return el('label', { class: 'pf-switch' }, box, el('span', {}, el('b', { text: s.label }), el('i', { text: s.note })));
  });
  const compare = el('button', { type: 'button', class: 'lk-button', text: 'Hold: speed-ups off' });
  const bench = el('button', { type: 'button', class: 'lk-button', text: 'Benchmark all' });
  const quick = el('button', { type: 'button', class: 'lk-button', text: 'Benchmark this quality' });
  const copy = el('button', { type: 'button', class: 'lk-button', text: 'Copy results' });
  const done = el('button', { type: 'button', class: 'lk-button lk-main', text: 'Done' });

  let held = null;
  const holdOn = () => {
    if (held || running) return;
    held = { ...api.perf };
    for (const key of Object.keys(api.perf)) api.perf[key] = false;
  };
  const holdOff = () => {
    if (!held) return;
    Object.assign(api.perf, held);
    held = null;
  };
  compare.addEventListener('pointerdown', holdOn);
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) compare.addEventListener(type, holdOff);

  function table(report) {
    const head = el('tr', {}, ['Quality', 'Before', 'After', 'Gain'].map((t) => el('th', { text: t })));
    const rows = report.rows.map((r) => el('tr', {},
      el('td', { text: QUALITY[r.quality].label }),
      el('td', { text: `${r.before.toFixed(1)} fps` }),
      el('td', { text: `${r.after.toFixed(1)} fps` }),
      el('td', { class: 'pf-gain', text: `${r.gain >= 0 ? '+' : ''}${r.gain.toFixed(0)}%` })));
    const detail = report.rows.map((r) => el('details', {}, el('summary', { text: `${QUALITY[r.quality].label} by view, ${r.size}` }),
      el('table', {}, r.views.map((v) => el('tr', {}, el('td', { text: v.label }), el('td', { text: `${(1000 / v.off).toFixed(1)}` }), el('td', { text: `${(1000 / v.on).toFixed(1)}` }), el('td', { class: 'pf-gain', text: `${v.off >= v.on ? '+' : ''}${((v.off / v.on - 1) * 100).toFixed(0)}%` }))))));
    results.replaceChildren(el('table', { class: 'pf-table' }, head, rows), ...detail);
  }

  function text(report) {
    const lines = [`Costa del Gzowo benchmark, ${report.gpu}`, 'quality | size | before fps | after fps | gain'];
    for (const r of report.rows) {
      lines.push(`${r.quality} | ${r.size} | ${r.before.toFixed(1)} | ${r.after.toFixed(1)} | ${r.gain.toFixed(0)}%`);
      for (const v of r.views) lines.push(`  ${v.label}: ${(1000 / v.off).toFixed(1)} -> ${(1000 / v.on).toFixed(1)} fps (${v.off.toFixed(1)} -> ${v.on.toFixed(1)} ms)`);
    }
    return lines.join('\n');
  }

  async function run(levels) {
    if (running) return;
    running = true;
    holdOff();
    const kept = { quality: api.quality(), perf: { ...api.perf } };
    const report = { gpu: api.bench.gpu(), rows: [] };
    const total = levels.length * Object.keys(VIEWS).length * 4;
    let step = 0;
    api.bench.begin();
    try {
      for (const quality of levels) {
        api.setQuality(quality);
        await api.bench.settle(24);
        const row = { quality, size: api.bench.size(), views: [] };
        for (const view of Object.values(VIEWS)) {
          const entry = { label: view.label, off: 0, on: 0 };
          await api.bench.view(view);
          for (const mode of ['off', 'on', 'on', 'off']) {
            for (const key of Object.keys(api.perf)) api.perf[key] = mode === 'on';
            results.textContent = `Measuring ${QUALITY[quality].label}, ${view.label} (${++step} of ${total})`;
            entry[mode] += (await api.bench.measure(16, 10)) / 2;
          }
          row.views.push(entry);
        }
        const mean = (key) => row.views.reduce((a, v) => a + v[key], 0) / row.views.length;
        row.before = 1000 / mean('off');
        row.after = 1000 / mean('on');
        row.gain = (row.after / row.before - 1) * 100;
        report.rows.push(row);
      }
    } finally {
      api.bench.end();
      Object.assign(api.perf, kept.perf);
      api.setQuality(kept.quality);
      running = false;
    }
    last = report;
    table(report);
    refresh();
  }
  bench.addEventListener('click', () => run(QUALITY_ORDER.slice()));
  quick.addEventListener('click', () => run([api.quality()]));
  copy.addEventListener('click', () => {
    if (!last) return;
    const value = text(last);
    const ok = () => {
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy results'), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(ok, () => window.prompt('Copy the results', value));
    else window.prompt('Copy the results', value);
  });
  done.addEventListener('click', () => onClose());

  const panel = el('aside', { id: 'perf', class: 'lk-panel', 'aria-label': 'Quality and speed' },
    el('header', { class: 'lk-head' }, el('h2', { text: 'Quality and speed' }), el('span', { class: 'lk-hint', text: 'Switches apply at once, the game keeps running. Keys 1 to 6 change quality while this is open. I or a click on the game closes it.' })),
    qualityRow, note,
    el('section', { class: 'lk-group' }, el('h3', { text: 'Right now' }), readout),
    el('section', { class: 'lk-group' }, el('h3', { text: 'Speed-ups that keep the picture' }), switches),
    el('section', { class: 'lk-group' }, el('h3', { text: 'Benchmark' }),
      el('div', { class: 'lk-hint', text: 'Six fixed views, each timed with the speed-ups off (before) and on (after), twice in mirrored order. The screen jumps between views while it runs.' }),
      el('div', { class: 'pf-actions' }, quick, bench, copy), results),
    el('footer', { class: 'lk-foot' }, compare, done));
  panel.hidden = true;
  panel.addEventListener('pointerup', () => {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  });
  for (const type of ['wheel', 'mousedown', 'click']) panel.addEventListener(type, (event) => event.stopPropagation());
  document.body.appendChild(panel);
  refresh();

  return {
    run,
    get open() {
      return !panel.hidden;
    },
    get running() {
      return running;
    },
    get report() {
      return last;
    },
    key(code) {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(code);
      if (i < 0 || running) return false;
      api.setQuality(QUALITY_ORDER[i]);
      refresh();
      return true;
    },
    show(on) {
      panel.hidden = !on;
      clearInterval(timer);
      if (on) {
        refresh();
        tick();
        timer = setInterval(() => {
          if (!running) tick();
        }, 500);
      } else holdOff();
    },
  };
}

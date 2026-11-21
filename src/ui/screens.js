// Costa del Gzowo menu screens: title, pause, settings, controls and the map, avatar and garage menu.
import { ROAD, TOWN, WORLD } from '../config.js';
import { MAIN, CROSS, ALLEYS, LOTS, PLOTS, PLAZA } from '../world/town/layout.js';
import { heightAt } from '../world/heightfield.js';

const INK = '#f6f1e7';
const AMBER = '#f2a23a';
const TABS = [['map', 'Map'], ['avatar', 'Avatar'], ['garage', 'Garage'], ['settings', 'Settings']];
const QUALITY = [['ultra', 'Ultra'], ['high', 'High'], ['medium', 'Medium']];
const FOOT = [['Move', ['W', 'A', 'S', 'D']], ['Camera', ['Mouse']], ['Sprint', ['Shift']], ['Jump', ['Space']], ['Enter car', ['F']]];
const CAR = [['Throttle and brake', ['W', 'S']], ['Steer', ['A', 'D']], ['Handbrake', ['Space']], ['Exit car', ['F']], ['Radio', ['Q', 'E']], ['Roof', ['T']], ['Lights', ['H']], ['Camera', ['C']], ['Reset car', ['R']]];
const COMMON = [['Pause', ['Esc']], ['Map and menu', ['M']], ['Look editor', ['O']]];
const ROADSTER = [['Fly up', ['Space']], ['Hold altitude', ['release']], ['Descend and land', ['C']], ['Fly forward and brake', ['W', 'S']], ['Turn', ['A', 'D']], ['Boost', ['Shift']], ['Pitch and roll', ['I', 'K', 'J', 'L']], ['Flight assist', ['G']], ['Handbrake', ['X']], ['Camera', ['V']]];
const HELI = [['Climb', ['Space']], ['Hold altitude', ['release']], ['Descend and land', ['C']], ['Fly forward, brake and back up', ['W', 'S']], ['Turn', ['A', 'D']], ['Fly fast', ['Shift']], ['Landing light', ['H']], ['Camera', ['V']]];
const AVATARS = [{ id: 'default', name: 'Default', note: 'Everyday summer clothes', figure: 'plain' }];
const AVATARS_SOON = ['Driver', 'Swimmer'];
const VEHICLES = [{ id: 'convertible', name: 'Convertible', specs: { power: '400 hp', drive: 'AWD', mass: '1650 kg' } }];
const SPEC_ROWS = [['power', 'Power'], ['drive', 'Drive'], ['mass', 'Weight'], ['top', 'Top speed'], ['zeroTo100', '0 to 100 km/h'], ['ceiling', 'Ceiling'], ['seats', 'Seats']];
const FIGURES = {
  plain: '<svg viewBox="0 0 100 150"><circle cx="50" cy="32" r="17"/><path d="M14 150V96Q14 62 50 62Q86 62 86 96V150Z"/></svg>',
  hood: '<svg viewBox="0 0 100 150"><path fill-rule="evenodd" d="M50 6Q79 6 80 42Q80 58 66 68H34Q20 58 20 42Q21 6 50 6ZM50 21Q35 21 35 41Q35 56 50 58Q65 56 65 41Q65 21 50 21Z"/><circle cx="50" cy="40" r="10.5"/><path d="M14 150V98Q14 64 50 64Q86 64 86 98V150Z"/></svg>',
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const unit = (v, fallback) => (Number.isFinite(v) ? clamp(v, 0, 1) : fallback);

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (val === undefined || val === null || val === false) continue;
    if (key === 'text') node.textContent = val;
    else if (key === 'style') {
      for (const [prop, v] of Object.entries(val)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, v);
        else node.style[prop] = v;
      }
    } else if (key.startsWith('on')) node.addEventListener(key.slice(2), val);
    else node.setAttribute(key, val === true ? '' : String(val));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === undefined || kid === null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export function createScreens(options = {}) {
  const cfg = {
    title: 'Costa del Gzowo',
    cssHref: 'src/ui/screens.css',
    ...options,
  };
  const cb = (name, ...args) => {
    if (typeof cfg[name] === 'function') cfg[name](...args);
  };
  const values = {
    quality: QUALITY.some(([v]) => v === cfg.quality) ? cfg.quality : 'ultra',
    volume: unit(cfg.volume, 0.8),
    musicVolume: unit(cfg.musicVolume, 0.6),
  };

  const existingLink = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.getAttribute('href') === cfg.cssHref);
  const styleLink = existingLink || el('link', { rel: 'stylesheet', href: cfg.cssHref });
  if (!existingLink) document.head.append(styleLink);

  let state = 'loading';
  let panel = null;
  let panelOpener = null;
  let menuTab = 'map';
  let leaveTimer = 0;
  const syncers = [];
  const sync = () => syncers.forEach((fn) => fn());

  const item = (label, onclick, extra = '') => el('button', { type: 'button', class: `sc-item ${extra}`.trim(), 'data-nav': '', onclick }, label);

  function buildSlider(label, key, changed) {
    const out = el('output');
    const input = el('input', {
      type: 'range', min: '0', max: '100', step: '1', class: 'sc-range', 'data-nav': '', 'aria-label': label,
      oninput: () => {
        values[key] = Number(input.value) / 100;
        changed(values[key]);
        sync();
      },
    });
    syncers.push(() => {
      const v = Math.round(values[key] * 100);
      input.value = String(v);
      input.style.setProperty('--p', `${v}%`);
      out.textContent = `${v}%`;
    });
    return el('div', { class: 'sc-field' }, el('div', { class: 'sc-row' }, el('span', { text: label }), out), input);
  }

  function setQuality(value) {
    if (value === values.quality) return;
    values.quality = value;
    cb('onQuality', value);
    sync();
  }

  function stepSegment(button, dir) {
    const i = QUALITY.findIndex(([v]) => v === values.quality);
    const next = QUALITY[clamp(i + dir, 0, QUALITY.length - 1)][0];
    setQuality(next);
    button.parentElement.querySelector(`[data-value="${next}"]`).focus({ preventScroll: true });
  }

  function buildQuality() {
    const buttons = QUALITY.map(([value, label]) => el('button', {
      type: 'button', class: 'sc-seg-btn', role: 'radio', 'data-value': value, 'data-nav': '', onclick: () => setQuality(value),
    }, label));
    syncers.push(() => buttons.forEach((b) => {
      const on = b.dataset.value === values.quality;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }));
    return el('div', { class: 'sc-field' },
      el('div', { class: 'sc-row' }, el('span', { text: 'Quality' })),
      el('div', { class: 'sc-seg', role: 'radiogroup', 'aria-label': 'Quality' }, buttons));
  }

  function buildSettings() {
    return el('div', { class: 'sc-settings' },
      buildQuality(),
      buildSlider('Volume', 'volume', (v) => cb('onVolume', v)),
      buildSlider('Music', 'musicVolume', (v) => cb('onMusicVolume', v)));
  }

  function keyRow(label, keys) {
    return el('div', { class: 'sc-key-row' },
      el('span', { class: 'sc-key-label', text: label }),
      el('span', { class: 'sc-keys' }, keys.map((k) => el('kbd', { class: 'sc-kbd', text: k }))));
  }

  function keyCol(title, rows) {
    return el('div', { class: 'sc-keycol' }, el('div', { class: 'sc-keycol-title', text: title }), rows.map(([l, k]) => keyRow(l, k)));
  }

  function buildControls(single = false) {
    return el('div', { class: 'sc-controls' },
      el('div', { class: `sc-keys-grid${single ? ' one' : ''}` }, keyCol('On foot', FOOT), keyCol('In the car', CAR), keyCol('Roadster', ROADSTER), keyCol('Helicopter', HELI)),
      el('div', { class: 'sc-keys-common' }, keyCol('Anywhere', COMMON)));
  }

  function buildPanel(name, heading, body) {
    return el('aside', { class: 'sc-panel', 'data-panel': name, 'aria-label': heading },
      el('button', { type: 'button', class: 'sc-item sc-back', 'data-nav': '', onclick: () => closePanel() }, 'Back'),
      el('h2', { class: 'sc-panel-title', text: heading }),
      body);
  }

  const fill = el('i', { class: 'sc-progress-fill' });
  const statusText = el('span', { text: 'Starting' });
  const pct = el('span', { class: 'sc-pct', text: '0%' });
  const loadingBlock = el('div', { class: 'sc-phase sc-phase-loading' },
    el('div', { class: 'sc-progress' }, fill),
    el('div', { class: 'sc-status' }, statusText, pct));
  const readyBlock = el('div', { class: 'sc-phase sc-phase-ready', text: 'Press any key' });

  const startBtn = item('Start', () => start());
  const settingsBtn = item('Settings', () => openPanel('settings', settingsBtn));
  const controlsBtn = item('Controls', () => openPanel('controls', controlsBtn));
  const titleList = el('nav', { class: 'sc-phase sc-phase-list', role: 'menu' }, startBtn, settingsBtn, controlsBtn);

  const settingsPanel = buildPanel('settings', 'Settings', buildSettings());
  const controlsPanel = buildPanel('controls', 'Controls', buildControls());

  const npTitle = el('div', { class: 'sc-np-title' });
  const npArtist = el('div', { class: 'sc-np-artist' });
  const np = el('div', { class: 'sc-np' },
    el('div', { class: 'sc-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    el('div', { class: 'sc-np-text' }, npTitle, npArtist));

  const titleScreen = el('section', { class: 'sc-screen sc-title on', 'data-phase': 'loading', 'aria-label': cfg.title },
    el('div', { class: 'sc-bar sc-bar-top' }),
    el('div', { class: 'sc-bar sc-bar-bottom' }),
    el('div', { class: 'sc-shade' }),
    el('div', { class: 'sc-title-block' },
      el('div', { class: 'sc-brand', text: 'gzowo labs' }),
      el('h1', { class: 'sc-heading', text: cfg.title }),
      loadingBlock, readyBlock, titleList),
    np, settingsPanel, controlsPanel);

  const resumeBtn = item('Resume', () => resume(), 'sc-item-xl');
  const resetBtn = item('Reset car', () => { cb('onResetCar'); resume(); }, 'sc-item-xl');
  const mapBtn = item('Map and menu', () => openMenu('map'), 'sc-item-xl');
  const pauseControlsBtn = item('Controls', () => togglePauseControls(), 'sc-item-xl');
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
  const pauseControls = el('div', { class: 'sc-card sc-pause-controls' },
    el('div', { class: 'sc-card-title', text: 'Controls' }), buildControls(true));
  const pauseScreen = el('section', { class: 'sc-screen sc-pause', 'aria-label': 'Paused' },
    el('div', { class: 'sc-pause-col' },
      el('div', { class: 'sc-eyebrow', text: 'Paused' }),
      el('div', { class: 'sc-pause-list' }, resumeBtn, resetBtn, mapBtn, pauseControlsBtn),
      el('div', { class: 'sc-card sc-pause-settings' }, el('div', { class: 'sc-card-title', text: 'Settings' }), buildSettings())),
    pauseControls,
    el('div', { class: 'sc-hint', text: 'Esc to resume' }));

  const tabButtons = TABS.map(([id, label]) => el('button', {
    type: 'button', class: 'sc-tab', role: 'tab', 'data-tab': id, 'data-nav': '', 'aria-selected': 'false', onclick: () => setTab(id),
  }, label));
  const closeBtn = el('button', { type: 'button', class: 'sc-close', 'data-nav': '', onclick: () => closeMenuNow() },
    'Close', el('kbd', { class: 'sc-kbd', text: 'Esc' }));

  const canvas = el('canvas', { class: 'sc-map', width: 1024, height: 1024, role: 'img', 'aria-label': 'Map of the river' });
  const readout = el('div', { class: 'sc-readout' });
  const mapCtx = canvas.getContext('2d');
  let base = null;

  function legendRow(shape, label) {
    return el('div', { class: 'sc-legend-row' }, el('span', { class: `sc-shape sc-shape-${shape}`, 'aria-hidden': 'true' }), el('span', { text: label }));
  }

  function buildMapTab() {
    return el('div', { class: 'sc-tab-panel sc-tab-map', 'data-tab-panel': 'map' },
      el('div', { class: 'sc-map-row' },
        canvas,
        el('div', { class: 'sc-map-side' },
          el('div', { class: 'sc-legend' },
            legendRow('you', 'You'), legendRow('car', 'Car'), legendRow('bridge', 'Bridge'),
            legendRow('ramp', 'Boat ramp'), legendRow('closed', 'Road closed')),
          readout)));
  }

  function figure(kind) {
    const wrap = el('div', { class: 'sc-figure', 'aria-hidden': 'true' });
    wrap.innerHTML = FIGURES[kind] || FIGURES.plain;
    return wrap;
  }

  const avatarList = Array.isArray(cfg.avatars) && cfg.avatars.length ? cfg.avatars : AVATARS;
  let avatarId = avatarList.some((a) => a.id === cfg.avatar) ? cfg.avatar : avatarList[0].id;
  const mark = [];

  function buildAvatarTab() {
    const cards = avatarList.map((a) => {
      const tag = el('div', { class: 'sc-avatar-tag', text: 'Selected' });
      const card = el('button', {
        type: 'button', class: 'sc-avatar', 'data-nav': '',
        onclick: () => {
          if (avatarId === a.id) return;
          avatarId = a.id;
          mark.forEach((fn) => fn());
          cb('onAvatar', a.id);
        },
      }, figure(a.figure), el('div', { class: 'sc-avatar-name', text: a.name }), el('div', { class: 'sc-avatar-note', text: a.note }), tag);
      const apply = () => {
        const on = avatarId === a.id;
        card.classList.toggle('on', on);
        card.setAttribute('aria-pressed', String(on));
        card.setAttribute('aria-label', on ? `${a.name}, selected` : a.name);
        tag.style.visibility = on ? 'visible' : 'hidden';
      };
      mark.push(apply);
      apply();
      return card;
    });
    const soon = AVATARS_SOON.map((name) => el('div', { class: 'sc-avatar dim', 'aria-disabled': 'true' },
      figure('plain'), el('div', { class: 'sc-avatar-name', text: name }), el('div', { class: 'sc-avatar-note', text: 'Coming soon' })));
    return el('div', { class: 'sc-tab-panel', 'data-tab-panel': 'avatar' }, el('div', { class: 'sc-avatars' }, cards, soon));
  }
  const vehicleList = Array.isArray(cfg.vehicles) && cfg.vehicles.length ? cfg.vehicles : VEHICLES;
  const vehicleId = vehicleList.some((v) => v.id === cfg.vehicle) ? cfg.vehicle : vehicleList[0].id;

  function buildGarageTab() {
    const cards = vehicleList.map((v) => {
      const rows = SPEC_ROWS.filter(([key]) => v.specs && v.specs[key]).map(([key, label]) => el('div', { class: 'sc-spec-head' }, el('span', { text: label }), el('span', { class: 'sc-spec-val', text: v.specs[key] })));
      return el('button', {
        type: 'button', class: 'sc-car', 'data-nav': '', 'aria-label': `Go to the ${v.name}`,
        onclick: () => cb('onVehicle', v.id),
      }, el('div', { class: 'sc-car-head' }, el('div', { class: 'sc-car-name', text: v.name }), el('div', { class: 'sc-car-tag', text: 'Go there' })), el('div', { class: 'sc-specs' }, rows));
    });
    return el('div', { class: 'sc-tab-panel', 'data-tab-panel': 'garage' },
      el('div', { class: 'sc-cars' }, cards),
      el('div', { class: 'sc-car-note', text: 'Every vehicle is parked by the bridge. Pick one to be taken to its door.' }));
  }

  const playersBox = el('div', { class: 'sc-players' }, el('div', { class: 'sc-player' }, el('span', { text: 'Playing alone' })));
  const LINKS = { you: 'You', direct: 'Connected', relay: 'Connected, relayed', joining: 'Joining' };

  function setPlayers(list, world) {
    const rows = list.length ? list.map((p) => el('div', { class: `sc-player${p.me ? ' me' : ''}` }, el('span', { text: p.name }), el('span', { class: 'sc-player-note', text: LINKS[p.link] || 'Joining' }))) : [el('div', { class: 'sc-player' }, el('span', { text: 'Playing alone' }))];
    playersBox.replaceChildren(...rows);
    playersBox.dataset.world = world || '';
  }

  function buildName() {
    const input = el('input', { type: 'text', class: 'sc-input', maxlength: '16', 'aria-label': 'Your name', autocomplete: 'off', spellcheck: 'false' });
    input.value = cfg.name || '';
    for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, (event) => {
      event.stopPropagation();
      if (type === 'keydown' && event.key === 'Enter') input.blur();
    });
    input.addEventListener('change', () => {
      const value = input.value.trim().slice(0, 16);
      if (value) cb('onName', value);
      else input.value = cfg.name || '';
    });
    return el('div', { class: 'sc-field' }, el('div', { class: 'sc-row' }, el('span', { text: 'Your name' })), input);
  }

  function buildSettingsTab() {
    return el('div', { class: 'sc-tab-panel sc-tab-settings', 'data-tab-panel': 'settings' },
      el('div', { class: 'sc-tab-grid' },
        el('div', { class: 'sc-card' }, el('div', { class: 'sc-card-title', text: 'Settings' }), buildSettings(),
          el('button', { type: 'button', class: 'sc-look', 'data-nav': '', onclick: () => cb('onLook') }, 'Look editor: colours, lens and camera'),
          el('div', { class: 'sc-card-title sc-card-sub', text: 'Players here' }), buildName(), playersBox),
        el('div', { class: 'sc-card' }, el('div', { class: 'sc-card-title', text: 'Controls' }), buildControls())));
  }

  const tabPanels = { map: buildMapTab(), avatar: buildAvatarTab(), garage: buildGarageTab(), settings: buildSettingsTab() };
  const menuScreen = el('section', { class: 'sc-screen sc-menu', 'aria-label': 'Menu' },
    el('div', { class: 'sc-menu-top' }, el('nav', { class: 'sc-tabs', role: 'tablist' }, tabButtons), closeBtn),
    el('div', { class: 'sc-menu-body' }, Object.values(tabPanels)));

  const root = el('div', { id: 'screens', 'data-state': 'loading' }, titleScreen, pauseScreen, menuScreen);
  document.body.append(root);
  if (!styleLink.sheet) {
    root.style.display = 'none';
    const show = () => { root.style.display = ''; };
    styleLink.addEventListener('load', show, { once: true });
    styleLink.addEventListener('error', show, { once: true });
  }

  function setTab(id) {
    menuTab = id;
    tabButtons.forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    Object.entries(tabPanels).forEach(([key, node]) => { node.hidden = key !== id; });
  }
  setTab('map');

  function stepTab(dir) {
    const i = TABS.findIndex(([id]) => id === menuTab);
    const next = TABS[clamp(i + dir, 0, TABS.length - 1)][0];
    setTab(next);
    tabButtons.find((b) => b.dataset.tab === next).focus({ preventScroll: true });
  }

  function setState(next) {
    state = next;
    root.dataset.state = next;
  }

  function blurActive() {
    const active = document.activeElement;
    if (active && root.contains(active)) active.blur();
  }

  function setPhase(phase) {
    titleScreen.dataset.phase = phase;
  }

  function setProgress(f, text) {
    const v = unit(Number(f), 0);
    fill.style.width = `${(v * 100).toFixed(1)}%`;
    pct.textContent = `${Math.round(v * 100)}%`;
    if (text !== undefined && text !== null) statusText.textContent = text;
  }

  function ready() {
    if (state !== 'loading') return;
    setState('ready');
    setPhase('ready');
  }

  function gesture() {
    if (state !== 'ready') return;
    setState('title');
    setPhase('title');
    cb('onGesture');
    startBtn.focus({ preventScroll: true });
  }

  function start() {
    if (state !== 'title') return;
    panel = null;
    settingsPanel.classList.remove('open');
    controlsPanel.classList.remove('open');
    setState('playing');
    titleScreen.classList.remove('on');
    titleScreen.classList.add('leaving');
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => titleScreen.classList.remove('leaving'), 720);
    blurActive();
    cb('onStart');
  }

  function openPanel(name, opener) {
    if (state !== 'title') return;
    if (!panel) panelOpener = opener;
    panel = name;
    settingsPanel.classList.toggle('open', name === 'settings');
    controlsPanel.classList.toggle('open', name === 'controls');
    (name === 'settings' ? settingsPanel : controlsPanel).querySelector('.sc-back').focus({ preventScroll: true });
  }

  function closePanel() {
    if (!panel) return;
    const back = panelOpener;
    panel = null;
    settingsPanel.classList.remove('open');
    controlsPanel.classList.remove('open');
    (back || startBtn).focus({ preventScroll: true });
  }

  function showPause() {
    if (state !== 'playing') return;
    setState('paused');
    pauseScreen.classList.add('on');
    pauseControls.classList.remove('on');
    pauseControlsBtn.setAttribute('aria-expanded', 'false');
    resumeBtn.focus({ preventScroll: true });
  }

  function hidePause() {
    if (state !== 'paused') return;
    setState('playing');
    pauseScreen.classList.remove('on');
    pauseControls.classList.remove('on');
    blurActive();
  }

  function resume() {
    if (state !== 'paused') return;
    hidePause();
    cb('onResume');
  }

  function togglePauseControls() {
    const open = !pauseControls.classList.contains('on');
    pauseControls.classList.toggle('on', open);
    pauseControlsBtn.setAttribute('aria-expanded', String(open));
  }

  function openMenu(tab = 'map') {
    const tabId = TABS.some(([id]) => id === tab) ? tab : 'map';
    if (state === 'menu') {
      setTab(tabId);
      return;
    }
    if (state !== 'playing' && state !== 'paused') return;
    pauseScreen.classList.remove('on');
    pauseControls.classList.remove('on');
    setState('menu');
    menuScreen.classList.add('on');
    setTab(tabId);
    tabButtons.find((b) => b.dataset.tab === tabId).focus({ preventScroll: true });
  }

  function closeMenu() {
    if (state !== 'menu') return;
    setState('playing');
    menuScreen.classList.remove('on');
    blurActive();
  }

  function closeMenuNow() {
    if (state !== 'menu') return;
    closeMenu();
    cb('onMenuClose');
  }

  function setTrack(track) {
    if (!track) {
      np.classList.remove('on');
      return;
    }
    npTitle.textContent = track.title || '';
    npArtist.textContent = track.artist || '';
    np.classList.add('on');
  }

  function navScope() {
    if (state === 'title') return panel ? (panel === 'settings' ? settingsPanel : controlsPanel) : titleList;
    if (state === 'paused') return pauseScreen.querySelector('.sc-pause-col');
    if (state === 'menu') return menuScreen;
    return null;
  }

  function navItems() {
    const scope = navScope();
    if (!scope) return [];
    return [...scope.querySelectorAll('[data-nav]')].filter((n) => n.tabIndex >= 0 && getComputedStyle(n).visibility === 'visible');
  }

  function moveFocus(dir) {
    const items = navItems();
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = i < 0 ? (dir > 0 ? 0 : items.length - 1) : clamp(i + dir, 0, items.length - 1);
    items[next].focus({ preventScroll: true });
  }

  function closeOnEscape() {
    if (state === 'paused') resume();
    else if (state === 'menu') closeMenuNow();
    else if (state === 'title') closePanel();
  }

  function onKeyDown(e) {
    if (state === 'playing') return;
    e.stopPropagation();
    if (state === 'loading') return;
    if (state === 'ready') {
      e.preventDefault();
      if (!e.repeat) gesture();
      return;
    }
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      closeOnEscape();
      return;
    }
    if (state === 'menu' && (k === 'm' || k === 'M')) {
      e.preventDefault();
      closeMenuNow();
      return;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'w' || k === 'W' || k === 's' || k === 'S') {
      e.preventDefault();
      moveFocus(k === 'ArrowDown' || k === 's' || k === 'S' ? 1 : -1);
      return;
    }
    const isArrow = k === 'ArrowLeft' || k === 'ArrowRight';
    const isTabKey = k === 'q' || k === 'Q' || k === 'e' || k === 'E';
    if (!isArrow && !isTabKey) return;
    const dir = k === 'ArrowRight' || k === 'e' || k === 'E' ? 1 : -1;
    const target = e.target;
    if (isArrow && target instanceof HTMLInputElement && target.type === 'range') return;
    if (isArrow && target instanceof HTMLElement && target.classList.contains('sc-seg-btn')) {
      e.preventDefault();
      stepSegment(target, dir);
      return;
    }
    if (state === 'menu') {
      e.preventDefault();
      stepTab(dir);
    }
  }

  function onKeyUp(e) {
    if (state !== 'playing') e.stopPropagation();
  }

  root.addEventListener('click', () => {
    if (state === 'ready') gesture();
  });
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);

  function buildBase() {
    const size = 512;
    const span = WORLD.half * 2;
    const cell = span / size;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const h = new Float32Array(size * size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) h[j * size + i] = heightAt(-WORLD.half + (i + 0.5) * cell, -WORLD.half + (j + 0.5) * cell);
    }
    const img = g.createImageData(size, size);
    const d = img.data;
    const lx = -0.55;
    const ly = 0.8;
    const lz = -0.45;
    const ll = Math.hypot(lx, ly, lz);
    const flat = ly / ll;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const hv = h[j * size + i];
        let r;
        let gg;
        let b;
        if (hv < 0) {
          const t = clamp(-hv / 5, 0, 1);
          r = mix(43, 15, t);
          gg = mix(143, 74, t);
          b = mix(138, 82, t);
        } else {
          const dx = (h[j * size + Math.min(size - 1, i + 1)] - h[j * size + Math.max(0, i - 1)]) / (2 * cell);
          const dz = (h[Math.min(size - 1, j + 1) * size + i] - h[Math.max(0, j - 1) * size + i]) / (2 * cell);
          const dot = (-dx * lx + ly - dz * lz) / (Math.hypot(dx, 1, dz) * ll);
          const shade = clamp(1 + (dot - flat) * 2.2, 0.7, 1.18);
          const t = clamp(hv / 16, 0, 1);
          const sand = clamp((1.4 - hv) / 1.4, 0, 1) * 0.55;
          r = mix(mix(75, 122, t), 163, sand) * shade;
          gg = mix(mix(90, 122, t), 154, sand) * shade;
          b = mix(mix(60, 85, t), 116, sand) * shade;
        }
        const o = (j * size + i) * 4;
        d[o] = r;
        d[o + 1] = gg;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.setTransform(size / span, 0, 0, size / span, size / 2, size / 2);
    g.fillStyle = 'rgba(190,176,140,0.9)';
    g.fillRect(ROAD.pullOff.x0, ROAD.pullOff.z0, ROAD.pullOff.x1 - ROAD.pullOff.x0, ROAD.pullOff.z1 - ROAD.pullOff.z0);
    g.fillStyle = '#3a3e41';
    g.fillRect(-262, -4.5, 524, 9);
    g.globalAlpha = 0.9;
    g.fillStyle = AMBER;
    g.fillRect(-262, -0.3, 524, 0.6);
    g.globalAlpha = 1;
    g.fillStyle = '#6e7377';
    g.fillRect(-48, -6.3, 96, 12.6);
    g.strokeStyle = 'rgba(246,241,231,0.55)';
    g.lineWidth = 0.9;
    g.strokeRect(-48, -6.3, 96, 12.6);
    for (const x of [-238]) {
      g.fillStyle = INK;
      g.fillRect(x - 1.5, -6.5, 3, 13);
      g.fillStyle = '#1b1e20';
      for (let z = -6.5; z < 6.5; z += 4) g.fillRect(x - 1.5, z, 3, 2);
    }
    g.fillStyle = 'rgba(150,140,120,0.55)';
    g.fillRect(TOWN.x0 + 4, TOWN.z0 + 4, TOWN.x1 - TOWN.x0 - 8, TOWN.z1 - TOWN.z0 - 8);
    g.fillStyle = '#3a3e41';
    g.fillRect(MAIN.x0, -MAIN.half, MAIN.x1 - MAIN.x0, MAIN.half * 2);
    for (const c of CROSS) g.fillRect(c.x - c.half, c.z0, c.half * 2, c.z1 - c.z0);
    for (const a of ALLEYS) g.fillRect(a.x0, a.z - a.half, a.x1 - a.x0, a.half * 2);
    g.fillStyle = '#4a4e51';
    for (const l of LOTS) g.fillRect(l.x0, l.z0, l.x1 - l.x0, l.z1 - l.z0);
    g.fillStyle = 'rgba(214,170,120,0.9)';
    g.fillRect(PLAZA.x0, PLAZA.z0, PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0);
    g.fillStyle = '#e9dcc4';
    g.strokeStyle = 'rgba(30,30,30,0.6)';
    g.lineWidth = 0.6;
    for (const p of PLOTS) {
      g.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
      g.strokeRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
    }
    g.globalAlpha = 0.9;
    g.fillStyle = AMBER;
    g.fillRect(MAIN.x0, -0.3, MAIN.x1 - MAIN.x0, 0.6);
    g.globalAlpha = 1;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = '600 9px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = INK;
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 3;
    const tx = (x) => size / 2 + (x * size) / span;
    g.fillText('GZOWO SPRINGS', tx((TOWN.x0 + TOWN.x1) / 2), tx(TOWN.z1) + 12);
    g.restore();
    return c;
  }

  function drawCarMark(x, y, yaw) {
    const g = mapCtx;
    g.save();
    g.translate(x, y);
    g.rotate(-yaw);
    g.beginPath();
    g.roundRect(-10, -18, 20, 36, 6);
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 8;
    g.fillStyle = AMBER;
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(8,9,10,0.8)';
    g.stroke();
    g.restore();
  }

  function drawPlayerMark(x, y, yaw) {
    const g = mapCtx;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    g.save();
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x + fx * 10, y + fz * 10);
    g.lineTo(x + fx * 26, y + fz * 26);
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(8,9,10,0.8)';
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(8,9,10,0.8)';
    g.stroke();
    g.restore();
  }

  function setMap(data) {
    if (!data) return;
    if (!base) base = buildBase();
    const S = canvas.width;
    const k = S / (WORLD.half * 2);
    const px = (v) => (v + WORLD.half) * k;
    mapCtx.setTransform(1, 0, 0, 1, 0, 0);
    mapCtx.clearRect(0, 0, S, S);
    mapCtx.drawImage(base, 0, 0, S, S);
    if (data.car) drawCarMark(px(data.car.x), px(data.car.z), data.car.yaw || 0);
    if (data.player) {
      drawPlayerMark(px(data.player.x), px(data.player.z), data.player.yaw || 0);
      readout.textContent = `x ${Math.round(data.player.x)}  z ${Math.round(data.player.z)}`;
    }
  }

  sync();

  return {
    setProgress,
    ready,
    setTrack,
    setPlayers,
    showPause,
    hidePause,
    openMenu,
    closeMenu,
    setMap,
    get state() {
      return state;
    },
  };
}

// Costa del Gzowo: races (start beacons, lining up, a countdown on the clock every player shares, gates, live standing, results and best times), alone or against the other players of the session.
import * as THREE from 'three';
import { COURSES, KINDS } from './courses.js';
import { createMarkers, gatePoint } from './markers.js';

export const PHASE = { NONE: 0, STAGED: 1, RUN: 2, DONE: 3 };
const HELD = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyX', 'KeyG', 'KeyF', 'KeyR'];
const COUNTDOWN = 4000;
const SPAN = 4294967296;
const wrap = (a) => ((a % SPAN) + SPAN) % SPAN;
const since = (a, b) => {
  const d = wrap(a - b);
  return d > SPAN / 2 ? d - SPAN : d;
};

function clockText(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = (t - m * 60000) / 1000;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createRaces(ctx, play) {
  const { input } = ctx;
  const markers = createMarkers(ctx);
  const me = { course: -1, phase: PHASE.NONE, cp: 0, startAt: 0, time: 0 };
  const view = new THREE.Vector3();
  const gate = new THREE.Vector3();
  const startPoints = COURSES.map((c) => new THREE.Vector2(c.start[0], c.start[1]));
  let sequence = [];
  let held = false;
  let away = 0;
  let doneFor = 0;
  let echo = null;
  let echoFor = 0;
  let noteFor = 0;
  let best = {};
  try {
    best = JSON.parse(localStorage.getItem('costa-race-best') || '{}') || {};
  } catch (error) {
    best = {};
  }

  const box = el('div');
  box.id = 'race';
  const hint = el('div', 'rc-hint');
  const hintKey = el('b');
  const hintText = el('span');
  hint.append(hintKey, hintText);
  const bar = el('div', 'rc-bar');
  const barName = el('div', 'rc-name');
  const barTime = el('div', 'rc-time');
  const barInfo = el('div', 'rc-info');
  bar.append(barName, barTime, barInfo);
  const count = el('div', 'rc-count');
  const results = el('div', 'rc-results');
  const note = el('div', 'rc-note');
  box.append(hint, bar, count, results, note);
  (document.getElementById('hud') || document.body).append(box);
  const shown = { hint: '', bar: '', time: '', info: '', count: '', results: '', note: '' };
  const put = (key, node, text) => {
    if (shown[key] === text) return;
    shown[key] = text;
    node.textContent = text;
  };

  function setHint(key, text) {
    const id = key + '|' + text;
    if (shown.hint === id) return;
    shown.hint = id;
    hintKey.textContent = key;
    hintKey.hidden = !key;
    hintText.textContent = text;
    hint.classList.toggle('on', !!text);
  }

  function say(text, seconds = 4) {
    put('note', note, text);
    note.classList.toggle('on', !!text);
    noteFor = seconds;
  }

  function hold(on) {
    if (held === on) return;
    held = on;
    input.mute(on ? HELD : null);
    play.game.hold = on;
  }

  function clock() {
    return wrap(ctx.net && ctx.net.clock ? ctx.net.clock() : Date.now());
  }

  function leave(message) {
    hold(false);
    if (me.phase === PHASE.DONE) {
      echo = { ...me };
      echoFor = 90;
    }
    me.course = -1;
    me.phase = PHASE.NONE;
    me.cp = 0;
    me.startAt = 0;
    me.time = 0;
    sequence = [];
    markers.setGates(null, [], 0);
    markers.showStarts(true);
    bar.classList.remove('on');
    results.classList.remove('on');
    put('count', count, '');
    if (message) say(message);
  }

  function stage(index) {
    const course = COURSES[index];
    me.course = index;
    me.phase = PHASE.STAGED;
    me.cp = 0;
    me.time = 0;
    sequence = [];
    for (let lap = 0; lap < (course.laps || 1); lap++) sequence.push(...course.gates);
    markers.showStarts(false);
    markers.setGates(course, sequence, 0);
    hold(true);
    put('bar', barName, course.name);
    bar.classList.add('on');
    put('time', barTime, clockText(0));
  }

  function begin(at) {
    me.phase = PHASE.RUN;
    me.startAt = at;
    me.cp = 0;
  }

  function finish(ms) {
    const course = COURSES[me.course];
    me.phase = PHASE.DONE;
    me.time = Math.max(1, Math.round(ms));
    doneFor = 0;
    markers.setGates(null, [], 0);
    const old = best[course.id];
    if (!old || me.time < old) {
      best[course.id] = me.time;
      try {
        localStorage.setItem('costa-race-best', JSON.stringify(best));
      } catch (error) {
        best[course.id] = me.time;
      }
      say(old ? `New best on ${course.name}, ${clockText(old - me.time)} quicker` : `First time set on ${course.name}`, 8);
    }
  }

  function rivals(peers) {
    return peers.filter((p) => p.course === me.course && p.phase >= PHASE.RUN && Math.abs(since(p.startAt, me.startAt)) < 60);
  }

  function showResults(list) {
    const rows = [{ name: 'You', time: me.time, cp: sequence.length, me: true }, ...list.map((p) => ({ name: p.name, time: p.phase === PHASE.DONE ? p.time : 0, cp: p.cp }))];
    rows.sort((a, b) => (a.time && b.time ? a.time - b.time : a.time ? -1 : b.time ? 1 : b.cp - a.cp));
    const course = COURSES[me.course];
    const text = rows.map((r, i) => `${i + 1}|${r.name}|${r.time ? clockText(r.time) : 'still racing'}|${r.me ? 1 : 0}`).join('\n') + `\n${best[course.id] || 0}`;
    if (shown.results === text) return;
    shown.results = text;
    results.textContent = '';
    results.append(el('h3', '', course.name));
    rows.forEach((r, i) => {
      const row = el('div', r.me ? 'rc-row me' : 'rc-row');
      row.append(el('i', '', String(i + 1)), el('span', '', r.name), el('b', '', r.time ? clockText(r.time) : 'still racing'));
      results.append(row);
    });
    results.append(el('small', '', `Your best ${clockText(best[course.id] || me.time)}   ·   Enter closes`));
    results.classList.add('on');
  }

  function update(dt, live = true) {
    const game = play.game;
    markers.root.visible = live;
    box.hidden = !live;
    if (!live) return;
    const peers = ctx.net && ctx.net.racers ? ctx.net.racers() : [];
    const driving = game.mode === 'car' && !game.transition;
    const item = play.vehicle;
    const now = clock();
    view.copy(driving ? play.car.position : play.player.state.position);
    markers.update(dt, ctx.lighting ? ctx.lighting.night : 0);
    echoFor -= dt;
    if (noteFor > 0) {
      noteFor -= dt;
      if (noteFor <= 0) say('', 0);
    }

    if (me.phase === PHASE.NONE) {
      let near = -1;
      let nearD = Infinity;
      startPoints.forEach((p, i) => {
        const d = Math.hypot(p.x - view.x, p.y - view.z);
        if (d < KINDS[COURSES[i].kind].zone && d < nearD) {
          near = i;
          nearD = d;
        }
      });
      if (near < 0) {
        const lining = peers.find((p) => p.phase === PHASE.STAGED && COURSES[p.course]);
        setHint('', lining ? `${lining.name} is lining up for ${COURSES[lining.course].name}` : '');
        return;
      }
      const course = COURSES[near];
      const kind = KINDS[course.kind];
      const fits = driving && kind.vehicles.includes(item.id) && !play.damage.state.exploded;
      if (!fits) {
        setHint('', driving || nearD < 6 ? `${course.name}: bring ${kind.bring}` : '');
        return;
      }
      const record = best[course.id] ? `   ·   best ${clockText(best[course.id])}` : '';
      setHint('Enter', `${course.name}, ${kind.label}${record}`);
      if (input.hit('Enter', 'NumpadEnter')) stage(near);
      return;
    }

    const course = COURSES[me.course];
    const kind = KINDS[course.kind];

    if (me.phase === PHASE.STAGED) {
      const lined = peers.filter((p) => p.course === me.course && p.phase === PHASE.STAGED);
      const lead = peers.find((p) => p.course === me.course && p.phase === PHASE.RUN && since(p.startAt, now) > -15000);
      const alone = peers.length === 0;
      put('info', barInfo, lined.length ? `With ${lined.map((p) => p.name).join(', ')}` : alone ? '' : 'Waiting at the line');
      setHint('Enter', alone ? 'Start' : `Start${lined.length ? ' for everyone at the line' : ' alone'}   ·   Backspace leaves`);
      if (lead) begin(lead.startAt);
      else if (alone || input.hit('Enter', 'NumpadEnter')) begin(wrap(now + COUNTDOWN));
      else if (input.hit('Backspace') || !driving) leave('Left the line');
      return;
    }

    if (me.phase === PHASE.RUN) {
      const t = since(now, me.startAt);
      const field = rivals(peers);
      if (t < 0) {
        const earlier = peers.find((p) => p.course === me.course && p.phase === PHASE.RUN && since(p.startAt, me.startAt) < -60 && since(p.startAt, now) > -3000);
        if (earlier) me.startAt = earlier.startAt;
        put('count', count, String(Math.ceil(-t / 1000)));
        count.classList.add('on');
        setHint('', '');
        put('info', barInfo, field.length ? `Against ${field.map((p) => p.name).join(', ')}` : '');
        if (!driving) leave('Left the race');
        return;
      }
      if (held) hold(false);
      put('count', count, t < 1100 ? 'GO' : '');
      count.classList.toggle('on', t < 1100);
      put('time', barTime, clockText(t));
      gatePoint(course, sequence[me.cp], gate);
      const radius = course.radius || kind.radius;
      const flat = Math.hypot(view.x - gate.x, view.z - gate.z);
      const reached = course.kind === 'air' ? view.distanceTo(gate) < radius : flat < radius && Math.abs(view.y - gate.y) < 9;
      if (reached) {
        me.cp++;
        if (me.cp >= sequence.length) {
          finish(t);
          return;
        }
        markers.setGates(course, sequence, me.cp);
        gatePoint(course, sequence[me.cp], gate);
      }
      let ahead = 0;
      const mine = view.distanceTo(gate);
      for (const p of field) if (p.phase === PHASE.DONE || p.cp > me.cp || (p.cp === me.cp && Math.hypot(p.x - gate.x, p.z - gate.z) < mine)) ahead++;
      put('info', barInfo, `Gate ${me.cp + 1} of ${sequence.length}   ·   ${Math.round(mine)} m${field.length ? `   ·   Place ${ahead + 1} of ${field.length + 1}` : ''}`);
      setHint('', t < 5000 ? 'Backspace leaves the race' : '');
      away = driving ? 0 : away + dt;
      if (input.hit('Backspace')) leave('Left the race');
      else if (away > 4 || play.damage.state.exploded) leave('Out of the race');
      return;
    }

    doneFor += dt;
    put('time', barTime, clockText(me.time));
    put('info', barInfo, 'Finished');
    showResults(rivals(peers));
    setHint('', '');
    if (doneFor > 1 && (input.hit('Enter', 'NumpadEnter', 'Backspace') || doneFor > 20)) leave('');
  }

  leave('');

  return {
    update,
    markers,
    courses: COURSES,
    state: me,
    net() {
      return me.phase === PHASE.NONE && echo && echoFor > 0 ? echo : me;
    },
    get best() {
      return best;
    },
    stage,
    begin,
    leave,
  };
}

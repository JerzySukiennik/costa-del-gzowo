// Costa del Gzowo: code-drawn town atlas (shop signs, neon, street signs, posters, stickers, tags, pieces, murals, stains).
import * as THREE from 'three';
import { rng } from '../scatter.js';

const SIZE = 4096;
const PAD = 6;
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const BLACK = '"Arial Black", "Helvetica Neue", Impact, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const SLAB = 'Rockwell, "American Typewriter", Georgia, serif';
const SCRIPT = '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive';
const MARKER = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
const HAND = '"Bradley Hand", "Noteworthy", "Comic Sans MS", cursive';
const FUTURA = 'Futura, "Avenir Next", "Century Gothic", sans-serif';
const TYPE = '"American Typewriter", "Courier New", monospace';

function makePacker() {
  let sky = [{ x: 0, y: 0, w: SIZE }];
  return (w, h) => {
    const W = w + PAD;
    const H = h + PAD;
    let best = null;
    for (let i = 0; i < sky.length; i++) {
      const x = sky[i].x;
      if (x + W > SIZE + PAD) break;
      let y = 0;
      let span = 0;
      for (let j = i; j < sky.length && span < W; j++) {
        y = Math.max(y, sky[j].y);
        span += sky[j].w;
      }
      if (span < W) continue;
      if (!best || y < best.y || (y === best.y && x < best.x)) best = { x, y };
    }
    if (!best || best.y + h > SIZE) throw new Error('town atlas full');
    const next = [];
    for (const s of sky) {
      const s0 = s.x;
      const s1 = s.x + s.w;
      if (s1 <= best.x || s0 >= best.x + W) next.push(s);
      else {
        if (s0 < best.x) next.push({ x: s0, y: s.y, w: best.x - s0 });
        if (s1 > best.x + W) next.push({ x: best.x + W, y: s.y, w: s1 - best.x - W });
      }
    }
    next.push({ x: best.x, y: best.y + H, w: W });
    next.sort((a, b) => a.x - b.x);
    sky = [];
    for (const s of next) {
      const last = sky[sky.length - 1];
      if (last && last.y === s.y && last.x + last.w === s.x) last.w += s.w;
      else sky.push({ ...s });
    }
    return { x: best.x, y: best.y, w, h };
  };
}

function fitText(g, str, font, size, maxW) {
  let s = size;
  g.font = font.replace('$', s);
  while (g.measureText(str).width > maxW && s > 6) {
    s -= 2;
    g.font = font.replace('$', s);
  }
  return s;
}

function grain(g, w, h, amount, random) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function weather(g, w, h, random, { scratches = 20, spots = 14, fade = 0.12, rust = false } = {}) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < spots; i++) {
    const r = 4 + random() * w * 0.05;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    const col = rust ? `rgba(${120 + random() * 40},${50 + random() * 20},20,` : `rgba(${60 + random() * 30},${50 + random() * 20},${40},`;
    grd.addColorStop(0, col + (0.25 + random() * 0.35) + ')');
    grd.addColorStop(1, col + '0)');
    g.setTransform(1, 0, 0, 0.6 + random(), random() * w, random() * h);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < scratches; i++) {
    g.lineWidth = 0.5 + random();
    g.beginPath();
    const x = random() * w;
    const y = random() * h;
    g.moveTo(x, y);
    g.lineTo(x + (random() - 0.5) * w * 0.15, y + (random() - 0.5) * h * 0.2);
    g.stroke();
  }
  const fg = g.createLinearGradient(0, 0, 0, h);
  fg.addColorStop(0, `rgba(255,250,235,${fade})`);
  fg.addColorStop(1, `rgba(255,250,235,${fade * 0.3})`);
  g.fillStyle = fg;
  g.fillRect(0, 0, w, h);
  if (rust) {
    for (let i = 0; i < 6; i++) {
      const x = random() * w;
      const rg = g.createLinearGradient(x, 0, x, h);
      rg.addColorStop(0, 'rgba(110,50,20,0.35)');
      rg.addColorStop(1, 'rgba(110,50,20,0)');
      g.fillStyle = rg;
      g.fillRect(x, random() * h * 0.5, 2 + random() * 5, h * (0.3 + random() * 0.6));
    }
  }
  g.restore();
}

function neon(g, str, x, y, font, color, width = 6) {
  g.save();
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = width * 3;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.strokeText(str, x, y);
  g.shadowBlur = width * 1.2;
  g.strokeText(str, x, y);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(1.5, width * 0.35);
  g.strokeText(str, x, y);
  g.restore();
}

function centered(g, str, x, y, font, fill, stroke = null, sw = 0) {
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineJoin = 'round';
    g.lineWidth = sw;
    g.strokeStyle = stroke;
    g.strokeText(str, x, y);
  }
  g.fillStyle = fill;
  g.fillText(str, x, y);
}

function rocket(g, x, y, s, body = '#f1ede4', accent = '#e0483a', flame = true) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (flame) {
    const fl = g.createLinearGradient(0, 40, 0, 95);
    fl.addColorStop(0, '#fff4b0');
    fl.addColorStop(0.4, '#ffb431');
    fl.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = fl;
    g.beginPath();
    g.moveTo(-10, 40);
    g.quadraticCurveTo(0, 110, 10, 40);
    g.fill();
  }
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(-12, 20);
  g.lineTo(-26, 44);
  g.lineTo(-12, 38);
  g.closePath();
  g.moveTo(12, 20);
  g.lineTo(26, 44);
  g.lineTo(12, 38);
  g.closePath();
  g.fill();
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, -50);
  g.bezierCurveTo(16, -30, 14, 10, 12, 40);
  g.lineTo(-12, 40);
  g.bezierCurveTo(-14, 10, -16, -30, 0, -50);
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(0, -50);
  g.bezierCurveTo(9, -40, 11, -30, 12, -26);
  g.lineTo(-12, -26);
  g.bezierCurveTo(-11, -30, -9, -40, 0, -50);
  g.fill();
  g.fillStyle = '#3d6f9a';
  g.beginPath();
  g.arc(0, -8, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2a2a2a';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}

function palm(g, x, y, h, color, lean = 0.15) {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  g.lineWidth = h * 0.05;
  const tx = x + lean * h;
  const ty = y - h;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + lean * h * 0.2, y - h * 0.5, tx, ty);
  g.stroke();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.48 + (i % 2) * 0.12;
    const len = h * (0.42 + 0.08 * (i % 3));
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + len * 0.35;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.7 - len * 0.1, ex, ey);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5, tx, ty + 2);
    g.fill();
  }
  g.restore();
}

function flamingo(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = '#e86f9a';
  g.fillStyle = '#f08cb0';
  g.lineCap = 'round';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 60);
  g.lineTo(2, 20);
  g.moveTo(2, 40);
  g.lineTo(14, 36);
  g.lineTo(6, 52);
  g.stroke();
  g.beginPath();
  g.ellipse(4, 10, 26, 15, -0.2, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(-16, 4);
  g.bezierCurveTo(-34, -20, -6, -40, -18, -58);
  g.stroke();
  g.fillStyle = '#f08cb0';
  g.beginPath();
  g.arc(-18, -60, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#222';
  g.beginPath();
  g.moveTo(-24, -60);
  g.lineTo(-34, -52);
  g.lineTo(-24, -55);
  g.fill();
  g.restore();
}

function gator(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#4f7a35';
  g.beginPath();
  g.moveTo(-90, 0);
  g.quadraticCurveTo(-40, -22, 20, -16);
  g.lineTo(70, -12);
  g.lineTo(96, -4);
  g.lineTo(70, 4);
  g.quadraticCurveTo(0, 18, -90, 0);
  g.fill();
  g.fillStyle = '#3c5f28';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(-70 + i * 12, -8 - (i < 5 ? i : 9 - i));
    g.lineTo(-64 + i * 12, -18 - (i < 5 ? i : 9 - i));
    g.lineTo(-58 + i * 12, -9 - (i < 5 ? i : 9 - i));
    g.fill();
  }
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(58, -16, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(59, -16, 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4f7a35';
  for (const lx of [-40, 20]) {
    g.fillRect(lx, 6, 9, 16);
  }
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    g.moveTo(74 + i * 4, -3);
    g.lineTo(76 + i * 4, 1);
  }
  g.stroke();
  g.restore();
}

function dripText(g, str, x, y, font, color, random, drips = 6) {
  centered(g, str, x, y, font, color);
  const w = g.measureText(str).width;
  g.fillStyle = color;
  for (let i = 0; i < drips; i++) {
    const dx = x - w / 2 + random() * w;
    const len = 8 + random() * 40;
    g.fillRect(dx, y + 6, 2 + random() * 2, len);
    g.beginPath();
    g.arc(dx + 1.5, y + 6 + len, 2.5, 0, Math.PI * 2);
    g.fill();
  }
}

function tag(g, w, h, str, color, random) {
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate((random() - 0.5) * 0.25);
  g.transform(1, 0, -0.25 - random() * 0.2, 1, 0, 0);
  const size = fitText(g, str, `bold $px ${MARKER}`, h * 0.62, w * 0.82);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.lineWidth = size * 0.11;
  g.font = `bold ${size}px ${MARKER}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeText(str, 0, 0);
  g.beginPath();
  const tw = g.measureText(str).width;
  g.moveTo(-tw * 0.55, size * 0.45);
  g.bezierCurveTo(-tw * 0.1, size * 0.7, tw * 0.3, size * 0.2, tw * 0.62, size * 0.5);
  g.stroke();
  g.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const dx = -tw / 2 + random() * tw;
    g.fillRect(dx, size * 0.2, 2, 10 + random() * 30);
  }
  g.beginPath();
  g.arc(tw * 0.62, -size * 0.3, size * 0.12, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

function throwie(g, w, h, str, fill, outline, random) {
  g.save();
  g.translate(w / 2, h / 2 + h * 0.04);
  g.rotate((random() - 0.5) * 0.12);
  const size = fitText(g, str, `900 $px ${BLACK}`, h * 0.7, w * 0.72);
  g.font = `900 ${size}px ${BLACK}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.42;
  g.strokeStyle = outline;
  g.strokeText(str, 0, 0);
  g.lineWidth = size * 0.28;
  g.strokeStyle = fill;
  g.strokeText(str, 0, 0);
  g.fillStyle = fill;
  g.fillText(str, 0, 0);
  g.lineWidth = size * 0.05;
  g.strokeStyle = outline;
  g.strokeText(str, 0, 0);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse((random() - 0.5) * size * 1.6, -size * 0.2, size * 0.06, size * 0.03, -0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function piece(g, w, h, str, colors, random) {
  g.save();
  g.translate(w / 2, h / 2 + h * 0.05);
  const size = fitText(g, str, `900 $px ${BLACK}`, h * 0.62, w * 0.8);
  g.font = `900 ${size}px ${BLACK}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const cloud = g.createLinearGradient(0, -h / 2, 0, h / 2);
  cloud.addColorStop(0, colors[3]);
  cloud.addColorStop(1, colors[4]);
  g.fillStyle = cloud;
  g.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.ellipse(Math.cos(a) * w * 0.38, Math.sin(a) * h * 0.3, w * 0.12, h * 0.2, 0, 0, Math.PI * 2);
  }
  g.fill();
  for (let k = 12; k > 0; k--) {
    g.fillStyle = k > 10 ? '#111' : colors[2];
    g.fillText(str, k * 1.6, k * 1.6);
  }
  g.lineWidth = size * 0.12;
  g.strokeStyle = '#111';
  g.strokeText(str, 0, 0);
  const fill = g.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
  fill.addColorStop(0, colors[0]);
  fill.addColorStop(0.55, colors[1]);
  fill.addColorStop(1, colors[0]);
  g.fillStyle = fill;
  g.fillText(str, 0, 0);
  g.lineWidth = size * 0.03;
  g.strokeStyle = '#fff';
  g.strokeText(str, -size * 0.02, -size * 0.02);
  g.fillStyle = '#fff';
  for (let i = 0; i < 9; i++) {
    const sx = (random() - 0.5) * w * 0.8;
    const sy = (random() - 0.5) * h * 0.7;
    g.save();
    g.translate(sx, sy);
    g.rotate(random());
    const r = 5 + random() * 9;
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 ? r * 0.3 : r;
      g.lineTo(Math.cos((k / 8) * Math.PI * 2) * rr, Math.sin((k / 8) * Math.PI * 2) * rr);
    }
    g.fill();
    g.restore();
  }
  g.restore();
}

function poster(g, w, h, random, { bg, title, sub, lines = [], art, tabs = false, ink = '#161616', titleFont = BLACK }) {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (art) art(g, w, h);
  const ts = fitText(g, title, `900 $px ${titleFont}`, w * 0.2, w * 0.88);
  centered(g, title, w / 2, h * 0.16, `900 ${ts}px ${titleFont}`, ink);
  if (sub) {
    const ss = fitText(g, sub, `bold $px ${SANS}`, w * 0.09, w * 0.86);
    centered(g, sub, w / 2, h * 0.28, `bold ${ss}px ${SANS}`, ink);
  }
  lines.forEach((l, i) => centered(g, l, w / 2, h * (0.68 + i * 0.07), `${Math.round(w * 0.055)}px ${SANS}`, ink));
  if (tabs) {
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.setLineDash([3, 3]);
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w;
      g.beginPath();
      g.moveTo(x, h * 0.86);
      g.lineTo(x, h);
      g.stroke();
      g.save();
      g.translate(x + w / 16, h * 0.93);
      g.rotate(-Math.PI / 2);
      centered(g, '555-0142', 0, 0, `${Math.round(w * 0.035)}px ${SANS}`, ink);
      g.restore();
    }
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(0, h * 0.86);
    g.lineTo(w, h * 0.86);
    g.stroke();
  }
  weather(g, w, h, random, { scratches: 6, spots: 6, fade: 0.1 });
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (let i = 0; i < 5; i++) {
    const x = random() * w;
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + 6 + random() * 20, h - 6 - random() * 30);
    g.lineTo(x + 20 + random() * 30, h);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

function sticker(g, w, h, kind, random) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.46;
  g.save();
  if (kind === 'gsp') {
    g.fillStyle = '#111';
    g.beginPath();
    g.roundRect(4, h * 0.22, w - 8, h * 0.56, 10);
    g.fill();
    centered(g, 'GSP', cx, cy + 2, `900 ${w * 0.32}px ${FUTURA}`, '#f4f1ea');
    g.fillStyle = '#e8562a';
    g.fillRect(w * 0.12, h * 0.7, w * 0.76, 4);
  } else if (kind === 'labs') {
    g.fillStyle = '#fafafa';
    g.beginPath();
    g.roundRect(4, h * 0.3, w - 8, h * 0.4, 8);
    g.fill();
    centered(g, 'gzowo labs', cx, cy, `500 ${w * 0.15}px ${SANS}`, '#111');
  } else if (kind === 'g') {
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    centered(g, 'g', cx, cy - w * 0.05, `500 ${w * 0.6}px ${SANS}`, '#fff');
  } else if (kind === 'smile') {
    g.fillStyle = '#ffd23a';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#222';
    g.beginPath();
    g.ellipse(cx - r * 0.35, cy - r * 0.2, r * 0.1, r * 0.18, 0, 0, Math.PI * 2);
    g.ellipse(cx + r * 0.35, cy - r * 0.2, r * 0.1, r * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = r * 0.1;
    g.strokeStyle = '#222';
    g.beginPath();
    g.arc(cx, cy + r * 0.05, r * 0.55, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  } else if (kind === 'alien') {
    g.fillStyle = '#6fe06a';
    g.beginPath();
    g.ellipse(cx, cy, r * 0.75, r, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    g.ellipse(cx - r * 0.33, cy, r * 0.25, r * 0.4, 0.5, 0, Math.PI * 2);
    g.ellipse(cx + r * 0.33, cy, r * 0.25, r * 0.4, -0.5, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'hello') {
    g.fillStyle = '#d23a3a';
    g.beginPath();
    g.roundRect(4, 10, w - 8, h - 20, 10);
    g.fill();
    centered(g, 'HELLO', cx, h * 0.24, `900 ${w * 0.17}px ${SANS}`, '#fff');
    centered(g, 'my name is', cx, h * 0.37, `${w * 0.08}px ${SANS}`, '#fff');
    g.fillStyle = '#fff';
    g.fillRect(12, h * 0.45, w - 24, h * 0.38);
    centered(g, 'KOTEK', cx, h * 0.64, `${w * 0.17}px ${MARKER}`, '#1a1a8a');
  } else if (kind === 'cat') {
    g.fillStyle = '#222';
    g.beginPath();
    g.arc(cx, cy + 6, r * 0.75, 0, Math.PI * 2);
    g.moveTo(cx - r * 0.7, cy - r * 0.1);
    g.lineTo(cx - r * 0.55, cy - r * 0.85);
    g.lineTo(cx - r * 0.15, cy - r * 0.55);
    g.moveTo(cx + r * 0.7, cy - r * 0.1);
    g.lineTo(cx + r * 0.55, cy - r * 0.85);
    g.lineTo(cx + r * 0.15, cy - r * 0.55);
    g.fill();
    g.fillStyle = '#ffe14a';
    g.beginPath();
    g.ellipse(cx - r * 0.28, cy, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
    g.ellipse(cx + r * 0.28, cy, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'planet') {
    g.fillStyle = '#7a5cff';
    g.beginPath();
    g.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffb3e6';
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.ellipse(cx, cy, r * 0.95, r * 0.28, -0.35, 0, Math.PI * 2);
    g.stroke();
  } else if (kind === 'bolt') {
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe600';
    g.beginPath();
    g.moveTo(cx + r * 0.1, cy - r * 0.8);
    g.lineTo(cx - r * 0.45, cy + r * 0.1);
    g.lineTo(cx, cy + r * 0.1);
    g.lineTo(cx - r * 0.15, cy + r * 0.8);
    g.lineTo(cx + r * 0.45, cy - r * 0.15);
    g.lineTo(cx, cy - r * 0.15);
    g.fill();
  } else if (kind === 'radio') {
    g.fillStyle = '#ff6b2c';
    g.beginPath();
    g.roundRect(4, h * 0.25, w - 8, h * 0.5, 12);
    g.fill();
    centered(g, 'COSTA FM', cx, cy - h * 0.06, `900 ${w * 0.15}px ${FUTURA}`, '#fff');
    centered(g, '101.2', cx, cy + h * 0.12, `bold ${w * 0.11}px ${SANS}`, '#fff');
  } else if (kind === 'star') {
    g.fillStyle = '#ff4fa3';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? r * 0.45 : r;
      g.lineTo(cx + Math.cos((k / 10) * Math.PI * 2 - Math.PI / 2) * rr, cy + Math.sin((k / 10) * Math.PI * 2 - Math.PI / 2) * rr);
    }
    g.fill();
  } else {
    g.fillStyle = '#25b3c7';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    rocket(g, cx, cy + 4, w / 260, '#fff', '#ff6a3d', false);
  }
  g.restore();
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(255,248,230,${0.08 + random() * 0.2})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const main = canvas.getContext('2d');
  const pack = makePacker();
  const items = {};
  const random = rng(5150);
  const scratch = document.createElement('canvas');
  const sg = scratch.getContext('2d', { willReadFrequently: true });

  const jobs = [];
  function add(name, w, h, draw, { noise = 10 } = {}) {
    items[name] = { uv: [0, 0, 0, 0], aspect: w / h };
    jobs.push({ name, w, h, draw, noise });
    return items[name];
  }
  function flush() {
    jobs.sort((a, b) => b.h - a.h || b.w - a.w);
    for (const { name, w, h, draw, noise } of jobs) {
      const r = pack(w, h);
      scratch.width = w;
      scratch.height = h;
      sg.clearRect(0, 0, w, h);
      sg.save();
      draw(sg, w, h);
      sg.restore();
      if (noise) grain(sg, w, h, noise, random);
      main.drawImage(scratch, r.x, r.y);
      items[name].uv = [r.x / SIZE, 1 - (r.y + h) / SIZE, (r.x + w) / SIZE, 1 - r.y / SIZE];
    }
  }

  const board = (name, text, { bg, fg, font = BLACK, w = 768, h = 144, border = null, sub = null, subFont = SANS, icon = null, rust = false, accent = null }) =>
    add(name, w, h, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      if (accent) {
        g.fillStyle = accent;
        g.fillRect(0, h - h * 0.12, w, h * 0.12);
        g.fillRect(0, 0, w, h * 0.06);
      }
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = h * 0.05;
        g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
      }
      const left = icon ? h * 1.0 : 0;
      if (icon) icon(g, h * 0.55, h / 2, h);
      const ts = fitText(g, text, `900 $px ${font}`, h * (sub ? 0.5 : 0.62), w - left - h * 0.5);
      centered(g, text, left / 2 + w / 2, sub ? h * 0.4 : h * 0.53, `900 ${ts}px ${font}`, fg, 'rgba(0,0,0,0.25)', ts * 0.04);
      if (sub) {
        const ss = fitText(g, sub, `bold $px ${subFont}`, h * 0.2, w - left - h * 0.6);
        centered(g, sub, left / 2 + w / 2, h * 0.77, `bold ${ss}px ${subFont}`, fg);
      }
      weather(g, w, h, random, { rust, fade: 0.1 });
    });

  board('sign_coffee', 'ROCKET FUEL', { bg: '#17494d', fg: '#f6e7c6', sub: 'COFFEE  ·  DONUTS  ·  SINCE 1961', font: FUTURA, icon: (g, x, y, h) => rocket(g, x, y, h / 140, '#f6e7c6', '#ef7b45'), accent: '#ef7b45' });
  board('sign_hotel', 'HOTEL SAWGRASS', { bg: '#f2e6cf', fg: '#7a2f3b', font: SERIF, sub: 'ROOMS  ·  WEEKLY RATES', subFont: SERIF, border: '#7a2f3b' });
  board('sign_hobby', 'GSP HOBBY & ROCKETS', { bg: '#1d2a44', fg: '#ffcf4a', sub: 'MODEL ROCKETS · 3D PRINTING · KITS', icon: (g, x, y, h) => rocket(g, x, y, h / 140, '#ffffff', '#ff5d3a'), accent: '#ff5d3a' });
  board('sign_barber', 'FLAMINGO', { bg: '#f7c9d4', fg: '#22313f', font: SCRIPT, sub: 'BARBER SHOP · WALK-INS', icon: (g, x, y, h) => flamingo(g, x, y + h * 0.05, h / 160), border: '#22313f' });
  board('sign_gas', 'GZOWO GAS & GO', { bg: '#0f5ea8', fg: '#ffffff', sub: 'SNACKS · ICE · BAIT · AIR', accent: '#ffd21f' });
  board('sign_pharmacy', 'SUNNY PHARMACY', { bg: '#ffffff', fg: '#1f7a5a', sub: 'PRESCRIPTIONS · SUNSCREEN · CANDY', accent: '#1f7a5a' });
  board('sign_icecream', 'COSMIC SCOOPS', { bg: '#9fe3e0', fg: '#d63f8c', font: MARKER, sub: '38 FLAVORS · SHAKES · FLOATS', icon: (g, x, y, h) => {
    g.fillStyle = '#e9b36a';
    g.beginPath();
    g.moveTo(x - h * 0.15, y);
    g.lineTo(x, y + h * 0.38);
    g.lineTo(x + h * 0.15, y);
    g.fill();
    for (const [dx, dy, c] of [[-0.08, -0.04, '#ff8fc1'], [0.08, -0.04, '#fff3c4'], [0, -0.18, '#8fd1ff']]) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x + dx * h, y + dy * h, h * 0.12, 0, Math.PI * 2);
      g.fill();
    }
  } });
  board('sign_records', 'SECOND SPIN', { bg: '#20201f', fg: '#f2b134', font: FUTURA, sub: 'RECORDS · TAPES · STEREOS', icon: (g, x, y, h) => {
    g.fillStyle = '#0b0b0b';
    g.beginPath();
    g.arc(x, y, h * 0.36, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#333';
    for (let k = 1; k < 6; k++) {
      g.beginPath();
      g.arc(x, y, h * 0.06 * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#e0483a';
    g.beginPath();
    g.arc(x, y, h * 0.1, 0, Math.PI * 2);
    g.fill();
  } });
  board('sign_laundry', 'LUCKY PALM LAUNDROMAT', { bg: '#e8f4fb', fg: '#1764a8', sub: 'OPEN 24 HOURS · WASH & FOLD · FREE WIFI', accent: '#58c3e8' });
  board('sign_hardware', 'SAWGRASS HARDWARE', { bg: '#b8322c', fg: '#ffffff', sub: 'PAINT · TOOLS · KEYS CUT · FISHING', font: SLAB, rust: true });
  board('sign_pierogi', "MAMA BASIA'S", { bg: '#fbf1df', fg: '#b2232f', font: SCRIPT, sub: 'PIEROGI · ŻUREK · KOMPOT', border: '#b2232f' });
  board('sign_hangar', 'GSP AEROSPACE · HANGAR 2', { bg: '#e6e4dd', fg: '#1a1a1a', font: FUTURA, sub: 'AUTHORIZED PERSONNEL ONLY · NO SMOKING', w: 896, h: 128, rust: true });
  board('sign_post', 'UNITED STATES POST OFFICE', { bg: 'rgba(0,0,0,0)', fg: '#2a2a2a', font: SERIF, sub: 'GZOWO SPRINGS, FLORIDA 33612', subFont: SERIF, h: 120 });
  board('sign_motel', 'PALM MOTEL', { bg: '#ffffff', fg: '#0f8a85', font: SCRIPT, sub: 'POOL · COLOR TV · AIR CONDITIONED', border: '#f28a3c' });
  board('sign_main', 'MAIN ST', { bg: '#1f6b3b', fg: '#ffffff', w: 512, h: 112, font: SANS, border: '#ffffff' });
  board('sign_palm', 'PALM AVE', { bg: '#1f6b3b', fg: '#ffffff', w: 512, h: 112, font: SANS, border: '#ffffff' });
  board('sign_rocket', 'ROCKET ST', { bg: '#1f6b3b', fg: '#ffffff', w: 512, h: 112, font: SANS, border: '#ffffff' });

  add('neon_arcade', 1024, 300, (g, w, h) => {
    neon(g, 'PIXEL PALACE', w / 2, h * 0.4, `900 ${h * 0.36}px ${FUTURA}`, '#ff3fd2', 9);
    neon(g, 'ARCADE · PINBALL · PRIZES', w / 2, h * 0.8, `bold ${h * 0.14}px ${SANS}`, '#3ff2ff', 5);
  }, { noise: 0 });
  add('neon_diner', 1024, 260, (g, w, h) => {
    neon(g, 'Narew Diner', w / 2, h * 0.45, `bold ${h * 0.5}px ${SCRIPT}`, '#ff4a3d', 10);
    neon(g, 'OPEN 24 HRS', w / 2, h * 0.86, `bold ${h * 0.15}px ${SANS}`, '#64f0ff', 5);
  }, { noise: 0 });
  add('neon_open', 384, 160, (g, w, h) => {
    g.strokeStyle = '#2f7bff';
    g.lineWidth = 6;
    g.shadowColor = '#2f7bff';
    g.shadowBlur = 16;
    g.beginPath();
    g.roundRect(12, 12, w - 24, h - 24, 30);
    g.stroke();
    g.shadowBlur = 0;
    neon(g, 'OPEN', w / 2, h / 2 + 4, `900 ${h * 0.52}px ${SANS}`, '#ff3048', 8);
  }, { noise: 0 });
  add('neon_vacancy', 512, 128, (g, w, h) => neon(g, 'VACANCY', w / 2, h / 2, `bold ${h * 0.6}px ${SANS}`, '#ff6a2a', 7), { noise: 0 });
  add('neon_coffee', 384, 256, (g, w, h) => {
    neon(g, 'HOT', w / 2, h * 0.28, `bold ${h * 0.24}px ${SANS}`, '#ffb13b', 6);
    neon(g, 'COFFEE', w / 2, h * 0.62, `900 ${h * 0.28}px ${FUTURA}`, '#ff5b2e', 7);
  }, { noise: 0 });
  add('neon_scoops', 384, 256, (g, w, h) => {
    neon(g, 'ICE', w / 2, h * 0.3, `bold ${h * 0.26}px ${MARKER}`, '#7dfcff', 6);
    neon(g, 'CREAM', w / 2, h * 0.68, `bold ${h * 0.28}px ${MARKER}`, '#ff6fd8', 7);
  }, { noise: 0 });
  add('neon_beer', 384, 256, (g, w, h) => {
    neon(g, 'COLD', w / 2, h * 0.3, `bold ${h * 0.26}px ${SANS}`, '#4dff9a', 6);
    neon(g, 'SODA', w / 2, h * 0.68, `900 ${h * 0.3}px ${SANS}`, '#ffd23a', 7);
  }, { noise: 0 });
  add('neon_rocket', 256, 384, (g, w, h) => {
    g.save();
    g.lineJoin = 'round';
    g.shadowColor = '#ff7b2a';
    g.shadowBlur = 18;
    g.strokeStyle = '#ff7b2a';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(w / 2, 30);
    g.bezierCurveTo(w * 0.78, 90, w * 0.74, 230, w * 0.68, 290);
    g.lineTo(w * 0.32, 290);
    g.bezierCurveTo(w * 0.26, 230, w * 0.22, 90, w / 2, 30);
    g.stroke();
    g.strokeStyle = '#ffe14a';
    g.beginPath();
    g.moveTo(w * 0.4, 300);
    g.quadraticCurveTo(w / 2, 380, w * 0.6, 300);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = '#fff';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(w / 2, 150, 22, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }, { noise: 0 });
  add('neon_hotel', 192, 768, (g, w, h) => {
    g.fillStyle = '#26323d';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2e6cf';
    g.lineWidth = 5;
    g.strokeRect(8, 8, w - 16, h - 16);
    const letters = 'HOTEL';
    for (let i = 0; i < letters.length; i++) neon(g, letters[i], w / 2, h * (0.12 + i * 0.19), `900 ${h * 0.16}px ${SERIF}`, '#ffcf6a', 7);
  }, { noise: 6 });

  add('gas_price', 512, 640, (g, w, h) => {
    g.fillStyle = '#0f5ea8';
    g.fillRect(0, 0, w, h);
    centered(g, 'GZOWO', w / 2, 60, `900 64px ${BLACK}`, '#fff');
    centered(g, 'GAS & GO', w / 2, 120, `900 44px ${BLACK}`, '#ffd21f');
    const rows = [['REGULAR', '3.19'], ['PLUS', '3.39'], ['PREMIUM', '3.59'], ['DIESEL', '3.49']];
    rows.forEach(([n, p], i) => {
      const y = 200 + i * 105;
      g.fillStyle = '#fff';
      g.fillRect(24, y, w - 48, 88);
      centered(g, n, 130, y + 44, `bold 32px ${SANS}`, '#0f5ea8');
      g.fillStyle = '#111';
      g.fillRect(250, y + 8, 236, 72);
      centered(g, p, 368, y + 46, `bold 58px "Courier New", monospace`, '#ff9d2e');
    });
    weather(g, w, h, random, { fade: 0.08 });
  });

  add('welcome', 896, 448, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#ff9a5a');
    sky.addColorStop(0.55, '#ffd27a');
    sky.addColorStop(1, '#5bc0be');
    g.fillStyle = sky;
    g.beginPath();
    g.roundRect(0, 0, w, h, 40);
    g.fill();
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.arc(w * 0.72, h * 0.62, h * 0.3, Math.PI, 0);
    g.fill();
    g.fillStyle = '#1f4d4a';
    g.fillRect(0, h * 0.62, w, h * 0.38);
    palm(g, w * 0.1, h * 0.95, h * 0.62, '#1c2b2a', 0.2);
    palm(g, w * 0.9, h * 0.95, h * 0.55, '#1c2b2a', -0.25);
    centered(g, 'Welcome to', w / 2, h * 0.2, `bold ${h * 0.14}px ${SCRIPT}`, '#ffffff', '#7a2b16', 8);
    centered(g, 'GZOWO SPRINGS', w / 2, h * 0.43, `900 ${h * 0.19}px ${BLACK}`, '#ffffff', '#7a2b16', 14);
    centered(g, 'EST. 1926  ·  HOME OF THE ROCKET', w / 2, h * 0.78, `bold ${h * 0.065}px ${SANS}`, '#ffe9a8');
    centered(g, 'POP. 2,412', w / 2, h * 0.88, `bold ${h * 0.06}px ${SANS}`, '#ffe9a8');
    weather(g, w, h, random, { fade: 0.06, spots: 10 });
  });

  add('billboard', 896, 336, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#13132f');
    sky.addColorStop(1, '#3a1f5c');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let i = 0; i < 80; i++) g.fillRect(random() * w, random() * h, 2, 2);
    g.fillStyle = '#d8d6cf';
    g.beginPath();
    g.arc(w * 0.85, h * 0.3, h * 0.22, 0, Math.PI * 2);
    g.fill();
    rocket(g, w * 0.16, h * 0.55, h / 160, '#ffffff', '#ff5d3a');
    centered(g, 'NEXT STOP: THE MOON', w * 0.56, h * 0.36, `900 ${h * 0.15}px ${FUTURA}`, '#ffffff');
    centered(g, 'GSP AEROSPACE · BUILT IN GZOWO', w * 0.56, h * 0.62, `bold ${h * 0.07}px ${SANS}`, '#ffcf4a');
    centered(g, 'NOW HIRING ROCKET NERDS', w * 0.56, h * 0.8, `bold ${h * 0.06}px ${SANS}`, '#9fe3e0');
    weather(g, w, h, random, { fade: 0.05, spots: 8 });
  });
  add('billboard_radio', 896, 336, (g, w, h) => {
    g.fillStyle = '#ff6b2c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd23a';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(w * 0.18, h * 0.5);
      g.arc(w * 0.18, h * 0.5, h, (i / 12) * Math.PI * 2, ((i + 0.5) / 12) * Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(w * 0.18, h * 0.5, h * 0.3, 0, Math.PI * 2);
    g.fill();
    centered(g, '101.2', w * 0.18, h * 0.52, `900 ${h * 0.13}px ${FUTURA}`, '#fff');
    centered(g, 'COSTA FM', w * 0.63, h * 0.38, `900 ${h * 0.24}px ${BLACK}`, '#ffffff', '#111', 10);
    centered(g, 'THE GOLDEN HOUR HITS', w * 0.63, h * 0.68, `bold ${h * 0.08}px ${SANS}`, '#111');
    weather(g, w, h, random, { fade: 0.08 });
  });

  add('ghost_cola', 768, 384, (g, w, h) => {
    g.fillStyle = 'rgba(240,232,210,0.55)';
    g.fillRect(20, 20, w - 40, h - 40);
    centered(g, 'DRINK', w / 2, h * 0.2, `900 ${h * 0.13}px ${SLAB}`, 'rgba(160,40,40,0.75)');
    centered(g, 'NAREW COLA', w / 2, h * 0.46, `900 ${h * 0.22}px ${SLAB}`, 'rgba(160,40,40,0.8)');
    centered(g, 'ICE COLD · 5¢', w / 2, h * 0.72, `bold ${h * 0.1}px ${SLAB}`, 'rgba(40,60,90,0.7)');
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(0,0,0,${0.2 + random() * 0.6})`;
      g.fillRect(random() * w, random() * h, 3 + random() * 30, 2 + random() * 9);
    }
    g.globalCompositeOperation = 'source-over';
  }, { noise: 0 });

  add('mural_postcard', 1536, 576, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2bb5c9');
    sky.addColorStop(0.5, '#ffd36b');
    sky.addColorStop(1, '#ff7a59');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(random() * w, h * (0.08 + random() * 0.2), 60 + random() * 90, 18 + random() * 12, 0, 0, Math.PI * 2);
      g.fill();
    }
    centered(g, 'Greetings from', w * 0.5, h * 0.13, `bold ${h * 0.1}px ${SCRIPT}`, '#ffffff', '#2a1b5c', 10);
    const word = 'GZOWO';
    g.font = `900 ${h * 0.5}px ${BLACK}`;
    const total = g.measureText(word).width;
    let x = w / 2 - total / 2;
    const fills = ['#ff5d8f', '#ffcf3a', '#3ad1c2', '#7b6cff', '#ff8a3d'];
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const cw = g.measureText(ch).width;
      g.save();
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (let k = 18; k > 0; k--) {
        g.fillStyle = '#2a1b5c';
        g.fillText(ch, x + k * 1.5, h * 0.5 + k * 1.5);
      }
      g.lineWidth = 12;
      g.strokeStyle = '#ffffff';
      g.strokeText(ch, x, h * 0.5);
      g.fillStyle = fills[i];
      g.fillText(ch, x, h * 0.5);
      g.beginPath();
      g.rect(x, h * 0.25, cw, h * 0.5);
      g.clip();
      if (i === 0) palm(g, x + cw * 0.5, h * 0.75, h * 0.4, 'rgba(20,40,40,0.55)', 0.15);
      if (i === 1) rocket(g, x + cw * 0.5, h * 0.5, h / 500);
      if (i === 2) flamingo(g, x + cw * 0.5, h * 0.48, h / 260);
      if (i === 3) gator(g, x + cw * 0.5, h * 0.55, h / 500);
      if (i === 4) {
        g.fillStyle = 'rgba(255,240,180,0.8)';
        g.beginPath();
        g.arc(x + cw * 0.5, h * 0.62, h * 0.12, Math.PI, 0);
        g.fill();
      }
      g.restore();
      x += cw;
    }
    centered(g, 'SPRINGS · FLORIDA', w * 0.5, h * 0.86, `900 ${h * 0.08}px ${FUTURA}`, '#ffffff', '#2a1b5c', 8);
    weather(g, w, h, random, { fade: 0.08, spots: 30, scratches: 40 });
  });

  add('mural_launch', 1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#311b5e');
    sky.addColorStop(0.45, '#e0457b');
    sky.addColorStop(0.75, '#ffb347');
    sky.addColorStop(1, '#ffe08a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,240,200,0.9)';
    g.beginPath();
    g.arc(w * 0.3, h * 0.78, h * 0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f7f0e6';
    g.beginPath();
    g.moveTo(w * 0.62, h * 0.95);
    g.bezierCurveTo(w * 0.5, h * 0.7, w * 0.7, h * 0.5, w * 0.64, h * 0.25);
    g.lineTo(w * 0.68, h * 0.25);
    g.bezierCurveTo(w * 0.76, h * 0.55, w * 0.62, h * 0.7, w * 0.74, h * 0.95);
    g.fill();
    rocket(g, w * 0.66, h * 0.17, h / 330);
    g.fillStyle = '#1b1430';
    g.fillRect(0, h * 0.9, w, h * 0.1);
    for (let i = 0; i < 7; i++) palm(g, w * (0.04 + i * 0.15 + random() * 0.04), h * 0.95, h * (0.3 + random() * 0.25), '#1b1430', (random() - 0.5) * 0.4);
    g.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) g.fillRect(random() * w, random() * h * 0.35, 2, 2);
    centered(g, 'REACH FOR IT', w * 0.27, h * 0.22, `900 ${h * 0.1}px ${FUTURA}`, '#ffe08a', '#311b5e', 8);
    weather(g, w, h, random, { fade: 0.06, spots: 24, scratches: 30 });
  });

  add('mural_keys', 1024, 352, (g, w, h) => {
    g.fillStyle = '#1e2b4a';
    g.fillRect(0, 0, w, h);
    const keys = 22;
    for (let i = 0; i < keys; i++) {
      const x = (i / keys) * w;
      const y = h * 0.42 + Math.sin(i * 0.55) * h * 0.18;
      g.fillStyle = '#f4efe4';
      g.fillRect(x + 3, y, w / keys - 6, h * 0.45);
      if ([0, 1, 3, 4, 5].includes(i % 7)) {
        g.fillStyle = '#111';
        g.fillRect(x + w / keys * 0.62, y, w / keys * 0.7, h * 0.27);
      }
    }
    g.fillStyle = '#ffcf4a';
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + i * 0.1);
      const y = h * (0.12 + 0.12 * Math.sin(i));
      g.beginPath();
      g.ellipse(x, y + 26, 13, 10, -0.4, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x + 10, y - 20, 4, 46);
    }
    centered(g, 'MUSIC LIVES HERE', w * 0.5, h * 0.92, `900 ${h * 0.1}px ${FUTURA}`, '#ffcf4a');
    weather(g, w, h, random, { fade: 0.06, spots: 18 });
  });

  add('mural_sea', 1024, 448, (g, w, h) => {
    const sea = g.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, '#8be0e6');
    sea.addColorStop(1, '#1a6c9a');
    g.fillStyle = sea;
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = `rgba(255,255,255,${0.25 + k * 0.08})`;
      g.lineWidth = 8;
      g.beginPath();
      for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.2 + k * 0.13) + Math.sin(x * 0.012 + k) * 14);
      g.stroke();
    }
    gator(g, w * 0.3, h * 0.62, h / 170);
    flamingo(g, w * 0.72, h * 0.5, h / 150);
    flamingo(g, w * 0.84, h * 0.56, h / 190);
    g.fillStyle = '#ff8a3d';
    for (let i = 0; i < 6; i++) {
      const x = w * (0.1 + random() * 0.8);
      const y = h * (0.75 + random() * 0.2);
      g.beginPath();
      g.ellipse(x, y, 26, 12, 0, 0, Math.PI * 2);
      g.moveTo(x + 22, y);
      g.lineTo(x + 40, y - 12);
      g.lineTo(x + 40, y + 12);
      g.fill();
    }
    centered(g, 'SAVE THE SAWGRASS', w * 0.5, h * 0.12, `900 ${h * 0.09}px ${BLACK}`, '#ffffff', '#1a6c9a', 8);
    weather(g, w, h, random, { fade: 0.07, spots: 20 });
  });

  [
    ['piece_gzowo', 'GZOWO', ['#ffef5a', '#ff5d2a', '#2a1b5c', '#5ad6ff', '#2a8cff']],
    ['piece_rakieta', 'RAKIETA', ['#7dff8f', '#1fb36a', '#1a1a3a', '#ff7ad1', '#a64dff']],
    ['piece_costa', 'COSTA', ['#ffffff', '#5ae0ff', '#28104a', '#ffb347', '#ff4a7a']],
  ].forEach(([name, word, colors]) => add(name, 1024, 384, (g, w, h) => piece(g, w, h, word, colors, random)));

  [['tag_jrk', 'JRK', '#151515'], ['tag_zow', 'Zow!', '#1b3cff'], ['tag_narew', 'NAREW', '#d01f6a'], ['tag_kotek', 'kotek', '#111'], ['tag_okay', 'OKAY', '#2a8a2a'], ['tag_springz', 'Springz', '#7b2fd0'], ['tag_gdev', 'G-DEV', '#e05a00'], ['tag_bop', 'b0p', '#0a0a0a']].forEach(([name, s, c]) =>
    add(name, 512, 192, (g, w, h) => tag(g, w, h, s, c, random), { noise: 0 }),
  );
  [['throw_gzw', 'GZW', '#f4f1ea', '#141414'], ['throw_oho', 'OHO', '#ff9be0', '#1b1b6a'], ['throw_yes', 'YES', '#ffe14a', '#151515'], ['throw_kot', 'KOT', '#8fe9ff', '#0a2a4a']].forEach(([name, s, f, o]) =>
    add(name, 512, 256, (g, w, h) => throwie(g, w, h, s, f, o, random), { noise: 0 }),
  );

  const posters = [
    ['poster_band', { bg: '#ffcf3a', title: 'THE GATORS', sub: 'LIVE AT THE NAREW DINER', lines: ['SAT · 8 PM', 'ALL AGES'], art: (g, w, h) => gator(g, w / 2, h * 0.48, w / 260) }],
    ['poster_cat', { bg: '#f7f4ec', title: 'LOST CAT', sub: 'ANSWERS TO "KOTEK"', lines: ['BLACK · YELLOW EYES', 'VERY FLUFFY'], tabs: true, art: (g, w, h) => {
      g.fillStyle = '#222';
      g.beginPath();
      g.arc(w / 2, h * 0.5, w * 0.17, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.36, h * 0.44);
      g.lineTo(w * 0.38, h * 0.33);
      g.lineTo(w * 0.46, h * 0.39);
      g.moveTo(w * 0.64, h * 0.44);
      g.lineTo(w * 0.62, h * 0.33);
      g.lineTo(w * 0.54, h * 0.39);
      g.fill();
      g.fillStyle = '#ffe14a';
      g.beginPath();
      g.arc(w * 0.44, h * 0.49, w * 0.03, 0, Math.PI * 2);
      g.arc(w * 0.56, h * 0.49, w * 0.03, 0, Math.PI * 2);
      g.fill();
    } }],
    ['poster_launch', { bg: '#1d2a44', ink: '#ffcf4a', title: 'LAUNCH DAY', sub: 'GSP MODEL ROCKET CLUB', lines: ['SATURDAY 10 AM', 'GZOWO FIELD'], art: (g, w, h) => rocket(g, w / 2, h * 0.47, w / 220) }],
    ['poster_piano', { bg: '#efe6d6', title: 'PIANO LESSONS', sub: 'BEGINNERS WELCOME', lines: ['ASK AT SECOND SPIN'], tabs: true, art: (g, w, h) => {
      for (let i = 0; i < 9; i++) {
        g.fillStyle = '#fff';
        g.fillRect(w * 0.12 + i * w * 0.085, h * 0.36, w * 0.078, h * 0.24);
        g.strokeStyle = '#222';
        g.strokeRect(w * 0.12 + i * w * 0.085, h * 0.36, w * 0.078, h * 0.24);
        if (i % 7 !== 2 && i % 7 !== 6 && i < 8) {
          g.fillStyle = '#111';
          g.fillRect(w * 0.12 + i * w * 0.085 + w * 0.055, h * 0.36, w * 0.05, h * 0.14);
        }
      }
    } }],
    ['poster_print', { bg: '#3ad1c2', title: '3D PRINTING', sub: 'PARTS · TOYS · ROCKET FINS', lines: ['AT GSP HOBBY'], art: (g, w, h) => {
      g.fillStyle = '#1a1a1a';
      g.fillRect(w * 0.3, h * 0.36, w * 0.4, h * 0.04);
      g.fillRect(w * 0.3, h * 0.36, w * 0.03, h * 0.26);
      g.fillRect(w * 0.67, h * 0.36, w * 0.03, h * 0.26);
      g.fillStyle = '#ff7a3d';
      g.fillRect(w * 0.42, h * 0.5, w * 0.16, h * 0.1);
    } }],
    ['poster_yard', { bg: '#ff8fb1', title: 'YARD SALE', sub: 'EVERYTHING MUST GO', lines: ['412 PALM AVE', 'SUNDAY'], tabs: true }],
    ['poster_fest', { bg: '#7b6cff', ink: '#fff7e0', title: 'SUMMER FEST', sub: 'GZOWO SPRINGS', lines: ['FOOD · MUSIC · FIREWORKS', 'ROCKET PARK'], art: (g, w, h) => {
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = ['#ffcf3a', '#ff5d8f', '#3ad1c2', '#fff', '#ff8a3d'][i];
        g.lineWidth = 3;
        const x = w * (0.2 + i * 0.15);
        const y = h * (0.42 + (i % 2) * 0.08);
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * w * 0.07, y + Math.sin(a) * w * 0.07);
          g.stroke();
        }
      }
    } }],
    ['poster_help', { bg: '#ffffff', title: 'HELP WANTED', sub: 'SCOOPER · FRIENDLY', lines: ['APPLY INSIDE'] }],
  ];
  for (const [name, opts] of posters) add(name, 320, 448, (g, w, h) => poster(g, w, h, random, opts));

  ['gsp', 'labs', 'g', 'smile', 'alien', 'hello', 'cat', 'planet', 'bolt', 'radio', 'star', 'rocket'].forEach((k) => add('sticker_' + k, 160, 160, (g, w, h) => sticker(g, w, h, k, random), { noise: 6 }));

  const signPlate = (name, w, h, draw) => add(name, w, h, (g) => {
    draw(g, w, h);
    weather(g, w, h, random, { fade: 0.05, spots: 6, scratches: 10 });
  });
  signPlate('stop', 256, 256, (g, w, h) => {
    g.fillStyle = '#f4f4f0';
    g.beginPath();
    for (let k = 0; k < 8; k++) g.lineTo(w / 2 + Math.cos((k / 8) * Math.PI * 2 + Math.PI / 8) * w * 0.49, h / 2 + Math.sin((k / 8) * Math.PI * 2 + Math.PI / 8) * h * 0.49);
    g.fill();
    g.fillStyle = '#c2201e';
    g.beginPath();
    for (let k = 0; k < 8; k++) g.lineTo(w / 2 + Math.cos((k / 8) * Math.PI * 2 + Math.PI / 8) * w * 0.45, h / 2 + Math.sin((k / 8) * Math.PI * 2 + Math.PI / 8) * h * 0.45);
    g.fill();
    centered(g, 'STOP', w / 2, h / 2 + 4, `bold ${w * 0.27}px ${SANS}`, '#fff');
  });
  signPlate('speed25', 192, 256, (g, w, h) => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111';
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    centered(g, 'SPEED', w / 2, h * 0.17, `bold ${w * 0.2}px ${SANS}`, '#111');
    centered(g, 'LIMIT', w / 2, h * 0.32, `bold ${w * 0.2}px ${SANS}`, '#111');
    centered(g, '25', w / 2, h * 0.66, `bold ${w * 0.5}px ${SANS}`, '#111');
  });
  signPlate('noparking', 192, 256, (g, w, h) => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(0, 0, w, h);
    centered(g, 'NO', w / 2, h * 0.14, `bold ${w * 0.2}px ${SANS}`, '#b8201e');
    centered(g, 'PARKING', w / 2, h * 0.28, `bold ${w * 0.17}px ${SANS}`, '#b8201e');
    centered(g, 'P', w / 2, h * 0.6, `bold ${w * 0.4}px ${SANS}`, '#111');
    g.strokeStyle = '#b8201e';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(w / 2, h * 0.6, w * 0.3, 0, Math.PI * 2);
    g.moveTo(w * 0.3, h * 0.45);
    g.lineTo(w * 0.7, h * 0.75);
    g.stroke();
    centered(g, '8AM-6PM', w / 2, h * 0.9, `bold ${w * 0.13}px ${SANS}`, '#111');
  });
  signPlate('oneway', 384, 128, (g, w, h) => {
    g.fillStyle = '#111';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(16, h * 0.32);
    g.lineTo(w * 0.72, h * 0.32);
    g.lineTo(w * 0.72, h * 0.14);
    g.lineTo(w - 14, h / 2);
    g.lineTo(w * 0.72, h * 0.86);
    g.lineTo(w * 0.72, h * 0.68);
    g.lineTo(16, h * 0.68);
    g.fill();
    centered(g, 'ONE WAY', w * 0.4, h / 2 + 2, `bold ${h * 0.28}px ${SANS}`, '#111');
  });
  signPlate('deadend', 256, 256, (g, w, h) => {
    g.fillStyle = '#ffd21f';
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.lineTo(w - 4, h / 2);
    g.lineTo(w / 2, h - 4);
    g.lineTo(4, h / 2);
    g.fill();
    centered(g, 'DEAD', w / 2, h * 0.42, `bold ${w * 0.17}px ${SANS}`, '#111');
    centered(g, 'END', w / 2, h * 0.6, `bold ${w * 0.17}px ${SANS}`, '#111');
  });
  signPlate('parking', 192, 256, (g, w, h) => {
    g.fillStyle = '#1a55b8';
    g.fillRect(0, 0, w, h);
    centered(g, 'P', w / 2, h * 0.42, `bold ${w * 0.7}px ${SANS}`, '#fff');
    centered(g, 'PUBLIC', w / 2, h * 0.82, `bold ${w * 0.18}px ${SANS}`, '#fff');
  });
  signPlate('busstop', 192, 256, (g, w, h) => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f6b3b';
    g.fillRect(0, 0, w, h * 0.3);
    centered(g, 'BUS', w / 2, h * 0.15, `bold ${w * 0.25}px ${SANS}`, '#fff');
    g.fillStyle = '#1f6b3b';
    g.beginPath();
    g.roundRect(w * 0.2, h * 0.4, w * 0.6, h * 0.35, 12);
    g.fill();
    g.fillStyle = '#f4f4f0';
    g.fillRect(w * 0.27, h * 0.46, w * 0.46, h * 0.12);
    centered(g, 'ROUTE 7 · COSTA', w / 2, h * 0.88, `bold ${w * 0.1}px ${SANS}`, '#111');
  });
  signPlate('xing', 256, 256, (g, w, h) => {
    g.fillStyle = '#c8e620';
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.lineTo(w - 4, h / 2);
    g.lineTo(w / 2, h - 4);
    g.lineTo(4, h / 2);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(w * 0.5, h * 0.3, w * 0.05, 0, Math.PI * 2);
    g.fill();
    g.fillRect(w * 0.46, h * 0.36, w * 0.08, h * 0.2);
    g.save();
    g.lineWidth = w * 0.05;
    g.strokeStyle = '#111';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.55);
    g.lineTo(w * 0.4, h * 0.72);
    g.moveTo(w * 0.5, h * 0.55);
    g.lineTo(w * 0.6, h * 0.72);
    g.moveTo(w * 0.5, h * 0.4);
    g.lineTo(w * 0.38, h * 0.5);
    g.moveTo(w * 0.5, h * 0.4);
    g.lineTo(w * 0.62, h * 0.5);
    g.stroke();
    g.restore();
  });

  add('menu_board', 256, 384, (g, w, h) => {
    g.fillStyle = '#1e2420';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a3a';
    g.lineWidth = 12;
    g.strokeRect(6, 6, w - 12, h - 12);
    centered(g, 'TODAY', w / 2, 48, `bold 36px ${HAND}`, '#ffffff');
    ['Iced latte 3.5', 'Rocket donut 2', 'Lemonade 2.5', 'Key lime pie 4', 'Pierogi x6 7'].forEach((s, i) => centered(g, s, w / 2, 110 + i * 48, `24px ${HAND}`, ['#ffd87a', '#ffffff', '#9be3ff', '#c7ff9b', '#ffb3c7'][i]));
  });
  add('door_hours', 192, 256, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0)';
    centered(g, 'HOURS', w / 2, 30, `bold 26px ${SANS}`, '#f4f1e6');
    ['MON-FRI 7-7', 'SAT 8-6', 'SUN 9-3'].forEach((s, i) => centered(g, s, w / 2, 80 + i * 34, `20px ${SANS}`, '#f4f1e6'));
    centered(g, 'NO SHIRT · NO SHOES', w / 2, 210, `bold 14px ${SANS}`, '#ffd87a');
  }, { noise: 0 });
  add('gold_letters', 1024, 160, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#fff1b0');
    grd.addColorStop(0.5, '#d6a23a');
    grd.addColorStop(1, '#8a5a12');
    centered(g, 'Est. 1951 · Fine Haircuts', w / 2, h / 2, `italic bold ${h * 0.42}px ${SERIF}`, grd, '#2a1a08', 4);
  }, { noise: 0 });
  add('window_sale', 512, 256, (g, w, h) => {
    centered(g, 'SALE', w / 2, h * 0.4, `900 ${h * 0.5}px ${BLACK}`, '#ff3048', '#fff', 10);
    centered(g, 'EVERYTHING 20% OFF', w / 2, h * 0.82, `bold ${h * 0.12}px ${SANS}`, '#ffffff');
  }, { noise: 0 });
  add('window_wifi', 384, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 14);
    g.fill();
    centered(g, 'FREE WIFI · A/C INSIDE', w / 2, h / 2, `bold ${h * 0.24}px ${SANS}`, '#1764a8');
  }, { noise: 0 });
  add('for_rent', 384, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d12b2b';
    g.fillRect(0, 0, w, h * 0.38);
    centered(g, 'FOR RENT', w / 2, h * 0.2, `900 ${h * 0.24}px ${BLACK}`, '#fff');
    centered(g, 'CALL 555-0199', w / 2, h * 0.66, `bold ${h * 0.14}px ${SANS}`, '#111');
  });
  ['12', '14', '18', '20', '27', '31', '45', '412'].forEach((n) => add('num_' + n, 160, 96, (g, w, h) => {
    centered(g, n, w / 2, h / 2, `bold ${h * 0.72}px ${SERIF}`, '#1b1b1b');
  }, { noise: 0 }));
  add('arrow_motel', 512, 160, (g, w, h) => {
    g.shadowColor = '#ffe14a';
    g.shadowBlur = 14;
    g.fillStyle = '#ffe14a';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(30 + i * 48, h / 2, 9, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(w - 70, h * 0.18);
    g.lineTo(w - 10, h / 2);
    g.lineTo(w - 70, h * 0.82);
    g.fill();
  }, { noise: 0 });

  const stain = (name, w, h, draw) => add(name, w, h, draw, { noise: 0 });
  const paintLine = (name, color) => add(name, 48, 768, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(6, 0, w - 12, h);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${0.3 + random() * 0.7})`;
      g.fillRect(random() * w, random() * h, 1 + random() * 6, 1 + random() * 10);
    }
    g.globalCompositeOperation = 'source-over';
  }, { noise: 0 });
  paintLine('line_white', 'rgba(232,230,222,0.92)');
  paintLine('line_yellow', 'rgba(214,160,30,0.92)');
  stain('rust_drip', 128, 512, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = w * 0.2 + random() * w * 0.6;
      const len = h * (0.3 + random() * 0.7);
      const grd = g.createLinearGradient(0, 0, 0, len);
      grd.addColorStop(0, 'rgba(105,52,22,0.75)');
      grd.addColorStop(1, 'rgba(105,52,22,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 2 + random() * 7, len);
    }
  });
  stain('water_stain', 512, 512, (g, w, h) => {
    for (let i = 0; i < 40; i++) {
      const x = w * (0.2 + random() * 0.6);
      const y = h * (0.05 + random() * 0.4);
      const len = h * (0.2 + random() * 0.6);
      const grd = g.createLinearGradient(0, y, 0, y + len);
      grd.addColorStop(0, 'rgba(40,34,26,0.22)');
      grd.addColorStop(1, 'rgba(40,34,26,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, 6 + random() * 26, len);
    }
  });
  stain('grime', 512, 256, (g, w, h) => {
    for (let i = 0; i < 60; i++) {
      const r = 10 + random() * 50;
      const x = random() * w;
      const y = h * 0.4 + random() * h * 0.6;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(30,26,20,0.25)');
      grd.addColorStop(1, 'rgba(30,26,20,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  stain('oil', 256, 256, (g, w, h) => {
    for (let i = 0; i < 12; i++) {
      const r = 20 + random() * 70;
      const x = w / 2 + (random() - 0.5) * w * 0.4;
      const y = h / 2 + (random() - 0.5) * h * 0.4;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(12,10,8,0.5)');
      grd.addColorStop(0.7, 'rgba(12,10,8,0.25)');
      grd.addColorStop(1, 'rgba(12,10,8,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
  });
  stain('gum', 256, 256, (g, w, h) => {
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${30 + random() * 30},${30 + random() * 20},${25},${0.4 + random() * 0.4})`;
      g.beginPath();
      g.ellipse(random() * w, random() * h, 2 + random() * 5, 2 + random() * 4, random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  stain('crack', 512, 128, (g, w, h) => {
    g.strokeStyle = 'rgba(25,22,18,0.6)';
    g.lineWidth = 2;
    let x = 0;
    let y = h / 2;
    g.beginPath();
    g.moveTo(x, y);
    while (x < w) {
      x += 8 + random() * 20;
      y = Math.max(8, Math.min(h - 8, y + (random() - 0.5) * 26));
      g.lineTo(x, y);
      if (random() < 0.2) {
        g.moveTo(x, y);
        g.lineTo(x + 20 + random() * 30, y + (random() - 0.5) * 50);
        g.moveTo(x, y);
      }
    }
    g.stroke();
  });
  stain('manhole', 256, 256, (g, w, h) => {
    g.fillStyle = '#2b2a28';
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#4a4844';
    g.lineWidth = 6;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(w / 2, h / 2, w * (0.12 + k * 0.09), 0, Math.PI * 2);
      g.stroke();
    }
    centered(g, 'GZOWO SPRINGS', w / 2, h / 2, `bold 18px ${SANS}`, '#55524c');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(120,70,30,0.25)';
    g.fillRect(0, 0, w, h);
  });
  add('cola_machine', 256, 512, (g, w, h) => {
    g.fillStyle = '#c82a2a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.fillRect(w * 0.08, h * 0.08, w * 0.56, h * 0.62);
    g.fillStyle = '#c82a2a';
    g.save();
    g.translate(w * 0.36, h * 0.39);
    g.rotate(-Math.PI / 2);
    centered(g, 'NAREW COLA', 0, 0, `900 ${w * 0.2}px ${SLAB}`, '#c82a2a');
    g.restore();
    for (let i = 0; i < 6; i++) {
      g.fillStyle = ['#ffcf3a', '#ffffff', '#3ad1c2', '#ff8a3d', '#ffffff', '#7b6cff'][i];
      g.fillRect(w * 0.72, h * (0.1 + i * 0.07), w * 0.2, h * 0.05);
    }
    g.fillStyle = '#222';
    g.fillRect(w * 0.12, h * 0.8, w * 0.5, h * 0.1);
    weather(g, w, h, random, { fade: 0.08 });
  });
  add('fest_banner', 384, 768, (g, w, h) => {
    g.fillStyle = '#ff5d8f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffcf3a';
    g.fillRect(0, h * 0.82, w, h * 0.18);
    rocket(g, w / 2, h * 0.36, w / 170, '#ffffff', '#2a1b5c');
    centered(g, 'SUMMER', w / 2, h * 0.68, `900 ${w * 0.2}px ${BLACK}`, '#ffffff');
    centered(g, 'FEST', w / 2, h * 0.76, `900 ${w * 0.18}px ${BLACK}`, '#ffffff');
    centered(g, 'GZOWO SPRINGS', w / 2, h * 0.9, `bold ${w * 0.1}px ${SANS}`, '#2a1b5c');
  });
  add('fest_banner_b', 384, 768, (g, w, h) => {
    g.fillStyle = '#3ad1c2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1b5c';
    g.fillRect(0, h * 0.82, w, h * 0.18);
    flamingo(g, w / 2, h * 0.38, w / 120);
    centered(g, 'ROCKET', w / 2, h * 0.68, `900 ${w * 0.2}px ${BLACK}`, '#ffffff');
    centered(g, 'PARK', w / 2, h * 0.76, `900 ${w * 0.18}px ${BLACK}`, '#ffffff');
    centered(g, 'FIREWORKS SAT', w / 2, h * 0.9, `bold ${w * 0.1}px ${SANS}`, '#ffcf3a');
  });
  add('plaque', 384, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#a77a3a');
    grd.addColorStop(1, '#5e3f18');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e2c27a';
    g.lineWidth = 6;
    g.strokeRect(10, 10, w - 20, h - 20);
    centered(g, 'THE GZOWO ROCKET', w / 2, h * 0.24, `bold ${h * 0.11}px ${SERIF}`, '#f4e2b0');
    centered(g, 'First model rocket launched', w / 2, h * 0.45, `${h * 0.075}px ${SERIF}`, '#f4e2b0');
    centered(g, 'from this very square.', w / 2, h * 0.56, `${h * 0.075}px ${SERIF}`, '#f4e2b0');
    centered(g, 'It landed in the river.', w / 2, h * 0.7, `italic ${h * 0.075}px ${SERIF}`, '#f4e2b0');
  });
  add('flag_town', 384, 256, (g, w, h) => {
    g.fillStyle = '#1aa39a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff8a3d';
    g.fillRect(0, h * 0.66, w, h * 0.34);
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.arc(w * 0.5, h * 0.66, h * 0.26, Math.PI, 0);
    g.fill();
    rocket(g, w * 0.5, h * 0.45, h / 280, '#ffffff', '#ff5d3a', false);
    centered(g, 'GZOWO SPRINGS', w / 2, h * 0.86, `900 ${h * 0.1}px ${FUTURA}`, '#ffffff');
  }, { noise: 4 });
  add('pump_face', 192, 384, (g, w, h) => {
    g.fillStyle = '#eef2f4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0f5ea8';
    g.fillRect(0, 0, w, h * 0.2);
    centered(g, 'GAS & GO', w / 2, h * 0.1, `900 ${w * 0.16}px ${BLACK}`, '#ffd21f');
    g.fillStyle = '#111';
    g.fillRect(w * 0.12, h * 0.26, w * 0.76, h * 0.2);
    centered(g, '00.00', w / 2, h * 0.36, `bold ${w * 0.2}px "Courier New", monospace`, '#7dff8f');
    ['87', '89', '93'].forEach((n, i) => {
      g.fillStyle = ['#2a8a2a', '#e0a020', '#c03030'][i];
      g.fillRect(w * (0.12 + i * 0.27), h * 0.55, w * 0.22, h * 0.12);
      centered(g, n, w * (0.23 + i * 0.27), h * 0.61, `bold ${w * 0.11}px ${SANS}`, '#fff');
    });
    g.fillStyle = '#333';
    g.fillRect(w * 0.3, h * 0.75, w * 0.4, h * 0.12);
    weather(g, w, h, random, { fade: 0.05, spots: 6 });
  });
  add('news_red', 128, 192, (g, w, h) => {
    g.fillStyle = '#c8322c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2efe6';
    g.fillRect(w * 0.1, h * 0.12, w * 0.8, h * 0.46);
    centered(g, 'GZOWO', w / 2, h * 0.22, `900 ${w * 0.17}px ${SERIF}`, '#111');
    centered(g, 'GAZETTE', w / 2, h * 0.32, `bold ${w * 0.13}px ${SERIF}`, '#111');
    g.fillStyle = '#555';
    for (let i = 0; i < 6; i++) g.fillRect(w * 0.16, h * (0.38 + i * 0.03), w * 0.68, 2);
    weather(g, w, h, random, { fade: 0.06, spots: 5 });
  });
  add('news_blue', 128, 192, (g, w, h) => {
    g.fillStyle = '#1764a8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2efe6';
    g.fillRect(w * 0.1, h * 0.12, w * 0.8, h * 0.46);
    centered(g, 'FREE', w / 2, h * 0.22, `900 ${w * 0.2}px ${SANS}`, '#c8322c');
    centered(g, 'RENT GUIDE', w / 2, h * 0.34, `bold ${w * 0.11}px ${SANS}`, '#111');
    weather(g, w, h, random, { fade: 0.06, spots: 5 });
  });
  add('news_yellow', 128, 192, (g, w, h) => {
    g.fillStyle = '#f2c230';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2efe6';
    g.fillRect(w * 0.1, h * 0.12, w * 0.8, h * 0.46);
    centered(g, 'SAWGRASS', w / 2, h * 0.22, `900 ${w * 0.13}px ${SANS}`, '#111');
    centered(g, 'WEEKLY', w / 2, h * 0.33, `bold ${w * 0.13}px ${SANS}`, '#111');
    weather(g, w, h, random, { fade: 0.06, spots: 5 });
  });
  add('walk', 128, 128, (g, w, h) => {
    g.fillStyle = '#111';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2f2ea';
    g.beginPath();
    g.arc(w * 0.5, h * 0.2, w * 0.08, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = w * 0.09;
    g.lineCap = 'round';
    g.strokeStyle = '#f2f2ea';
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.32);
    g.lineTo(w * 0.48, h * 0.58);
    g.lineTo(w * 0.36, h * 0.85);
    g.moveTo(w * 0.48, h * 0.58);
    g.lineTo(w * 0.62, h * 0.85);
    g.moveTo(w * 0.5, h * 0.38);
    g.lineTo(w * 0.34, h * 0.52);
    g.moveTo(w * 0.5, h * 0.38);
    g.lineTo(w * 0.66, h * 0.5);
    g.stroke();
  }, { noise: 0 });
  add('dont', 128, 128, (g, w, h) => {
    g.fillStyle = '#111';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff7a1a';
    g.beginPath();
    g.roundRect(w * 0.3, h * 0.35, w * 0.4, h * 0.45, w * 0.08);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.roundRect(w * (0.3 + i * 0.1), h * 0.15, w * 0.08, h * 0.3, w * 0.04);
      g.fill();
    }
  }, { noise: 0 });

  flush();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return { texture, items, canvas, random };
}

# Costa del Gzowo film: assembles rendered shot frames into the final reel (freeze frames, punch-in zooms, grades, flashes, glitches, captions, cards) and mixes music and meme sounds to -14 LUFS.
import argparse
import json
import math
import os
import subprocess
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, SR = 1080, 1920, 30, 48000
FF = os.environ.get('FFMPEG', 'ffmpeg')
HERE = Path(__file__).resolve().parent
FONTS = HERE / 'fonts'
ANTON = str(FONTS / 'anton-Anton-Regular.ttf')
BANGERS = str(FONTS / 'bangers-Bangers-Regular.ttf')
VT323 = str(FONTS / 'vt323-VT323-Regular.ttf')
YELLOW = (255, 214, 0)

STYLES = {
    'meme': dict(font=ANTON, size=112, fill=(255, 255, 255), stroke=9, upper=True),
    'meme-small': dict(font=ANTON, size=74, fill=(255, 255, 255), stroke=7, upper=True),
    'meme-big': dict(font=ANTON, size=200, fill=YELLOW, stroke=12, upper=True, rot=-4),
    'title': dict(font=ANTON, size=150, fill=YELLOW, stroke=11, upper=True, rot=-4),
    'step': dict(font=ANTON, size=92, fill=(15, 15, 15), stroke=0, upper=True, box=YELLOW, rot=-3),
    'alert': dict(font=ANTON, size=430, fill=(255, 190, 0), stroke=16, upper=True),
    'label-noob': dict(font=BANGERS, size=250, fill=(120, 230, 90), stroke=12, upper=True, rot=-6),
    'label-pro': dict(font=BANGERS, size=250, fill=(70, 190, 255), stroke=12, upper=True, rot=5),
    'label-hacker': dict(font=VT323, size=270, fill=(57, 255, 20), stroke=0, upper=True, box=(0, 0, 0), rot=0),
    'terminal': dict(font=VT323, size=96, fill=(57, 255, 20), stroke=0, upper=False, box=(0, 0, 0)),
    'vs': dict(font=BANGERS, size=170, fill=(255, 255, 255), stroke=10, upper=True),
    'shrug': dict(font=ANTON, size=120, fill=(255, 255, 255), stroke=9, upper=False),
}


@lru_cache(maxsize=256)
def text_layer(text, style):
    st = STYLES[style]
    txt = text.upper() if st.get('upper') else text
    size = st['size']
    while True:
        font = ImageFont.truetype(st['font'], size)
        probe = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
        box = probe.multiline_textbbox((0, 0), txt, font=font, stroke_width=st['stroke'], align='center', spacing=size * 0.08)
        box = [int(math.floor(box[0])), int(math.floor(box[1])), int(math.ceil(box[2])), int(math.ceil(box[3]))]
        tw, th = box[2] - box[0], box[3] - box[1]
        if tw <= 840 or size < 30:
            break
        size = int(size * 0.92)
    pad = int(size * 0.22) if st.get('box') else st['stroke'] + 6
    img = Image.new('RGBA', (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if st.get('box'):
        d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=int(size * 0.12), fill=st['box'] + (235,))
    d.multiline_text((pad - box[0], pad - box[1]), txt, font=font, fill=st['fill'], stroke_width=st['stroke'], stroke_fill=(0, 0, 0), align='center', spacing=size * 0.08)
    if st.get('rot'):
        img = img.rotate(st['rot'], resample=Image.BICUBIC, expand=True)
    if st['stroke'] or st.get('box'):
        shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
        shadow.putalpha(img.getchannel('A').point(lambda a: int(a * 0.45)))
        shadow = shadow.filter(ImageFilter.GaussianBlur(10))
        out = Image.new('RGBA', (img.width + 20, img.height + 20), (0, 0, 0, 0))
        out.alpha_composite(shadow, (14, 16))
        out.alpha_composite(img, (4, 4))
        img = out
    return img


def ease_out_back(x):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def place_caption(frame, text, style, yc, age, life):
    layer = text_layer(text, style)
    k = min(1.0, age / 0.14)
    s = 0.55 + 0.45 * ease_out_back(k) if k < 1 else 1.0
    if life - age < 0.06:
        s *= 0.92
    lw, lh = max(1, int(layer.width * s)), max(1, int(layer.height * s))
    img = layer if (lw, lh) == layer.size else layer.resize((lw, lh), Image.BICUBIC)
    x = (W - lw) // 2
    y = int(yc - lh / 2)
    frame.alpha_composite(img, (x, max(0, min(H - lh, y))))


def sponge_card(t):
    img = Image.new('RGBA', (W, H))
    y = np.linspace(0, 1, H)[:, None]
    top = np.array([40, 120, 200])
    bot = np.array([20, 60, 140])
    arr = (top * (1 - y) + bot * y)[:, None, :].repeat(W, axis=1).astype(np.uint8)
    img = Image.fromarray(arr, 'RGB').convert('RGBA')
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(7)
    for i in range(26):
        bx = rng.uniform(0, W)
        by = (rng.uniform(0, H) - t * rng.uniform(120, 300)) % H
        r = rng.uniform(10, 45)
        d.ellipse([bx - r, by - r, bx + r, by + r], outline=(200, 235, 255, 180), width=4)
    font = ImageFont.truetype(BANGERS, 170)
    lines = ['A FEW', 'MOMENTS', 'LATER']
    for i, line in enumerate(lines):
        wob = math.sin(t * 7 + i) * 8
        bb = d.textbbox((0, 0), line, font=font, stroke_width=10)
        x = (W - (bb[2] - bb[0])) / 2
        yy = 620 + i * 210 + wob
        d.text((x, yy), line, font=font, fill=(255, 205, 40), stroke_width=10, stroke_fill=(120, 60, 10))
    return img


def grade(arr, kind, k=1.0, t=0.0):
    a = arr.astype(np.float32) / 255
    if kind == 'sepia':
        g = a @ np.array([[0.393, 0.349, 0.272], [0.769, 0.686, 0.534], [0.189, 0.168, 0.131]], np.float32)
        out = np.clip(g * 0.95, 0, 1)
    elif kind == 'bw':
        l = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
        out = np.clip((l - 0.5) * 1.25 + 0.5, 0, 1).repeat(3, axis=2)
    elif kind == 'matrix':
        l = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
        out = np.clip(np.concatenate([l * 0.35, l * 1.15 + 0.03, l * 0.4], axis=2), 0, 1)
    elif kind.startswith('hue'):
        ang = float(kind[3:] or 0) * math.pi / 180
        c, s = math.cos(ang), math.sin(ang)
        m = np.array([
            [0.213 + c * 0.787 - s * 0.213, 0.213 - c * 0.213 + s * 0.143, 0.213 - c * 0.213 - s * 0.787],
            [0.715 - c * 0.715 - s * 0.715, 0.715 + c * 0.285 + s * 0.140, 0.715 - c * 0.715 + s * 0.715],
            [0.072 - c * 0.072 + s * 0.928, 0.072 - c * 0.072 - s * 0.283, 0.072 + c * 0.928 + s * 0.072],
        ], np.float32)
        out = np.clip(a @ m * 1.08, 0, 1)
    elif kind == 'punch':
        out = np.clip((a - 0.5) * 1.18 + 0.5, 0, 1)
        l = (out @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
        out = np.clip(l + (out - l) * 1.35, 0, 1)
    else:
        return arr
    if k < 1:
        out = a + (out - a) * k
    return (out * 255).astype(np.uint8)


def glitch(arr, t, amount=1.0):
    rng = np.random.default_rng(int(t * 1000))
    out = arr.copy()
    sh = int(18 * amount)
    out[..., 0] = np.roll(arr[..., 0], sh, axis=1)
    out[..., 2] = np.roll(arr[..., 2], -sh, axis=1)
    for _ in range(int(9 * amount)):
        y0 = rng.integers(0, H - 60)
        h = rng.integers(10, 90)
        out[y0:y0 + h] = np.roll(out[y0:y0 + h], int(rng.integers(-120, 120) * amount), axis=1)
    return out


def interp(keys, t):
    if t <= keys[0][0]:
        return keys[0][1:]
    if t >= keys[-1][0]:
        return keys[-1][1:]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= t <= b[0]:
            k = (t - a[0]) / max(1e-6, b[0] - a[0])
            k = k * k * (3 - 2 * k)
            return [x + (y - x) * k for x, y in zip(a[1:], b[1:])]


def frame_for(frames_dir, idx, k, src_cache):
    key = (idx, k)
    if key in src_cache:
        return src_cache[key]
    p = frames_dir / f's{idx:02d}_{k:04d}.jpg'
    img = Image.open(p).convert('RGB')
    src_cache.clear()
    src_cache[key] = img
    return img


def render_video(plan, frames_dir, out_path, only=None):
    shots = plan['shots']
    total = shots[-1]['start'] + shots[-1]['frames']
    ff = None if only is not None else subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', str(FPS), str(out_path)], stdin=subprocess.PIPE)
    cache = {}
    for i, s in enumerate(shots):
        e = s.get('edit') or {}
        for k in range(s['frames']):
            gf = s['start'] + k
            if only is not None and gf not in only:
                continue
            t = k / FPS
            src_k = k
            for at, hold in e.get('freeze', []):
                if at <= t < at + hold:
                    src_k = min(s['frames'] - 1, int(round(at * FPS)))
            card = None
            for c in e.get('cards', []):
                if c[0] <= t < c[1]:
                    card = c
            if card:
                frame = sponge_card(t - card[0])
            else:
                img = frame_for(frames_dir, i, src_k, cache)
                sc, cx, cy = interp(e['zoom'], t) if e.get('zoom') else (1.0, 0.5, 0.5)
                sw, shh = img.width / sc, img.height / sc
                x0 = min(max(0, cx * img.width - sw / 2), img.width - sw)
                y0 = min(max(0, cy * img.height - shh / 2), img.height - shh)
                img = img.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + sw, y0 + shh))
                arr = np.asarray(img)
                for g in e.get('grade', []):
                    if g[0] <= t < g[1]:
                        arr = grade(arr, g[2], g[3] if len(g) > 3 else 1.0, t)
                for hb in e.get('huebeat', []):
                    t0, t1, period, phase, angles, strength = hb
                    if t0 <= t < t1:
                        n = int(math.floor((t - phase) / period))
                        arr = grade(arr, 'hue%d' % angles[n % len(angles)], strength)
                for g in e.get('glitch', []):
                    if g[0] <= t < g[1]:
                        arr = glitch(arr, t, g[2] if len(g) > 2 else 1.0)
                fl = 0.0
                for ft in e.get('flash', []):
                    if ft <= t < ft + 0.2:
                        fl = max(fl, 1 - (t - ft) / 0.2)
                if fl > 0:
                    arr = (arr.astype(np.float32) * (1 - fl) + 255 * fl).astype(np.uint8)
                frame = Image.fromarray(arr, 'RGB').convert('RGBA')
                if e.get('vignette'):
                    frame.alpha_composite(vignette_layer())
            for c in e.get('captions', []):
                t0, t1, text, style, yc = c
                if t0 <= t < t1:
                    place_caption(frame, text, style, yc, t - t0, t1 - t0)
            for c in plan.get('overlay', []):
                t0, t1, text, style, yc = c
                gt = gf / FPS
                if t0 <= gt < t1:
                    place_caption(frame, text, style, yc, gt - t0, t1 - t0)
            if only is not None:
                frame.convert('RGB').save(out_path.parent / f'{out_path.stem}_{gf:04d}.jpg', quality=88)
                continue
            ff.stdin.write(frame.convert('RGB').tobytes())
    if ff:
        ff.stdin.close()
        ff.wait()
    return total


@lru_cache(maxsize=1)
def vignette_layer():
    y, x = np.mgrid[0:H, 0:W]
    r = np.sqrt(((x - W / 2) / (W * 0.75)) ** 2 + ((y - H / 2) / (H * 0.75)) ** 2)
    a = np.clip((r - 0.55) * 1.6, 0, 1) * 160
    img = np.zeros((H, W, 4), np.uint8)
    img[..., 3] = a.astype(np.uint8)
    return Image.fromarray(img, 'RGBA')


def load_wav(path):
    raw = subprocess.run([FF, '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


VOICE = {'bruh', 'wow', 'who_are_you', 'few_moments', 'nope', 'oof', 'yeet'}


def mix_audio(plan, audio_dir, out_wav):
    shots = plan['shots']
    total = (shots[-1]['start'] + shots[-1]['frames']) / FPS
    n = int(round(total * SR))
    music = np.zeros((n, 2), np.float32)
    fx = np.zeros((n, 2), np.float32)
    duck = np.ones(n, np.float32)
    info = json.loads((audio_dir / 'sfx.json').read_text())
    m = plan.get('music')
    log = []
    if m:
        song = load_wav(audio_dir / (Path(m['file']).stem + '.flac'))
        end = total
        for s in shots:
            e = s.get('edit') or {}
            if 'musicEnd' in e:
                end = min(end, s['start'] / FPS + e['musicEnd'])
        a = int(round(m['videoAt'] * SR))
        b = int(round(end * SR))
        src0 = int(round(m['songAt'] * SR))
        seg = song[src0:src0 + (b - a)].copy()
        fade_in = min(len(seg), int((m.get('fadeIn') or 0.006) * SR))
        seg[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
        fo = min(len(seg), int((m.get('fadeOut') or 0.008) * SR))
        seg[-fo:] *= (np.linspace(1, 0, fo) ** 2)[:, None]
        music[a:a + len(seg)] += seg * m.get('gain', 0.8)
        log.append({'music': m['file'], 'video_from': round(a / SR, 3), 'video_to': round((a + len(seg)) / SR, 3), 'song_from': m['songAt']})
    for s in shots:
        e = s.get('edit') or {}
        for t, name, gain in e.get('sfx', []):
            x = load_wav(audio_dir / f'{name}.flac')
            pk = info[name]['peak_at']
            lead = pk if (pk < 0.2 and name not in VOICE) else 0.0
            at = s['start'] / FPS + t - lead
            i0 = int(round(at * SR))
            j0 = max(0, -i0)
            i0 = max(0, i0)
            seg = x[j0:j0 + n - i0] * gain
            fx[i0:i0 + len(seg)] += seg
            if name in VOICE or name in ('mgs_alert', 'scratch'):
                d0 = max(0, i0 - int(0.05 * SR))
                d1 = min(n, i0 + len(seg) + int(0.1 * SR))
                duck[d0:d1] = np.minimum(duck[d0:d1], 0.45)
            log.append({'sfx': name, 'hit': round(s['start'] / FPS + t, 3), 'start': round(at, 3), 'shot': s['name']})
    k = int(0.08 * SR)
    sm = np.convolve(duck, np.ones(k) / k, mode='same').astype(np.float32)
    mix = music * sm[:, None] + fx
    tmp = out_wav.with_suffix('.raw.wav')
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', str(tmp)], input=mix.astype(np.float32).tobytes(), check=True)
    r = subprocess.run([FF, '-hide_banner', '-i', str(tmp), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    meas = json.loads(r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:"
          f"measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}:linear=true,aresample={SR}")
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(tmp), '-af', af, '-ar', str(SR), '-c:a', 'pcm_s24le', str(out_wav)], check=True)
    tmp.unlink()
    return log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan')
    ap.add_argument('frames')
    ap.add_argument('audio')
    ap.add_argument('out')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    plan = json.loads(Path(a.plan).read_text())
    out = Path(a.out)
    if a.only:
        render_video(plan, Path(a.frames), out, only={int(x) for x in a.only.split(',')})
        return
    wav = out.with_suffix('.wav')
    log = mix_audio(plan, Path(a.audio), wav)
    video = out.with_suffix('.video.mp4')
    render_video(plan, Path(a.frames), video)
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(video), '-i', str(wav), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', str(SR),
                    '-movflags', '+faststart', '-shortest', str(out)], check=True)
    video.unlink()
    wav.unlink()
    Path(str(out) + '.audio.json').write_text(json.dumps(log, indent=1))
    print('wrote', out)


if __name__ == '__main__':
    main()

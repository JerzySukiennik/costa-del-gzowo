# Costa del Gzowo film Kaggle job: renders reels frame-exact from the public game build in headless Chromium on the T4 (EGL), then edits and mixes them with edit.py.
import glob, json, os, shutil, subprocess, sys, time

VIDEOS = __VIDEOS__
BASE = '__BASE__'
PROBE = __PROBE__
WAIT = 400
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)


r = subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'playwright==1.48.0', 'imageio-ffmpeg', 'pillow', 'numpy'], capture_output=True, text=True)
log('pip', r.returncode, r.stderr[-300:])
r = subprocess.run([sys.executable, '-m', 'playwright', 'install', '--with-deps', 'chromium'], capture_output=True, text=True)
log('pw install', r.returncode, r.stderr[-300:])
egl = next(iter(glob.glob('/usr/lib/x86_64-linux-gnu/libEGL_nvidia.so.0') + glob.glob('/usr/local/nvidia/lib64/libEGL_nvidia.so.0')), None)
if egl:
    os.makedirs('/usr/share/glvnd/egl_vendor.d', exist_ok=True)
    json.dump({'file_format_version': '1.0.0', 'ICD': {'library_path': egl}}, open('/usr/share/glvnd/egl_vendor.d/10_nvidia.json', 'w'))
log('egl', egl)

hits = glob.glob('/kaggle/input/**/edit.py', recursive=True)
kit = os.path.dirname(hits[0])
log('kit', kit)
import imageio_ffmpeg
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
os.environ['FFMPEG'] = ffmpeg
work = '/kaggle/working'
scripts = [f'{kit}/runtime/vt.js', f'{kit}/runtime/poses.js', f'{kit}/runtime/film.js'] + sorted(glob.glob(f'{kit}/videos/*.js'))

from playwright.sync_api import sync_playwright


def shoot(pw, video, frames):
    b = pw.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1.25)
    for s in scripts:
        ctx.add_init_script(path=s)
    p = ctx.new_page()
    errors = []
    p.on('pageerror', lambda e: errors.append(str(e)[:300]))
    p.goto(BASE + '?auto=1&avatar=jurek&car=roadster&quality=ultra', wait_until='load', timeout=180000)
    p.wait_for_function("window.__ready === true && window.__dbg && window.__dbg.mode === 'playing'", timeout=900000)
    p.wait_for_timeout(2500)
    log(video, 'ready', p.evaluate("() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); }"))
    plan = p.evaluate('v => window.__film.start(v)', video)
    total = sum(s['frames'] for s in plan['shots'])
    done = 0
    late = [0]
    for i, s in enumerate(plan['shots']):
        p.evaluate('k => window.__film.enter(k)', i)
        n = s['frames']
        wanted = None if not PROBE else {min(n - 1, round(j * (n - 1) / max(1, PROBE - 1))) for j in range(PROBE)}
        t = time.time()
        for k in range(s['pre'] + n):
            cap = k - s['pre']
            near = wanted is None or any(0 <= w - cap < 5 for w in wanted)
            p.evaluate('r => window.__film.advance(r)', bool(near))
            if cap < 0 or not near:
                continue
            try:
                p.wait_for_function('window.__vt.pending === 0', timeout=WAIT)
            except Exception:
                late[0] += 1
            if wanted is None or cap in wanted:
                p.screenshot(path=f'{frames}/s{i:02d}_{cap:04d}.jpg', type='jpeg', quality=95)
        done += n
        log(video, f'shot {i} {s["name"]} {n}f {time.time() - t:.1f}s  ({done}/{total}) late {late[0]} pending {p.evaluate("window.__vt.pending")}')
    log(video, 'errors', errors[:5])
    b.close()
    return plan


with sync_playwright() as pw:
    for video in VIDEOS:
        out = f'{work}/{video}'
        frames = f'{out}/frames'
        os.makedirs(frames, exist_ok=True)
        try:
            plan = shoot(pw, video, frames)
        except Exception as e:
            log(video, 'FAILED', repr(e)[:800])
            continue
        json.dump(plan, open(f'{out}/plan.json', 'w'), indent=1)
        if PROBE:
            continue
        r = subprocess.run([sys.executable, f'{kit}/edit.py', f'{out}/plan.json', frames, f'{kit}/audio', f'{out}/{video}.mp4'], capture_output=True, text=True)
        log(video, 'edit', r.returncode, r.stdout[-300:], r.stderr[-1500:])
        shutil.rmtree(frames)
log('done', {v: os.listdir(f'{work}/{v}') for v in VIDEOS if os.path.isdir(f'{work}/{v}')})

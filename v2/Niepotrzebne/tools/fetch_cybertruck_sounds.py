# Costa del Gzowo: downloads the Cyber Truck's CC0 freesound.org recordings, cuts steady sections into seamless padded loops and one-shots, levels them and writes credits.
import os
import re
import subprocess
import time
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "vehicles", "cybertruck", "audio")
RAW = os.path.join(ROOT, "Niepotrzebne", "raw", "cybertruck")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
SR = 44100
LEAD = 0.25

SOUNDS = {
    "tyre_loop": (817389, "ViveleVent", "loop", 5.0, 8.0, -18, "tyre noise on a highway"),
    "door_open": (488057, "BenDrain", "shot", 0.0, 0.58, -3, "car door opening"),
    "door_close": (345066, "metrostock99", "shot", 0.0, 1.6, -2, "car door closing from inside"),
    "vault_loop": (500313, "martin-bn", "loop", 3.2, 4.0, -20, "electric blinds motor, used for the vault cover"),
    "compressor_loop": (637713, "kyles", "loop", 6.0, 4.0, -20, "small compressor, used for the air suspension pump"),
    "hiss_loop": (457294, "brunoboselli", "loop", 9.5, 3.0, -21, "air pressure release, used for the suspension lowering"),
    "hiss_end": (131302, "reg7783", "shot", 1.2, 0.7, -4, "short air release, used when the suspension settles"),
}


def get(url, binary=False):
    for attempt in range(6):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
            return data if binary else data.decode("utf8", "ignore")
        except Exception:
            time.sleep(5 + attempt * 5)
    raise RuntimeError("failed " + url)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def zero_cross(x, i, span=400):
    lo = max(1, i - span)
    seg = x[lo : i + span]
    idx = np.where((seg[:-1] <= 0) & (seg[1:] > 0))[0]
    return lo + int(idx[np.argmin(np.abs(idx + lo - i))]) if len(idx) else i


def make_loop(x, start, length):
    fade = int(0.35 * SR)
    a = zero_cross(x, int(start * SR))
    b = zero_cross(x, a + int(length * SR))
    body = x[a:b].copy()
    tail = x[b : b + fade]
    ramp = np.linspace(0, 1, len(tail))
    body[: len(tail)] = body[: len(tail)] * ramp + tail * (1 - ramp)
    lead = int(LEAD * SR)
    padded = np.concatenate([body[-lead:], body, body[:lead]])
    seam = abs(body[-1] - body[0])
    return padded, len(body) / SR, seam


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    credits = ["# Cyber Truck audio credits", "", "All recordings come from freesound.org and are licensed Creative Commons 0 (public domain). Files were trimmed, looped on zero crossings with a crossfade, padded for gapless looping and levelled. The electric drive unit itself is synthesised in code (src/vehicle/cybertruck/ctAudio.js).", ""]
    loops = []
    for name, (sid, user, kind, start, length, level, what) in SOUNDS.items():
        raw = os.path.join(RAW, f"{sid}.mp3")
        page_url = f"https://freesound.org/people/{user}/sounds/{sid}/"
        if not os.path.exists(raw):
            page = get(page_url)
            m = re.search(r"https://cdn\.freesound\.org/previews/\d+/%d_\d+-(?:hq|lq)\.mp3" % sid, page)
            open(raw, "wb").write(get(re.sub(r"-lq\.mp3$", "-hq.mp3", m.group(0)), True))
            time.sleep(2.5)
        x = decode(raw)
        if kind == "loop":
            y, period, seam = make_loop(x, start, length)
            y *= 10 ** ((level - rms_db(y)) / 20)
            loops.append(f"{name}: {LEAD} {period:.4f} seam step {seam:.5f}")
        else:
            a = int(start * SR)
            y = x[a : a + int(length * SR)].copy()
            n = len(y)
            y[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
            y[n - int(0.03 * SR) :] *= np.linspace(1, 0, int(0.03 * SR))
            y *= 10 ** ((level - 20 * np.log10(np.max(np.abs(y)) + 1e-12)) / 20)
        peak = np.max(np.abs(y))
        if peak > 0.89:
            y *= 0.89 / peak
        dest = os.path.join(OUT, name + ".mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-b:a", "128k", dest], input=y.astype(np.float64).tobytes(), check=True)
        credits.append(f"- `{name}.mp3`: [{sid}]({page_url}) by {user} ({what})")
        print(name, os.path.getsize(dest) // 1024, "kB")
    open(os.path.join(OUT, "CREDITS.md"), "w").write("\n".join(credits) + "\n")
    print("\n".join(loops))


if __name__ == "__main__":
    main()

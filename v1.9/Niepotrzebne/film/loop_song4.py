# Costa del Gzowo film: cuts a seamless 12-beat loop out of the song in Jurek's screen recording and repeats it into a long track with its beat grid.
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SRC = Path.home() / 'Downloads' / 'ScreenRecording_11-20-2026 22-07-41_1.MP4'
OUT = HERE / 'work' / 'audio'
SR = 48000
CUT = 2.32
BEATS = 12
REPEATS = 7


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def spec(mono, t0, dur, win=2048, hop=240):
    i, n = int(t0 * SR), int(dur * SR)
    fr = np.array([np.abs(np.fft.rfft(mono[j:j + win] * np.hanning(win)))[:700] for j in range(i, i + n, hop)])
    f = np.log1p(20 * fr)
    return f - f.mean()


def sim(a, b):
    return float((a * b).sum() / np.linalg.norm(a) / np.linalg.norm(b))


def main():
    x = decode(SRC)
    mono = x.mean(axis=1)
    ref = spec(mono, CUT, 0.6)
    pre = spec(mono, CUT - 0.3, 0.3)
    best, score = None, -1
    for L in np.arange(7.800, 7.825, 0.0005):
        s = sim(ref, spec(mono, CUT + L, 0.6)) + sim(pre, spec(mono, CUT + L - 0.3, 0.3))
        if s > score:
            best, score = L, s
    a = int(round(CUT * SR))
    b = int(round((CUT + best) * SR))
    loop = x[a:b].copy()
    xf = int(0.012 * SR)
    ramp = np.linspace(0, 1, xf)[:, None]
    loop[:xf] = loop[:xf] * ramp + x[b:b + xf] * (1 - ramp)
    song = np.concatenate([loop] * REPEATS)
    fade = int(0.004 * SR)
    song[:fade] *= np.linspace(0, 1, fade)[:, None]
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'flac', '-sample_fmt', 's32', str(OUT / 'song4_loop.flac')],
                   input=song.astype(np.float32).tobytes(), check=True)
    info = {'source': SRC.name, 'loop_from_recording': round(a / SR, 4), 'loop_to_recording': round(b / SR, 4), 'loop_len': round(len(loop) / SR, 5),
            'beats_per_loop': BEATS, 'beat': round(len(loop) / SR / BEATS, 5), 'seam_similarity': round(score / 2, 4), 'repeats': REPEATS}
    (OUT / 'song4_loop.json').write_text(json.dumps(info, indent=1))
    print(info)


if __name__ == '__main__':
    sys.exit(main())

# Costa del Gzowo film: converts downloaded meme sounds to 48 kHz FLAC with the leading silence trimmed, and the songs to 48 kHz FLAC.
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SFX_IN = HERE / 'downloads' / 'sfx'
MUSIC_IN = HERE / 'downloads' / 'music'
OUT = HERE / 'work' / 'audio'
SR = 48000


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def write(path, x):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'flac', '-sample_fmt', 's32', str(path)], input=x.astype(np.float32).tobytes(), check=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    info = {}
    for f in sorted(SFX_IN.glob('*.mp3')):
        x = decode(f)
        level = np.abs(x).max(axis=1)
        peak = level.max()
        on = int(np.argmax(level > peak * 0.05))
        on = max(0, on - int(0.004 * SR))
        x = x[on:]
        level = np.abs(x).max(axis=1)
        tail = len(level) - int(np.argmax(level[::-1] > peak * 0.003))
        x = x[:max(tail, int(0.05 * SR))]
        fade = min(len(x), int(0.004 * SR))
        x[-fade:] *= np.linspace(1, 0, fade)[:, None]
        hit = int(np.argmax(np.abs(x).max(axis=1)))
        write(OUT / (f.stem + '.flac'), x)
        info[f.stem] = {'dur': round(len(x) / SR, 3), 'trimmed': round(on / SR, 3), 'peak_at': round(hit / SR, 3), 'peak': round(float(peak), 3)}
    for f in sorted(MUSIC_IN.glob('*')):
        write(OUT / (f.stem + '.flac'), decode(f))
    (OUT / 'sfx.json').write_text(json.dumps(info, indent=1))
    for k, v in info.items():
        print(f'{k:14s} {v}')


if __name__ == '__main__':
    sys.exit(main())

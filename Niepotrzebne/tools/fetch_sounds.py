# Riverside: downloads the CC0 freesound.org recordings listed below, trims them, detects footstep onsets and writes credits.
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "audio")
RAW = os.path.join(ROOT, "Niepotrzebne", "raw", "audio")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

SOUNDS = {
    "engine_low": (522225, "Nox_Sound", 2, 9, 1),
    "engine_high": (748027, "Dmitry_mansurev64", 2, 9, 1),
    "skid": (71736, "audible-edge", 2, 5, 1),
    "gravel": (251662, "OBXJohn", 3, 10, 1),
    "wind": (237374, "squareal", 20, 12, 1),
    "scrape": (452587, "kyles", 4, 6, 1),
    "crash1": (237375, "squareal", 0, 4.4, 1),
    "crash2": (332058, "qubodup", 0, 0.9, 1),
    "crash3": (332056, "qubodup", 0, 0.4, 1),
    "glass": (758207, "LukaCafuka", 0, 1.9, 1),
    "door_open": (50697, "RutgerMuller", 0, 0.7, 1),
    "door_close": (778421, "BlondPanda", 0, 0.5, 1),
    "river": (777116, "HowardV", 4, 22, 2),
    "birds": (653743, "nonamethefish", 5, 40, 2),
    "trees": (325090, "ListenTonyBoy", 3, 20, 2),
    "splash_big": (442773, "qubodup", 0, 2.2, 1),
    "splash_small": (676380, "SieuAmThanh", 0, 2.0, 1),
    "underwater": (504641, "Fission9", 5, 20, 2),
    "steps_gravel": (505831, "jedg", 1, 14, 1),
    "steps_concrete": (459964, "florianreichelt", 1, 14, 1),
    "steps_grass": (877864, "Alex_Is_Here", 1, 14, 1),
    "steps_water": (342932, "ryansitz", 1, 14, 1),
    "swim": (675570, "craigsmith", 0.5, 7.5, 1),
    "plastic": (212463, "unfa", 0, 16, 1),
    "roof": (740247, "JoontheFloof", 0, 1.6, 1),
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
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "22050", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def onsets(path, limit=10):
    x = decode(path)
    hop = 220
    n = len(x) // hop
    env = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1))
    floor = np.percentile(env, 55)
    peak = np.percentile(env, 99)
    thr = floor + (peak - floor) * 0.3
    out = []
    i = 2
    while i < n - 2:
        if env[i] > thr and env[i] > env[i - 2] * 1.6:
            j = i
            while j < n - 1 and j - i < 60 and (env[j] > thr * 0.35 or j - i < 12):
                j += 1
            start = max(0, i - 2) * hop / 22050
            out.append([round(start, 3), round(min(0.6, max(0.22, (j - i + 4) * hop / 22050)), 3), float(env[i : i + 10].max())])
            i = j + 14
        else:
            i += 1
    out.sort(key=lambda o: -o[2])
    return [[o[0], o[1]] for o in out[:limit]]


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    credits = ["# Audio credits", "", "All recordings come from freesound.org and are licensed Creative Commons 0 (public domain). Files were trimmed and re-encoded.", ""]
    marks = {}
    for name, (sid, user, start, length, channels) in SOUNDS.items():
        raw = os.path.join(RAW, f"{sid}.mp3")
        page_url = f"https://freesound.org/people/{user}/sounds/{sid}/"
        if not os.path.exists(raw):
            page = get(page_url)
            m = re.search(r'https://cdn\.freesound\.org/previews/\d+/%d_\d+-(?:hq|lq)\.mp3' % sid, page)
            if not m:
                print("no preview for", name, sid)
                continue
            url = re.sub(r"-lq\.mp3$", "-hq.mp3", m.group(0))
            open(raw, "wb").write(get(url, True))
            time.sleep(2.5)
        dest = os.path.join(OUT, name + ".mp3")
        cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(length), "-i", raw, "-ac", str(channels), "-ar", "44100", "-b:a", "128k" if channels == 2 else "96k"]
        if name == "plastic":
            first = onsets(raw, 1)
            cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(first[0][0] if first else 0), "-t", "0.9", "-i", raw, "-ac", "1", "-ar", "44100", "-b:a", "96k"]
        subprocess.run(cmd + [dest], check=True)
        if name.startswith("steps_"):
            marks[name] = onsets(dest)
        credits.append(f"- `{name}.mp3`: [{sid}]({page_url}) by {user}")
        print(name, os.path.getsize(dest) // 1024, "kB", len(marks.get(name, [])))
    json.dump(marks, open(os.path.join(OUT, "onsets.json"), "w"))
    open(os.path.join(OUT, "CREDITS.md"), "w").write("\n".join(credits) + "\n")


if __name__ == "__main__":
    main()

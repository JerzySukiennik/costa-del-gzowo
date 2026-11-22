# Costa del Gzowo: downloads the CC0 freesound.org boat recordings, cuts steady stretches into seamless loops and writes credits.
import os
import re
import subprocess
import time
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "vehicles", "boat", "audio")
RAW = os.path.join(ROOT, "Niepotrzebne", "raw", "boat-audio")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
LEAD = 0.25
LENGTH = 8.0
FADE = 0.6
SR = 44100

SOUNDS = {
    "outboard_idle": (454201, "kyles", 24.5, "speed boat outboard motors, low gear bubbling"),
    "outboard_run": (637744, "kyles", 118.5, "outboard motor boat onboard at high speed"),
    "electric_whine": (528569, "Garuda1982", 85.5, "electric ferry motor"),
    "electric_motor": (846905, "onursamli", 6.0, "electric motor"),
    "sub_hum": (465472, "blaukreuz", 172.5, "submarine internal"),
    "bubbles": (852478, "KolbyRFX", 37.5, "underwater bubble flow"),
    "yacht_diesel": (195743, "blaukreuz", 49.0, "yacht idling after start"),
    "yacht_engine": (417555, "Wakerone", 30.0, "ship engine ambience"),
    "hull_lap": (758858, "Alex_hears_things", 70.0, "small boat wake lapping under a wooden boardwalk"),
    "hull_rush": (74916, "mrmayo", 51.5, "back of a ferry boat, water rushing"),
}


def get(url):
    for attempt in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
        except Exception:
            time.sleep(5 + attempt * 5)
    raise RuntimeError("failed " + url)


def decode(path, start, length):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(length), "-i", path, "-af", "loudnorm=I=-18:TP=-2", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    credits = ["# Boat audio credits", "", "All recordings come from freesound.org and are licensed Creative Commons 0 (public domain). Steady stretches were cut, loudness-matched, crossfaded into seamless loops and re-encoded.", ""]
    for name, (sid, user, start, what) in SOUNDS.items():
        raw = os.path.join(RAW, f"{sid}.mp3")
        page_url = f"https://freesound.org/people/{user}/sounds/{sid}/"
        if not os.path.exists(raw) or os.path.getsize(raw) == 0:
            page = get(page_url).decode("utf8", "ignore")
            m = re.search(r"https://cdn\.freesound\.org/previews/\d+/%d_\d+-(?:hq|lq)\.mp3" % sid, page)
            url = re.sub(r"-lq\.mp3$", "-hq.mp3", m.group(0))
            open(raw, "wb").write(get(url))
            time.sleep(3)
        x = decode(raw, start, LENGTH + FADE + 0.1)
        n = int(LENGTH * SR)
        f = int(FADE * SR)
        x = x[: n + f]
        ramp = np.linspace(0, 1, f, dtype=np.float32)
        loop = x[:n].copy()
        loop[:f] = x[:f] * ramp + x[n : n + f] * (1 - ramp)
        lead = int(LEAD * SR)
        full = np.concatenate([loop[-lead:], loop, loop[: lead]])
        wav = os.path.join(RAW, name + ".f32")
        full.astype(np.float32).tofile(wav)
        dest = os.path.join(OUT, name + ".mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", wav, "-b:a", "96k", dest], check=True)
        os.remove(wav)
        credits.append(f"- `{name}.mp3`: [{sid}]({page_url}) by {user} ({what})")
        print(name, os.path.getsize(dest) // 1024, "kB")
    open(os.path.join(OUT, "CREDITS.md"), "w").write("\n".join(credits) + "\n")


if __name__ == "__main__":
    main()

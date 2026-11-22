# Costa del Gzowo: downloads the CC0 freesound.org recordings used by pedestrians and traffic, trims them and writes credits.
import os
import re
import subprocess
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "npc", "audio")
RAW = os.path.join(ROOT, "Niepotrzebne", "raw", "audio")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

SOUNDS = {
    "horn_a": (734253, "yfjesse", 0, 0.55),
    "horn_b": (705723, "mudflea2", 0, 0.75),
    "engine": (616519, "JalynCatbtg", 8, 7),
    "thud": (673424, "courtneyeck", 1.0, 0.9),
}


def get(url, binary=False):
    for attempt in range(6):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
            return data if binary else data.decode("utf8", "ignore")
        except Exception:
            time.sleep(5 + attempt * 5)
    raise RuntimeError("failed " + url)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    credits = ["# Pedestrian and traffic audio credits", "", "All recordings come from freesound.org and are licensed Creative Commons 0 (public domain). Files were trimmed and re-encoded.", "The tyre squeal reuses `assets/audio/skid.mp3` and footsteps reuse `assets/audio/steps_concrete.mp3` (see `assets/audio/CREDITS.md`).", ""]
    for name, (sid, user, start, length) in SOUNDS.items():
        raw = os.path.join(RAW, f"{sid}.mp3")
        page_url = f"https://freesound.org/people/{user}/sounds/{sid}/"
        if not os.path.exists(raw):
            page = get(page_url)
            m = re.search(r"https://cdn\.freesound\.org/previews/\d+/%d_\d+-(?:hq|lq)\.mp3" % sid, page)
            if not m:
                print("no preview for", name, sid)
                continue
            open(raw, "wb").write(get(re.sub(r"-lq\.mp3$", "-hq.mp3", m.group(0)), True))
            time.sleep(2.5)
        dest = os.path.join(OUT, name + ".mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(length), "-i", raw, "-ac", "1", "-ar", "44100", "-b:a", "96k", dest], check=True)
        credits.append(f"- `{name}.mp3`: [{sid}]({page_url}) by {user}")
        print(name, os.path.getsize(dest) // 1024, "kB")
    open(os.path.join(OUT, "CREDITS.md"), "w").write("\n".join(credits) + "\n")


if __name__ == "__main__":
    main()

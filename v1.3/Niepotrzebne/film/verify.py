# Costa del Gzowo film: checks a finished reel (format, loudness, true peak, clicks at music edges, sound-effect onsets) and writes a contact sheet of frames.
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration', '-of', 'json', str(path)], capture_output=True, text=True)
    return json.loads(r.stdout)


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind('Summary:'):]
    out = {}
    for line in tail.splitlines():
        line = line.strip()
        if line.startswith('I:'):
            out['lufs'] = float(line.split()[1])
        if line.startswith('Peak:'):
            out['true_peak_dbtp'] = float(line.split()[1])
    return out


def audio(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def onset_near(y, t, win=0.12):
    a = max(0, int((t - win) * 48000))
    b = int((t + win) * 48000)
    seg = y[a:b]
    if len(seg) < 960:
        return None
    hop = 240
    e = np.array([np.sqrt((seg[i:i + hop] ** 2).mean()) for i in range(0, len(seg) - hop, hop)])
    d = np.diff(e)
    i = int(np.argmax(d))
    return round(a / 48000 + (i + 1) * hop / 48000 - t, 3)


def clicks(y, t):
    i = int(t * 48000)
    seg = y[max(0, i - 480):i + 480]
    if len(seg) < 10:
        return 0.0
    return round(float(np.abs(np.diff(seg)).max()), 4)


def main():
    mp4 = Path(sys.argv[1])
    sheet_out = Path(sys.argv[2])
    times = [float(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
    info = probe(mp4)
    dur = float(info['format']['duration'])
    rep = {'probe': info['streams'], 'duration': dur, **loudness(mp4)}
    y = audio(mp4)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp4), '-f', 'f32le', '-'], capture_output=True).stdout
    rep['sample_peak'] = round(float(np.abs(np.frombuffer(raw, np.float32)).max()), 4)
    log_path = Path(str(mp4) + '.audio.json')
    if log_path.exists():
        log = json.loads(log_path.read_text())
        rep['sfx'] = [{'sfx': l['sfx'], 'hit': l['hit'], 'onset_offset': onset_near(y, l['hit'])} for l in log if 'sfx' in l]
        rep['music_edges'] = [{'t': l[k], 'max_step': clicks(y, l[k])} for l in log if 'music' in l for k in ('video_from', 'video_to')]
    if times is None:
        times = list(np.linspace(0.2, dur - 0.2, 24))
    imgs = []
    for t in times:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', str(mp4), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
        if raw:
            from io import BytesIO
            imgs.append((t, Image.open(BytesIO(raw)).convert('RGB')))
    w, h = 216, 384
    cols = 8
    sheet = Image.new('RGB', (w * cols, (h + 18) * ((len(imgs) + cols - 1) // cols)), 'black')
    d = ImageDraw.Draw(sheet)
    for i, (t, im) in enumerate(imgs):
        x, yy = (i % cols) * w, (i // cols) * (h + 18)
        sheet.paste(im.resize((w, h)), (x, yy + 18))
        d.text((x + 3, yy + 3), f'{t:.2f}s', fill='white')
        d.rectangle([x, yy + 18 + int(h * 250 / 1920), x + w - 1, yy + 18 + int(h * 1450 / 1920)], outline=(80, 200, 255))
    sheet.save(sheet_out, quality=85)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()

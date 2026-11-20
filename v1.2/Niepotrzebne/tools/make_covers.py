# Costa del Gzowo: draws the hand-made radio station covers and converts every cover to a 512 px JPEG.
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "radio")
S = 1024
SUP = "/System/Library/Fonts/Supplemental/"
SYS = "/System/Library/Fonts/"
FONTS = {
    "impact": (SUP + "Impact.ttf", 0),
    "black": (SUP + "Arial Black.ttf", 0),
    "bodoni": (SUP + "Bodoni 72.ttc", 2),
    "didot": (SUP + "Didot.ttc", 2),
    "futura": (SUP + "Futura.ttc", 4),
    "futuram": (SUP + "Futura.ttc", 0),
    "rockwell": (SUP + "Rockwell.ttc", 1),
    "brush": (SUP + "Brush Script.ttf", 0),
    "din": (SUP + "DIN Condensed Bold.ttf", 0),
    "avenir": (SYS + "Avenir Next.ttc", 0),
    "avenirl": (SYS + "Avenir Next.ttc", 7),
    "cjk": (SYS + "Hiragino Sans GB.ttc", 2),
}


def font(name, size):
    path, index = FONTS[name]
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return ImageFont.truetype(path, size)


def fit(draw, text, name, width, start):
    size = start
    while size > 20:
        f = font(name, size)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= width:
            return f
        size -= 4
    return font(name, size)


def center(draw, text, f, y, fill, x=S / 2, stroke=0, stroke_fill=None):
    box = draw.textbbox((0, 0), text, font=f, stroke_width=stroke)
    draw.text((x - (box[2] + box[0]) / 2, y - (box[3] + box[1]) / 2), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


def gradient(top, bottom):
    t = np.linspace(0, 1, S)[:, None, None]
    a = np.array(top, dtype=np.float32)[None, None, :]
    b = np.array(bottom, dtype=np.float32)[None, None, :]
    return Image.fromarray(np.repeat((a + (b - a) * t), S, axis=1).astype(np.uint8))


def grain(image, amount=9):
    rng = np.random.default_rng(7)
    arr = np.asarray(image).astype(np.int16)
    noise = rng.normal(0, amount, (S, S, 1))
    return Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))


def bolt(draw, cx, cy, scale, fill):
    pts = [(-0.18, -1.0), (0.42, -1.0), (0.08, -0.12), (0.5, -0.12), (-0.3, 1.0), (-0.02, 0.12), (-0.44, 0.12)]
    draw.polygon([(cx + x * scale, cy + y * scale) for x, y in pts], fill=fill)


def star(draw, cx, cy, r, fill):
    pts = []
    for i in range(8):
        a = i * math.pi / 4
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    draw.polygon(pts, fill=fill)


def euro():
    im = Image.new("RGB", (S, S), (74, 28, 138))
    d = ImageDraw.Draw(im)
    lime = (198, 255, 46)
    for band, y0 in ((0, 96), (1, S - 96 - 96)):
        for i in range(12):
            for j in range(2):
                if (i + j + band) % 2 == 0:
                    d.rectangle([i * 86, y0 + j * 48, i * 86 + 86, y0 + j * 48 + 48], fill=lime)
    bolt(d, 190, 500, 170, lime)
    bolt(d, S - 190, 500, 170, (255, 255, 255))
    f = fit(d, "EURO 9X", "impact", 560, 250)
    center(d, "EURO 9X", f, 470, (255, 255, 255), stroke=10, stroke_fill=(30, 8, 70))
    center(d, "93.3", font("impact", 120), 650, lime)
    return im


def funk():
    im = Image.new("RGB", (S, S), (243, 229, 200))
    d = ImageDraw.Draw(im)
    colors = [(196, 74, 26), (226, 132, 30), (233, 180, 52), (128, 70, 34)]
    for i, c in enumerate(colors):
        r = 560 - i * 62
        d.pieslice([S / 2 - r, 430 - r, S / 2 + r, 430 + r], 180, 360, fill=c)
    d.pieslice([S / 2 - 310, 430 - 310, S / 2 + 310, 430 + 310], 180, 360, fill=(243, 229, 200))
    d.ellipse([S / 2 - 250, 180, S / 2 + 250, 680], fill=(28, 22, 20))
    for r in (210, 170, 130):
        d.ellipse([S / 2 - r, 430 - r, S / 2 + r, 430 + r], outline=(58, 48, 44), width=3)
    d.ellipse([S / 2 - 84, 346, S / 2 + 84, 514], fill=(226, 132, 30))
    d.ellipse([S / 2 - 12, 418, S / 2 + 12, 442], fill=(243, 229, 200))
    d.rectangle([0, 560, S, S], fill=(243, 229, 200))
    f = fit(d, "FUNK NAREW", "black", 860, 150)
    center(d, "FUNK NAREW", f, 700, (128, 70, 34))
    center(d, "96.4", font("black", 96), 850, (196, 74, 26))
    return im


def moonwalk():
    im = Image.new("RGB", (S, S), (8, 8, 10))
    d = ImageDraw.Draw(im)
    d.ellipse([312, 110, 712, 510], fill=(236, 236, 240))
    d.ellipse([404, 80, 804, 480], fill=(8, 8, 10))
    rng = np.random.default_rng(3)
    for _ in range(46):
        x, y = rng.uniform(40, S - 40), rng.uniform(40, 560)
        star(d, x, y, rng.uniform(5, 20), (236, 236, 240))
    d.line([120, 600, S - 120, 600], fill=(170, 172, 180), width=5)
    f = fit(d, "MOONWALK", "bodoni", 820, 190)
    center(d, "MOONWALK", f, 700, (245, 245, 248))
    center(d, "FM  102.5", font("futura", 70), 850, (170, 172, 180))
    return im


def rock():
    im = Image.new("RGB", (S, S), (12, 12, 12))
    d = ImageDraw.Draw(im)
    yellow = (255, 210, 22)
    for i in range(-4, 16):
        d.polygon([(i * 110, S), (i * 110 + 60, S), (i * 110 + 150, S - 90), (i * 110 + 90, S - 90)], fill=yellow)
        d.polygon([(i * 110, 90), (i * 110 + 60, 90), (i * 110 + 150, 0), (i * 110 + 90, 0)], fill=yellow)
    bolt(d, S / 2, 330, 215, yellow)
    f = fit(d, "NAREW ROCK", "impact", 880, 210)
    center(d, "NAREW ROCK", f, 640, (255, 255, 255), stroke=12, stroke_fill=(12, 12, 12))
    center(d, "98.6", font("impact", 120), 815, yellow)
    return im


def costa_fm():
    im = gradient((22, 142, 150), (10, 92, 112))
    d = ImageDraw.Draw(im)
    pink = (255, 132, 170)
    d.ellipse([S / 2 - 290, 110, S / 2 + 290, 690], fill=pink)
    for i in range(7):
        y = 420 + i * 44
        d.rectangle([0, y, S, y + 12 + i * 3], fill=(16, 116, 130))
    d.rectangle([0, 600, S, S], fill=(10, 92, 112))
    center(d, "Costa FM", font("brush", 250), 690, (255, 255, 255), stroke=6, stroke_fill=(10, 70, 88))
    center(d, "101.2", font("futura", 84), 880, pink)
    return im


def zlota():
    im = gradient((38, 14, 74), (212, 84, 42))
    d = ImageDraw.Draw(im)
    gold = (255, 196, 64)
    d.ellipse([S / 2 - 300, 150, S / 2 + 300, 750], fill=gold)
    for i in range(8):
        y = 430 + i * 42
        d.rectangle([0, y, S, y + 8 + i * 5], fill=(150, 52, 60))
    d.rectangle([0, 640, S, S], fill=(34, 12, 66))
    f = fit(d, "ZŁOTA GODZINA", "futura", 900, 150)
    center(d, "ZŁOTA GODZINA", f, 750, gold)
    center(d, "104.8", font("futuram", 78), 880, (255, 236, 200))
    return im


def blok():
    im = Image.new("RGB", (S, S), (150, 152, 152))
    d = ImageDraw.Draw(im)
    orange = (242, 122, 30)
    for x0, h in ((90, 420), (320, 560), (600, 470), (800, 360)):
        w = 200 if x0 != 800 else 150
        d.rectangle([x0, 640 - h, x0 + w, 640], fill=(58, 60, 62))
        for r in range(int(h // 56) - 1):
            for c in range(int(w // 50)):
                lit = (r * 7 + c * 3 + x0) % 5 == 0
                d.rectangle([x0 + 14 + c * 50, 640 - h + 22 + r * 56, x0 + 40 + c * 50, 640 - h + 56 + r * 56], fill=orange if lit else (104, 106, 108))
    d.rectangle([0, 640, S, S], fill=(28, 28, 30))
    center(d, "BLOK", font("impact", 250), 760, (255, 255, 255))
    center(d, "90.5", font("impact", 90), 915, orange)
    return im


def filharmonia():
    im = Image.new("RGB", (S, S), (82, 16, 30))
    d = ImageDraw.Draw(im)
    gold = (224, 184, 96)
    d.ellipse([92, 92, S - 92, S - 92], outline=gold, width=9)
    d.ellipse([122, 122, S - 122, S - 122], outline=gold, width=3)
    for k in range(5):
        y = 300 + k * 34
        d.line([300, y, 724, y], fill=gold, width=5)
    for x, y in ((370, 402), (470, 368), (570, 334), (660, 368)):
        d.ellipse([x - 26, y - 19, x + 26, y + 19], fill=gold)
        d.line([x + 23, y, x + 23, y - 120], fill=gold, width=7)
    d.line([268, 286, 268, 450], fill=gold, width=9)
    f = fit(d, "FILHARMONIA", "didot", 640, 120)
    center(d, "FILHARMONIA", f, 590, gold)
    center(d, "88.1", font("didot", 84), 720, (244, 226, 190))
    return im


def renifer():
    im = Image.new("RGB", (S, S), (18, 70, 48))
    d = ImageDraw.Draw(im)
    gold = (232, 190, 96)
    cream = (246, 238, 214)
    rng = np.random.default_rng(11)
    for _ in range(60):
        x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(3, 9)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(60, 120, 92))
    for side in (-1, 1):
        base = (S / 2 + side * 60, 430)
        tip = (S / 2 + side * 250, 150)
        d.line([base, tip], fill=gold, width=22)
        for t, length in ((0.35, 110), (0.6, 130), (0.85, 90)):
            px = base[0] + (tip[0] - base[0]) * t
            py = base[1] + (tip[1] - base[1]) * t
            d.line([(px, py), (px + side * 30, py - length)], fill=gold, width=18)
    d.ellipse([S / 2 - 120, 360, S / 2 + 120, 600], fill=(122, 78, 44))
    d.ellipse([S / 2 - 36, 500, S / 2 + 36, 572], fill=gold)
    d.arc([S / 2 - 150, 330, S / 2 + 150, 560], 200, 340, fill=cream, width=14)
    for side in (-1, 1):
        d.rounded_rectangle([S / 2 + side * 140 - 28, 420, S / 2 + side * 140 + 28, 520], 18, fill=cream)
    f = fit(d, "RADIO RENIFER", "rockwell", 860, 120)
    center(d, "RADIO RENIFER", f, 730, cream)
    center(d, "100.0", font("rockwell", 84), 860, gold)
    return im


def szanghaj():
    im = gradient((14, 104, 88), (8, 62, 58))
    d = ImageDraw.Draw(im)
    gold = (236, 196, 92)
    d.line([S / 2, 60, S / 2, 170], fill=gold, width=8)
    d.rounded_rectangle([S / 2 - 70, 160, S / 2 + 70, 196], 10, fill=gold)
    d.ellipse([S / 2 - 190, 190, S / 2 + 190, 520], fill=(196, 62, 44))
    for k in (-2, -1, 0, 1, 2):
        d.arc([S / 2 - 190 + abs(k) * 62, 190, S / 2 + 190 - abs(k) * 62, 520], 0, 360, fill=gold, width=5)
    d.rounded_rectangle([S / 2 - 70, 514, S / 2 + 70, 550], 10, fill=gold)
    for k in range(-2, 3):
        d.line([S / 2 + k * 24, 550, S / 2 + k * 24, 620], fill=gold, width=5)
    center(d, "上海", font("cjk", 150), 356, gold)
    f = fit(d, "SZANGHAJ FM", "futura", 820, 130)
    center(d, "SZANGHAJ FM", f, 740, (246, 238, 214))
    center(d, "95.0", font("futuram", 80), 870, gold)
    return im


def fala():
    im = Image.new("RGB", (S, S), (222, 172, 58))
    d = ImageDraw.Draw(im)
    brown = (92, 52, 30)
    teal = (30, 110, 112)
    for i, c in enumerate((brown, teal, (246, 232, 196))):
        pts = []
        for x in range(0, S + 8, 8):
            pts.append((x, 250 + i * 64 + math.sin(x / 82 + i * 0.9) * 42))
        d.line(pts, fill=c, width=34, joint="curve")
    d.rounded_rectangle([262, 470, 762, 720], 34, fill=brown)
    d.rounded_rectangle([296, 504, 520, 686], 18, fill=(246, 232, 196))
    for k in range(7):
        d.line([314, 524 + k * 24, 502, 524 + k * 24], fill=brown, width=7)
    d.ellipse([570, 512, 728, 670], fill=teal)
    d.ellipse([630, 572, 668, 610], fill=(246, 232, 196))
    f = fit(d, "FALA PRL", "rockwell", 800, 170)
    center(d, "FALA PRL", f, 820, brown)
    center(d, "89.4", font("rockwell", 80), 936, teal)
    return im


def labs():
    im = Image.new("RGB", (S, S), (250, 249, 246))
    d = ImageDraw.Draw(im)
    ink = (16, 16, 16)
    cx, cy = S / 2, 300
    d.line([(cx, cy - 150), (cx - 46, cy - 40), (cx - 46, cy + 90), (cx + 46, cy + 90), (cx + 46, cy - 40), (cx, cy - 150)], fill=ink, width=7, joint="curve")
    d.ellipse([cx - 20, cy - 34, cx + 20, cy + 6], outline=ink, width=7)
    d.line([(cx - 46, cy + 40), (cx - 96, cy + 110), (cx - 46, cy + 90)], fill=ink, width=7, joint="curve")
    d.line([(cx + 46, cy + 40), (cx + 96, cy + 110), (cx + 46, cy + 90)], fill=ink, width=7, joint="curve")
    for k, r in enumerate((70, 110, 150)):
        d.arc([cx + 120 - r, cy - 150 - r, cx + 120 + r, cy - 150 + r], 300, 30, fill=ink, width=6)
    f = fit(d, "gzowo labs", "avenirl", 760, 170)
    center(d, "gzowo labs", f, 610, ink)
    center(d, "radio 108.0", font("avenir", 62), 760, (110, 110, 110))
    return im


COVERS = {"euro-9x": euro, "funk-narew": funk, "moonwalk": moonwalk, "narew-rock": rock, "costa-fm": costa_fm, "zlota-godzina": zlota, "blok": blok, "filharmonia": filharmonia, "renifer": renifer, "szanghaj": szanghaj, "fala-prl": fala, "gzowo-labs": labs}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, draw in COVERS.items():
        image = grain(draw().convert("RGB")).filter(ImageFilter.SMOOTH)
        image.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, name + ".jpg"), quality=88)
    for name in os.listdir(OUT):
        if name.endswith(".png"):
            Image.open(os.path.join(OUT, name)).convert("RGB").resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, name[:-4] + ".jpg"), quality=88)
            os.remove(os.path.join(OUT, name))
    names = sorted(n for n in os.listdir(OUT) if n.endswith(".jpg"))
    sheet = Image.new("RGB", (5 * 300, 3 * 300), (20, 20, 20))
    for i, n in enumerate(names):
        sheet.paste(Image.open(os.path.join(OUT, n)).resize((290, 290)), ((i % 5) * 300 + 5, (i // 5) * 300 + 5))
    return sheet, names


if __name__ == "__main__":
    import sys

    sheet, names = main()
    if len(sys.argv) > 1:
        sheet.save(sys.argv[1], quality=86)
    print(len(names), names)

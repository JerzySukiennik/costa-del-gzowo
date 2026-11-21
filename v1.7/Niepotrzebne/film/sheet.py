# Costa del Gzowo film: tiles a folder of frames into one labelled contact sheet for review.
import os
import sys
from glob import glob

from PIL import Image, ImageDraw

files = sorted(glob(os.path.join(sys.argv[1], '*.jpg')))
out = sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
w, h = 220, 391
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 16)), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    x, y = (i % cols) * w, (i // cols) * (h + 16)
    sheet.paste(Image.open(f).convert('RGB').resize((w, h)), (x, y + 16))
    d.text((x + 3, y + 2), os.path.basename(f)[:30], fill='black')
sheet.save(out, quality=85)
print(out, len(files))

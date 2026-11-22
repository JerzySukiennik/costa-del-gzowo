# Costa del Gzowo film: writes and pushes a Kaggle render kernel for one or more videos (full render, or a probe of N frames per shot).
import json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
K = str(Path.home() / 'Downloads/Claude/Projects/AIe/G-Images/.venv/bin/python')
slug = sys.argv[1]
videos = sys.argv[2].split(',')
probe = int(sys.argv[3]) if len(sys.argv) > 3 else 0
base = 'https://costa.gzowo.fun/v1.2/'
out = HERE / 'out' / 'kernels' / slug
out.mkdir(parents=True, exist_ok=True)
src = (HERE / 'render.py').read_text().replace('__VIDEOS__', json.dumps(videos)).replace('__BASE__', base).replace('__PROBE__', str(probe))
(out / 'render.py').write_text(src)
(out / 'kernel-metadata.json').write_text(json.dumps({
    'id': f'jerzysukiennik/{slug}', 'title': slug.replace('-', ' '), 'code_file': 'render.py', 'language': 'python', 'kernel_type': 'script',
    'is_private': True, 'enable_gpu': True, 'enable_internet': True, 'dataset_sources': ['jerzysukiennik/costa-film-kit'],
    'competition_sources': [], 'kernel_sources': [], 'machine_shape': 'NvidiaTeslaT4'}))
r = subprocess.run([K, '-m', 'kaggle', 'kernels', 'push', '-p', str(out)], capture_output=True, text=True)
print(r.stdout[-500:], r.stderr[-500:])

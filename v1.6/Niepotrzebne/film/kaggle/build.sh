#!/bin/zsh
# Costa del Gzowo film: assembles the Kaggle dataset (runtime, choreography, editor, fonts, audio) and pushes a new version.
set -e
cd "$(dirname "$0")/.."
K=~/Downloads/Claude/Projects/AIe/G-Images/.venv/bin/python
D=kaggle/data/kit
rm -rf kaggle/data && mkdir -p $D/videos $D/runtime $D/fonts $D/audio
cp runtime/*.js $D/runtime/
cp videos/v[0-9]_*.js $D/videos/
cp edit.py $D/
cp fonts/*.ttf fonts/*.txt $D/fonts/
cp work/audio/*.flac work/audio/sfx.json $D/audio/
cat > kaggle/data/dataset-metadata.json <<META
{"title": "costa film kit", "id": "jerzysukiennik/costa-film-kit", "licenses": [{"name": "other"}]}
META
if $K -m kaggle datasets status jerzysukiennik/costa-film-kit >/dev/null 2>&1; then
  $K -m kaggle datasets version -p kaggle/data -m "${1:-update}" -r zip -q
else
  $K -m kaggle datasets create -p kaggle/data -r zip -q
fi

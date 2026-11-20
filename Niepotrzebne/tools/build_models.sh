#!/bin/sh
# Riverside: packs raw glTF models into meshopt + WebP GLBs under assets/models.
cd "$(dirname "$0")"
OUT=../../assets/models
TMP=../raw/tmp
mkdir -p "$OUT" "$TMP"
pack() {
  name=$(basename "$1" .gltf)
  [ -f "$OUT/$name.glb" ] && return
  nice -n 10 node_modules/.bin/gltf-transform webp "$1" "$TMP/$name.glb" --quality 86 > /dev/null 2>&1 &&
  nice -n 10 node_modules/.bin/gltf-transform meshopt "$TMP/$name.glb" "$OUT/$name.glb" --level medium > /dev/null 2>&1
  [ -f "$OUT/$name.glb" ] && echo "$name $(du -h "$OUT/$name.glb" | cut -f1)" || echo "FAILED $name"
  rm -f "$TMP/$name.glb"
}
for f in ../raw/lod/*/*.gltf; do pack "$f"; done
for d in ../raw/models/*; do
  n=$(basename "$d")
  [ -d "../raw/lod/$n" ] && continue; case "$n" in jacaranda_tree|island_tree_02|searsia_lucida) continue;; esac
  pack "$d/$n.gltf"
done

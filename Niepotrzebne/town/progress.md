# Gzowo Springs town: progress

Branch: worktree-agent-a838f81042801976f. Dev server for tests: `python3 Niepotrzebne/devserver.py 8931` (never 8905).

## Done
- World enlarged symmetrically: `WORLD.half` 320 -> 460, `WORLD.core` = 320 keeps the old square. Terrain: old 64 m chunks unchanged, ring of 115x140 / 140x128 chunks; splat texel kept at 0.625 m (SPLAT 1472) so old texels line up.
- Why symmetric: grass.js and roadsterPhysics.js read `WORLD.half` as a square, and both are off limits. A rectangular world needs hooks there (see report).
- Town valley: `heightAt` flattens `TOWN` rect to 4.28 with a 40 m blend; road cuttings closed east of the town and west of the old edge (only beyond x=330/407, old map unchanged).
- Splat: town ground gravel/dirt, grass and reed masks zero (yards get grass); forest channel untouched so the old far forest regenerates identically, then filtered out of the town.
- Far forest: old points pinned to `WORLD.core - 6`, new ring points (seed 92) appended to the same impostor fields.
- Static sun depth map widened (non-square) to cover the town, same texel density.
- East road-closed barrier removed (props.js), west one kept.
- Town code in `src/world/town/`: layout, kit (batches), materials (texture array, interior glass, decals), atlas (code-drawn), streets, town (cells, live channels).

## Next
- buildings.js (real buildings), furniture.js (lamps, signals, props, palms), map in screens.js, HUD place name, README licences, perf pass.

## Tools
- `Niepotrzebne/town/tools/views.mjs <steps.json> <view...>` + `views.json`, then `node Niepotrzebne/tools/shot.mjs "http://127.0.0.1:8931/index.html?auto=1&quality=high" shots/x steps.json 2500 1280 720`.

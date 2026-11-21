# Gzowo Springs town: progress

Branch: worktree-agent-a838f81042801976f. Dev server for tests: `python3 Niepotrzebne/devserver.py 8931` (never 8905).

## Done
- World enlarged symmetrically: `WORLD.half` 320 -> 460, `WORLD.core` = 320 keeps the old square. Terrain: old 64 m chunks unchanged, ring of 115x140 / 140x128 chunks; splat texel kept at 0.625 m (SPLAT 1472) so old texels line up.
- Why symmetric: grass.js and roadsterPhysics.js read `WORLD.half` as a square, and both are off limits. A rectangular world needs hooks there (see report).
- Town valley: `heightAt` flattens the `TOWN` rect (x 256..414, z -71..71) to 4.28 with a 40 m blend; road cuttings closed east of the town and west of the old edge (only beyond x=330/409, old map unchanged).
- Splat: town ground dirt/grass texture without blades (signed distance `townSigned`), grass and reed masks zero inside the town, yards keep grass; forest channel untouched so the old far forest regenerates identically, then filtered out of the town.
- Far forest: old points pinned to `WORLD.core - 6`, new ring points (seed 92) appended to the same impostor fields.
- Static sun depth map widened (non-square, `cover` points) to cover the town, same texel density.
- East road-closed barrier removed (props.js), west one kept.
- Town code in `src/world/town/`: layout, kit (batches + CHANNELS), materials (texture array, interior glass, decals with wind), atlas (code-drawn, skyline packer), streets, parts, buildings (19 plots), furniture (lamps, signals, signs, meters, poles/wires, bunting, gas station, motel pylon, welcome sign, billboard, plaza and rocket, hill letters, palms, dynamic props and parked cars), town (cells, live channel animation).
- Map (screens.js) draws the bigger island and the town; HUD shows the place name on entering/leaving.
- Tests (stepped physics, `tools/drive.json`, `tools/walkfly.json`): highway-to-town drive at 110 km/h with no bump at the seam; car stopped by kerb/palm/buildings; parked car pushed; cross street to barrier; roof raycasts match building heights; walking up kerbs, into shop fronts, plaza to alley.

## Measurements so far (1280x720 high, averaged calls)
- Baseline (port 8932 serves `git archive ec903a0` from the scratchpad, assets symlinked): spawn 10.0 ms / 1002 calls / 17.2 M tris, townStreet spot 3.5 ms / 243 / 5.1 M, eastEnd 4.8 ms / 420 / 6.5 M.
- New: spawn 998 calls / 17.7 M, townStreet 5.5 ms / 385 / 6.2 M, townEntry 446 / 7.2 M, eastEnd 6.2 ms / 456 / 7.5 M. Spawn ms swings 10-14 with throttling; calls equal to baseline.
- Throttling ruins repeated runs; `views.mjs` now also reads GPU timer queries (`gpu`), which throttling of the CPU does not skew.

## Next
- Final perf measurement in a cool state (same views as `shots/base-*`), Roadster flight edge check, last visual pass.

## Tools
- `Niepotrzebne/town/tools/views.mjs <steps.json> <view...>` + `views.json`, then `node Niepotrzebne/tools/shot.mjs "http://127.0.0.1:8931/index.html?auto=1&quality=high" shots/x steps.json 2500 1280 720`.
- The Mac throttles (`pmset -g therm`, CPU_Speed_Limit) after 2-3 runs; wait for 100 before trusting timings.

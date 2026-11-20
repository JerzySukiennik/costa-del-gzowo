# Costa del Gzowo

A small, detailed open-world vertical slice that runs in the browser: a concrete road bridge over a clear Florida-style river, a drivable convertible with real suspension, tyre and damage models, an on-foot character who can swim, and a river that reacts to everything that enters it.

No build step. Serve the folder with any static server and open `index.html` (three.js r180 and Rapier load from a CDN).

```
python3 Niepotrzebne/devserver.py 8905
```

## Controls

| Key | On foot | In the car |
| --- | --- | --- |
| W A S D | move | throttle, steer, brake / reverse |
| Mouse | camera | orbit camera |
| Shift | sprint | |
| Space | jump | handbrake |
| F | enter car | exit car |
| Q E | | previous / next radio station |
| T | | open / close the roof |
| H | | headlights |
| C | | camera distance |
| R | | reset car (respawns it when flooded) |
| M | map and menu | map and menu |
| Esc | pause | pause |

## Music

The title music and the car radio play files from `assets/music/`, which is not part of this repository. Without that folder the game runs silently on the title screen and the radio stays hidden. `Niepotrzebne/tools/build_radio.py` builds the folder and its `tracks.json` from a local music library.

## Structure

- `src/render` frame pipeline (HDR opaque pass, AO, water composite, volumetric fog, TAA, motion blur, bloom, auto exposure, AgX grade), lighting, shader hooks
- `src/world` heightfield, terrain, bridge and road, trees with impostor LODs, plants, grass, props, skyline
- `src/water` river rendering and interaction (FFT ripples, GPU wave simulation, planar reflection, caustics, splash particles, underwater pass)
- `src/vehicle` procedural body, parts, dynamics, damage
- `src/player`, `src/camera` (chase rig and title cinematics), `src/audio` (sound mix, music, radio), `src/fx`, `src/ui` (HUD, title, pause and menu screens, radio switcher)
- `Niepotrzebne/tools` asset fetching and model processing scripts

## Assets and licences

- Sky, PBR textures and photoscanned models: [Poly Haven](https://polyhaven.com), CC0. Tree and rock models were reduced with `Niepotrzebne/tools/lod_tree.mjs`.
- Sound: recordings from [freesound.org](https://freesound.org), all CC0, listed in `assets/audio/CREDITS.md`.
- Radio station covers: two generated images and twelve drawn by `Niepotrzebne/tools/make_covers.py`.
- The car, character, bridge, palms and water are generated in code.

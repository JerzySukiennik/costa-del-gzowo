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

## Avatars and cars

The menu (M) has an Avatar tab and a Garage tab.

- Avatars: Dario (a hand-sculpted procedural character) and Jurek (a baked outfit with the hood up plus a trained 3D Gaussian head, drawn in the transparent pass and lit by the scene). `?avatar=jurek` selects it from the URL. The Jurek assets are rebuilt with `Niepotrzebne/tools/bake_jurek.mjs` from the Avatar project.
- Cars: the Costa GT Convertible and the thruster Roadster. Switching restarts the drive; `?car=roadster` selects it from the URL.

Roadster keys: Shift boosts (Shift + S brakes with the front nozzles), X fires the jets (tap to hop, hold to jump, glides to a soft landing in the air), I / K pitch, J / L roll, G toggles flight assist.

## Music

Three sources, picked automatically:

- `assets/music/` holds the full local library for the title, the menu and fourteen radio stations. It is not part of this repository.
- Without that folder the title, pause and menu music play the official YouTube uploads in a now-playing card (`src/audio/deck.js`), and the radio falls back to `assets/music-public/`: Gzowo Labs' own tracks as files plus two stations that stream through the same card.
- If the YouTube player is unavailable, the title and menu use Gzowo Labs' own tracks.

`?soundtrack=youtube` forces the streamed mode for testing.

## Structure

- `src/render` frame pipeline (HDR opaque pass, AO, water composite, volumetric fog, TAA, motion blur, bloom, auto exposure, AgX grade), lighting, shader hooks
- `src/world` heightfield, terrain, bridge and road, trees with impostor LODs, plants, grass, props, skyline
- `src/water` river rendering and interaction (FFT ripples, GPU wave simulation, planar reflection, caustics, splash particles, underwater pass)
- `src/vehicle` convertible (body, parts, interior, roof, dynamics, damage), entry choreography, vehicle registry, and `roadster/` (thruster car)
- `src/player`, `src/camera` (chase rig and title cinematics), `src/audio` (sound mix, music, radio), `src/fx`, `src/ui` (HUD, title, pause and menu screens, radio switcher)
- `Niepotrzebne/tools` asset fetching and model processing scripts

## Assets and licences

- Sky, PBR textures and photoscanned models: [Poly Haven](https://polyhaven.com), CC0. Tree and rock models were reduced with `Niepotrzebne/tools/lod_tree.mjs`.
- Sound: recordings from [freesound.org](https://freesound.org), all CC0, listed in `assets/audio/CREDITS.md`.
- Radio station covers: two generated images and twelve drawn by `Niepotrzebne/tools/make_covers.py`.
- The convertible, the default character, bridge, palms and water are generated in code.
- Roadster model and vapour flipbook: from Jurek's own Roadster 88 and Roadster Jump projects. Thruster sounds from [freesound.org](https://freesound.org), all CC0: thrust loop by kkenny101 (861613); thrust start and big boost by Singular_Estudio (136462), Astounded (477846) and mcpable (131934); thrust stop by mcpable (131934); valve puff by meisterleise (547447, 547448); flap servo by derjuli (824121).
- Jurek avatar: body, clothes and head are Jurek's own Avatar project.
- `assets/music-public/`: tracks by Gzowo Labs.

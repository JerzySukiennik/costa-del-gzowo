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

## Gzowo Springs

Follow the road east over the bridge: it no longer ends at a barrier but runs into Gzowo Springs, a small Florida town in a valley of forested hills. Main Street has kerbed pavements, parking with meters, two cross streets (Palm Ave with working traffic lights and walk signals, Rocket St with stop signs), back alleys, a public car park, a gas station and Rocket Park with its rocket monument. About twenty buildings, each with its own facade: shopfronts with lit interiors behind the glass, awnings that move in the wind, painted and neon signs, murals, graffiti, posters and stickers, fire escapes, roof clutter. Parked cars, bins, newspaper boxes and cones can be pushed around.

The world grew from 640 to 920 m square to make room: a ring of hills and forest around the old map, which stays as it was.

## Avatars and cars

The menu (M) has an Avatar tab and a Garage tab.

- Avatars: Dario (a hand-sculpted procedural character) and Jurek (a baked outfit with the hood up plus a trained 3D Gaussian head, drawn in the transparent pass and lit by the scene). `?avatar=jurek` selects it from the URL. The Jurek assets are rebuilt with `Niepotrzebne/tools/bake_jurek.mjs` from the Avatar project.
- Cars: the Costa GT Convertible and the thruster Roadster. Switching restarts the drive; `?car=roadster` selects it from the URL.

Roadster keys: Space lifts off and climbs while held (gently at first, faster the longer you hold, up to about 450 m), releasing it holds the altitude, C descends to a soft landing or to a hover just above water. In the air W flies forward, S brakes to a stop (and backs up if held), A / D turn and the car flies where its nose points, Shift boosts, I / K pitch, J / L roll. G toggles flight assist (off: Space is raw thrust and nothing holds the car up). On the ground Shift boosts and Shift + S brakes with the front nozzles. In the Roadster the handbrake is X and the camera distance is V.

## Music

Three sources, picked automatically:

- `assets/music/` holds the full local library for the title, the menu and fourteen radio stations. It is not part of this repository.
- Without that folder the title, pause and menu music play the official YouTube uploads in a now-playing card (`src/audio/deck.js`), and the radio falls back to `assets/music-public/`: Gzowo Labs' own tracks as files plus two stations that stream through the same card.
- If the YouTube player is unavailable, the title and menu use Gzowo Labs' own tracks.

`?soundtrack=youtube` forces the streamed mode for testing.

## Structure

- `src/render` frame pipeline (HDR opaque pass, AO, water composite, volumetric fog, TAA, motion blur, bloom, auto exposure, AgX grade), lighting, shader hooks
- `src/world` heightfield, terrain, bridge and road, trees with impostor LODs, plants, grass, props, skyline
- `src/world/town` Gzowo Springs: street plan (`layout.js`), geometry batches (`kit.js`), building parts and buildings, street furniture, materials (texture-array facades, interior-mapped windows, atlas decals), the code-drawn atlas
- `src/water` river rendering and interaction (FFT ripples, GPU wave simulation, planar reflection, caustics, splash particles, underwater pass)
- `src/vehicle` convertible (body, parts, interior, roof, dynamics, damage), entry choreography, vehicle registry, and `roadster/` (thruster car)
- `src/player`, `src/camera` (chase rig and title cinematics), `src/audio` (sound mix, music, radio), `src/fx`, `src/ui` (HUD, title, pause and menu screens, radio switcher)
- `Niepotrzebne/tools` asset fetching and model processing scripts

## Assets and licences

- Sky, PBR textures and photoscanned models: [Poly Haven](https://polyhaven.com), CC0. Tree and rock models were reduced with `Niepotrzebne/tools/lod_tree.mjs`.
- Town textures (1k, CC0, [Poly Haven](https://polyhaven.com)): Painted Plaster Wall, Painted Worn Brick, Large Red Bricks, Clay Roof Tiles 02, Distressed Painted Planks, Corrugated Iron, Painted Metal Shutter, Concrete Pavement. Fetched with `Niepotrzebne/tools/fetch_assets.py`.
- Town signs, neon, murals, graffiti, posters, stickers and street paint are drawn in code at load time (`src/world/town/atlas.js`); every business, band and brand in them is invented.
- Sound: recordings from [freesound.org](https://freesound.org), all CC0, listed in `assets/audio/CREDITS.md`.
- Radio station covers: two generated images and twelve drawn by `Niepotrzebne/tools/make_covers.py`.
- The convertible, the default character, bridge, palms and water are generated in code.
- Roadster model and vapour flipbook: from Jurek's own Roadster 88 and Roadster Jump projects. Thruster sounds from [freesound.org](https://freesound.org), all CC0: thrust loop by kkenny101 (861613); thrust start and big boost by Singular_Estudio (136462), Astounded (477846) and mcpable (131934); thrust stop by mcpable (131934); valve puff by meisterleise (547447, 547448); flap servo by derjuli (824121).
- Jurek avatar: body, clothes and head are Jurek's own Avatar project.
- `assets/music-public/`: tracks by Gzowo Labs.

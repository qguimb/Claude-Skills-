# Golden Hour Skate

A small browser skateboarding game in the spirit of the early Tony Hawk's Pro Skater games, with a low chase camera borrowed from Skate 3. One skatepark at sunset, a 2-minute run with goals, or free skate.

Open `index.html` in a desktop browser. It needs a keyboard and an internet connection; three.js loads from jsDelivr and the fonts from Google Fonts.

## Controls

| Key | Action |
| --- | --- |
| ↑ / W | Push (and pump down transitions) |
| ↓ / S | Brake |
| ← → / A D | Turn on the ground, spin in the air |
| Space | Hold to crouch, release to ollie (longer hold = higher) |
| J + direction | Flip tricks: Kickflip, Heelflip (←), Pop Shove-It (→), Hardflip (↑), Impossible (↓). Tap again mid-flip for a Double or Triple |
| K + direction | Grabs: Indy, Melon (←), Stalefish (→), Nosegrab (↑), Tailgrab (↓). Hold for more points, let go before landing |
| L + direction | Grind a rail, ledge or coping: 50-50, Boardslide (←), Lipslide (→), Nosegrind (↑), 5-0 (↓). Balance with ← → |
| I | Manual (I + ↑ for a nose manual) to link combos. Balance with ↑ ↓ |
| P / Esc | Pause |
| M | Music on/off |
| H | Hide the key hints |
| R | Reset to the start |

Combos score the sum of the trick points times the number of tricks. Repeating a trick inside one combo is worth less each time. Landing sideways, mid-flip or still grabbing is a bail and you lose the combo. Landed combos fill the special bar; while it is full, tricks score 1.5× and you spin and pop harder.

## How it is built

Everything is generated in code. There are no image, model or audio files.

- **Rendering**: three.js r170 (ES module from jsDelivr), ACES tone mapping, soft shadow map that follows the skater, sky and sun in a small GLSL shader.
- **Textures**: canvas-generated concrete, plywood, ramp side panels, graffiti walls, grip tape, board graphic, skyline and palm fronds (`src/02_textures.js`).
- **Park**: an analytic heightfield built from features (quarter pipes, banks, stairs, blocks, a funbox), each of which also emits its meshes and grind lines (`src/03_world.js`).
- **Skater**: built from primitives, posed procedurally with two-bone IK so the feet stay on the board and the hands reach the board for grabs (`src/04_skater.js`).
- **Physics**: a custom arcade controller at 120 Hz: slope gravity, speed-preserving transitions, vert air on the steep quarter pipes, landing checks, grind and manual balance, gaps and combos (`src/05_physics.js`).
- **Audio**: WebAudio synthesis for rolling, pops, landings, grinds and bails, plus a procedural punk loop (`src/01_core.js`).

`./build.sh` concatenates `src/` into `index.html` (standalone) and `dist/artifact.html` (the same page without the document skeleton).

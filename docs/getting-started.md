# Getting started

## Requirements

Node.js 20.19+ or 22.12+ (required by Vite) and npm.

## Commands

```bash
npm install      # install dependencies
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check (tsc) and produce a production build in dist/
npm run preview  # serve the production build locally
```

## FPS counter and frame limit

Rendering is **capped at 60 FPS** on any display (a 75/120/144 Hz monitor also shows 60). The target is
`FRAME_LIMIT.targetFps` in `src/constants/game.ts`. A small frames-per-second readout sits in the **top-right corner** in every mode. It is green at 55+ FPS, yellow
at 30+ and red below. Press **F3** to show or hide it. Thresholds and refresh rate: `FPS_COUNTER` in
`src/constants/game.ts`.

## Main menu and saved games

The game opens on the main menu: a random car wanders in the background while the camera orbits it.
Press **Play** to open the *Saved games* panel:

- **Load** opens a save; **Delete** asks for confirmation in a dialog (Enter/Cancel/Esc/click outside keep the save;
  only the red **Delete** button removes it).
- Type a name (optional) and press **New game** to start an empty creation.
- **Back** returns to the title screen.

The bottom-right corner shows the game version (`vX.Y.Z`), read from `package.json` at build time
(`vite.config.ts` defines `__APP_VERSION__`). Bump the `version` field there to release a new version.

In the game, the **☰ Menu** button (left of the toolbar) returns to the main menu.

## Controls

### Build mode

| Input | Action |
|---|---|
| Left click | Place the selected part |
| Right click | Remove the part under the cursor (removing a block also removes the wheels mounted on it) |
| `1` / `2` | Select **Block** / **Wheel** (also available as HUD buttons) |
| Drag | Rotate the camera (right-button drag pans, scroll zooms) |
| **Clear** | Remove every part |
| **Play** | Switch to Play mode |

The ghost preview is **green** when the placement is valid and **red** when it is not.

A **wheel** must be mounted on the **side** of a block: hover a side face of a block (not the top or
bottom) and click. The face you click defines the wheel's axle.

### Play mode

| Key | Action |
|---|---|
| `W` / `S` (or ↑ / ↓) | Accelerate / reverse |
| `A` / `D` (or ← / →) | Steer left / right |
| `R` | Restart the simulation from the build |
| **Stop** | Return to build mode; the build is untouched |

## Persistence

Every change is saved automatically to the **active save** in `localStorage` (key `blocklab.saves.v2`,
a list of `{ id, name, updatedAt, parts }`). Saves from the old single-slot format (`blocklab.v1`) are
migrated once into a save called "My creation". There is no export/import yet.

## Dev-only debug hook

In dev mode (`npm run dev`) `window.__blocklab` exposes `{ grid, camera, controls, getPhysics }`
for inspection from the browser console. It is stripped from production builds
(`import.meta.env.DEV`).

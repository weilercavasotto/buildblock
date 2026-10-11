# BlockLab

Web-based 3D building game (LEGO-like): place blocks and wheels on a grid, press Play, drive the
creation under physics. Stack: TypeScript, Vite, Three.js, Rapier (`@dimforge/rapier3d-compat`).

Full documentation lives in [`docs/`](docs/README.md). Update it when you change behaviour.

## Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc type-check + vite build (run before finishing a change)
```

There is no test suite yet; verify changes in the browser (see "Verifying changes").

## Layout

- `src/main.ts`: bootstrap, mode switching (menu/build/play), main loop, active-save autosave
- `src/types.ts`: `Part`, `Vec3`, cell helpers
- `src/build/`: `grid.ts` (data model), `build-mode.ts` (picking, ghost, place/remove)
- `src/play/`: `physics-world.ts` (grid -> Rapier), `vehicle-controller.ts` (WASD -> motors)
- `src/parts/part-defs.ts`: visuals/dimensions of every part
- `src/menu/`: main-menu background (`menu-scene.ts`: random car + orbiting camera, `random-build.ts`)
- `src/constants/`: design tokens and tunables (colours, spacing, typography, physics, game, text); `theme.ts` publishes them as CSS variables
- `src/styles/main.css`: all CSS, tokens only
- `src/frame-limiter.ts`: 60 FPS cap (`FRAME_LIMIT`); the main loop returns early when `shouldRender` is false
- `src/ui/confirm-dialog.ts`: reusable modal confirmation (`confirmDialog`); use it instead of `window.confirm`
- `src/ui/fps-counter.ts`: FPS readout (F3 toggles)
- `src/ui/hud.ts`, `src/ui/menu.ts`, `index.html`: toolbar/hints and the main menu with its saved-games panel (markup)
- `public/`: static branding assets (`logo-mark.svg`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`; regenerate the raster ones if the SVG changes)
- `src/scene/sky.ts`: shader sky dome with blocky (voxel-style) clouds that drift with the wind (parameters in `SKY`, `src/constants/game.ts`)
- `src/save.ts`: named save slots in localStorage (key `blocklab.saves.v2`; migrates the old `blocklab.v1`)

See [docs/architecture.md](docs/architecture.md) and [docs/physics.md](docs/physics.md).

## Conventions

- **Never hard-code colours, sizes, spacing, fonts, tunable numbers or UI strings**: add/use a token in `src/constants/`
  (see [docs/constants.md](docs/constants.md)). CSS only uses `var(--...)`; Three.js colours go through `hexToNumber(COLORS...)`.
- **All in-game text is English** (HUD, hints, labels, `lang="en"`).
- **File names are kebab-case** (`build-mode.ts`); classes inside stay PascalCase.
- The `Grid` is the single source of truth; the simulation never mutates it. Stop discards the physics world.
- The game starts in the main menu. Edits autosave only to the active save (`activeSave` in `main.ts`);
  set it to `null` around `grid.load/clear` so loading does not rewrite (and re-date) a save.
- UI font is Orbitron (self-hosted, imported in `main.ts`, token in `typography.ts`); it is wide, so keep sizes modest and buttons `nowrap`.
- Mouse: left = place on press / drag to paint blocks on the starting face's plane (never moves the camera), right click = remove / right drag = pan, middle drag = rotate,
  scroll = zoom (`controls.mouseButtons` in `main.ts`; click-vs-drag logic in `build-mode.ts`).
- The version shown in the menu comes from `package.json` (`__APP_VERSION__`, defined in `vite.config.ts`).
- User-provided text (save names) is rendered with `textContent`, never `innerHTML`.
- Cell `[x, y, z]` centre is world `(x, y, z)`; ground top is `y = -0.5`; valid cells have `y >= 0`.
- Shared geometries/materials are created once in `part-defs.ts`; do not dispose them per instance.
- Adding a part type: follow [docs/adding-a-part.md](docs/adding-a-part.md).

## Physics gotchas

- Connected blocks must stay **one rigid body** with one collider per block; do not joint individual cubes.
- A wheel body must start **un-rotated**: Rapier's revolute joint uses the same axis numbers in both bodies'
  local frames, so only the wheel's *collider* and mesh are rotated toward the axle.
- Wheels (radius 0.65) collide only with the ground; this is done with collision groups, keep it that way.
- Tuning constants (speed, motor strength, brake, steering, friction, gravity) live in `src/constants/physics.ts` and are listed in `docs/physics.md`.

## Verifying changes

1. `npm run build` must pass.
2. Run `npm run dev`, open the app and exercise the feature: place blocks/wheels with real clicks, press
   Play, drive with W/S/A/D, `R` restarts, Stop returns to the intact build.
3. Dev mode exposes `window.__blocklab` (`grid`, `camera`, `controls`, `getPhysics()`, `getMode()`, `menuScene`, `build`) for inspecting
   state, e.g. a body's position, from the console.
4. The in-app browser pane pauses `requestAnimationFrame` while hidden; if physics seems frozen, bring the
   tab to the front (a screenshot also wakes it) before concluding something is broken.

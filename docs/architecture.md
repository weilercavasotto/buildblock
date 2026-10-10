# Architecture

## Layout

```
src/
  main.ts                      Bootstrap: renderer, scene, lights, mode switching, main loop
  types.ts                     Part, Vec3, cell helpers
  save.ts                      Named save slots in localStorage
  menu/menu-scene.ts           Main-menu background: random car, autopilot, orbiting camera
  menu/random-build.ts         Random car generator
  ../vite.config.ts            Injects `__APP_VERSION__` (from package.json); typed in src/env.d.ts
  ui/menu.ts                   Main menu and saved-games panel (DOM bound to index.html)
  parts/part-defs.ts           Visuals and dimensions of every part
  build/grid.ts                Data model: the set of placed parts
  build/build-mode.ts          Mouse picking, ghost preview, place/remove
  play/physics-world.ts        Grid -> Rapier bodies/joints, scenery, stepping and sync
  play/vehicle-controller.ts   Keyboard -> wheel motors
  ui/hud.ts                    Toolbar and hint text (DOM bound to index.html)
```

## Core idea: the grid is the source of truth

Building edits only a plain data structure (`Grid`); nothing physical exists until Play.

```
 BuildMode ──edits──▶ Grid ──subscribe──▶ BuildMode (re-renders meshes)
                       │                └─▶ save.ts (autosave)
                       └─ snapshot on Play ─▶ PhysicsWorld ─▶ VehicleController
```

Autosave goes to the active save only (see Modes). `Stop` simply disposes the `PhysicsWorld` and shows the build again, so the grid is never
mutated by the simulation.

## Modes

`main.ts` keeps a `mode`: `menu` → `build` ⇄ `play`.

- **menu**: build meshes and HUD are hidden, `OrbitControls` is not updated, and `MenuScene` runs its own
  `PhysicsWorld` built from a *separate* random `Grid`, so it never touches the player's grid.
- **build / play**: as described below. `activeSave` is the id autosave writes to (`null` in the menu
  and while loading, so nothing is overwritten by accident).

`MenuScene` drives its car through `VehicleController.setAutopilot` (keyboard listening disabled): it
wanders with random throttle/steer, steers back when farther than 22 units from the origin, and spawns a
new random car every 25–45 s, or sooner if the car flips or falls.

## Coordinates

- A cell `[x, y, z]` is an integer triple; its **centre** is the world position `(x, y, z)`.
- The ground's top surface is at `y = -0.5`, so cells with `y = 0` sit on the ground. `y < 0` is invalid.
- Cells are 1×1×1.

## Data model (`types.ts`)

```ts
interface Part {
  type: 'block' | 'wheel';
  cell: Vec3;
  face?: Vec3; // wheels only: outward normal of the block face it is mounted on (= axle direction)
}
```

A wheel at `cell` with `face` is attached to the block at `cell - face`.

## Modules

- **`Grid`** — `Map` keyed by `"x,y,z"`. `canPlace` enforces: free cell, `y >= 0`, and for wheels a
  lateral `face` with a block behind it. `remove` cascades to wheels mounted on a removed block.
  Observers register with `subscribe`.
- **`BuildMode`** — raycasts against placed parts and the ground plane, picks the nearest hit and derives
  a target part (blocks go on the clicked face's neighbour cell; wheels only on side faces). Distinguishes
  a click from a camera drag by pointer movement (< 5 px). Owns the `group` of build meshes and hides it
  during Play.
- **`part-defs`** — shared geometries/materials, `createPartObject(part, ghost?)` and
  `faceQuaternion(face)` (maps the cylinder's Y axis to the axle). Used by build mode, ghost and Play.
- **`PhysicsWorld`** — see [physics.md](physics.md).
- **`VehicleController`** — see [physics.md](physics.md).
- **`Hud`** — wires the buttons in `index.html`, switches hint text per mode and can be hidden (menu).
- **`Menu`** — title screen and saved-games panel (load / delete / new). Uses `save.ts`; names are
  inserted with `textContent`.
- **`save.ts`** — `listSaves`, `getSave`, `createSave`, `updateSave`, `deleteSave`; handles the one-time
  migration from `blocklab.v1`.
- **`main.ts`** — owns the mode state (`physics`/`vehicle` are non-null only in Play), the `R` restart and
  the animation loop (camera follow in Play).

## Branding assets

Static files in `public/` (served from `/`, copied as-is to `dist/`):

- `logo-mark.svg`: isometric red brick with studs and a wheel; shown above the title in the main menu
  (`#menu-logo` in `index.html`).
- `favicon.svg`: the same mark on a dark rounded square (modern browsers).
- `favicon.ico`: 16/32/48 px PNG-in-ICO fallback (Safari, old browsers, default `/favicon.ico` requests).
- `apple-touch-icon.png`: 180×180 full-bleed version for iOS home screens.

All three are linked from `index.html`.

The SVGs are hand-written. The `.ico` and the apple-touch PNG are rasterised from `favicon.svg` and must be
regenerated when the SVG changes (draw it on a canvas at 16/32/48/180 px, fill `#1a1f2b` under the 180 px one,
and pack 16/32/48 into an ICO). Edit the SVG to change colours; the palette matches
the in-game block (`#d9453b`) and the HUD (`#1a1f2b`).

## UI font

The UI uses **Orbitron** (variable), imported in `main.ts` from `@fontsource-variable/orbitron` and applied on
`html, body` in `index.html` (`button`/`input` inherit it). Orbitron is wide: keep font sizes small and buttons
`white-space: nowrap` so the HUD does not wrap. Text inside the 3D scene does not use it.

## Conventions

- English for all in-game text; kebab-case file names.
- Shared geometries/materials are created once in `part-defs.ts`; never dispose them per instance.

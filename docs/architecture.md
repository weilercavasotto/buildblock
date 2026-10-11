# Architecture

## Layout

```
src/
  main.ts                      Bootstrap: renderer, scene, lights, mode switching, main loop
  types.ts                     Part, Vec3, cell helpers
  constants/                   Design tokens and tunables (colours, spacing, typography, physics, text); see constants.md
  scene/sky.ts                 Sky dome: gradient + procedural clouds drifting with the wind (shader)
  styles/main.css              All CSS, using only the tokens published by constants/theme.ts
  frame-limiter.ts             Caps rendering at 60 FPS (decides, per animation callback, whether to render)
  save.ts                      Named save slots in localStorage
  menu/menu-scene.ts           Main-menu background: random car, autopilot, orbiting camera
  menu/random-build.ts         Random car generator
  ../vite.config.ts            Injects `__APP_VERSION__` (from package.json); typed in src/env.d.ts
  ui/confirm-dialog.ts         Reusable modal confirmation: confirmDialog(options) -> Promise<boolean>
  ui/menu.ts                   Main menu and saved-games panel (DOM bound to index.html)
  parts/part-defs.ts           Visuals (meshes/materials) of every part
  build/grid.ts                Data model: the set of placed parts
  build/history.ts             Undo/redo: snapshot history of grid edits (one step per user action)
  build/build-mode.ts          Mouse picking, ghost preview, place/remove
  play/physics-world.ts        Grid -> Rapier bodies/joints, scenery, stepping and sync
  play/vehicle-controller.ts   Keyboard -> wheel motors
  ui/zoom-control.ts           Zoom buttons + slider (top-right), in sync with the mouse-wheel zoom
  ui/fps-counter.ts            FPS readout (top-right), counted per rendered frame, toggled with F3
  ui/hud.ts                    Top-left buttons, top bar and hotbar visibility (DOM bound to index.html)
  ui/hotbar.ts                 Hotbar: 9 slots, selection, persistence, drag between slots
  ui/catalog-dialog.ts         Parts catalog modal: tabs, cards with 3D previews, inspector, drag to the hotbar
  ui/part-preview.ts           Shared off-screen WebGL renderer for the 3D part previews
  ui/drag-drop.ts              Pointer-based drag & drop (catalog cards, hotbar slots)
  ui/modal.ts                  Generic modal (backdrop, Esc, focus trap, key swallowing) used by help and catalog
  ui/help-dialog.ts            Help modal with tabs (opened by the top-left info button or H)
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
- **`History`** (`src/build/history.ts`) — undo/redo as snapshots of the grid (parts are never mutated, so snapshots
  share the objects). `begin()` takes a checkpoint, `commit(checkpoint)` pushes it as ONE step if the grid changed
  (detected with a mutation counter), `run(edit)` wraps both. `BuildMode` uses it for each press (place), removal and
  paint stroke (committed when the stroke ends); `main.ts` for **Clear**. `undo()`/`redo()` restore snapshots with
  `Grid.load`, so the autosave and the meshes follow. A new edit clears the redo stack; at most `HISTORY.maxSteps`
  steps are kept; `clear()` runs when another creation is loaded or created. The Undo/Redo buttons (in `#top-bar`,
  shown only while building) are driven by `Hud.setHistoryState`; `main.ts` handles `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`
  and `Ctrl/Cmd+Shift+Z` (ignored while a stroke is in progress and outside build mode).
- **`BuildMode`** — raycasts against placed parts and the ground plane, picks the nearest hit and derives
  a target part (blocks go on the clicked face's neighbour cell; wheels only on side faces). The left button places on
  press; with the block tool, holding it and moving **paints** blocks (a `Stroke`): the pointer ray is intersected with
  the plane of the face where the stroke began (not with the new blocks, which would make it grow towards the camera),
  the layer coordinate stays fixed, cells between two pointer events are interpolated, `Grid.addMany` adds them with a
  single change notification, and cells farther than `BUILD.maxPaintDistance` from the start are ignored. The stroke
  ends on release (also outside the canvas or on window blur). Distinguishes
  a right click (remove) from a right drag (pan) by pointer movement (< `BUILD.clickMaxDistance`). Owns the `group` of build meshes and hides it
  during Play.
- **`part-defs`** — shared geometries/materials, `createPartObject(part, ghost?)` and
  `faceQuaternion(face)` (maps the cylinder's Y axis to the axle). Used by build mode, ghost and Play.
- **`PhysicsWorld`** — see [physics.md](physics.md).
- **`VehicleController`** — see [physics.md](physics.md).
- **`ZoomControl`** (`src/ui/zoom-control.ts`) — zoom is the camera's distance to the orbit target. The limits are
  applied to `OrbitControls.minDistance/maxDistance`, so the wheel, pinch and the control itself share them. The slider
  is logarithmic (equal steps = equal ratio; top = closest) and the label (inside the bar, above the slider) is the
  zoom as a percentage: default distance divided by the current one (`100%` = default view). It listens to the controls' `change` event (wheel, damping, the camera following the car), so mouse zoom moves
  the slider; slider/buttons move the camera along its line of sight (`setDistance`). The slider value is not rewritten
  while it is being dragged, and the control releases keyboard focus after a click so the arrow keys keep driving.
  Hidden in the menu (`main.ts` calls `setVisible` and `sync()` together with the HUD). The top-right `#corner` stacks
  it under the FPS counter; inside, three same-width `.zoom-panel`s are stacked: `+`, `#zoom-bar` (percentage label +
  slider) and `−`.
- **`FpsCounter`** — counts frames over `FPS_COUNTER.updateInterval` and colours the number by threshold; the first
  window (shader compilation) is discarded. `main.ts` calls `frame(elapsed)` every frame and toggles it on F3.
- **Camera controls** (`main.ts`) — `OrbitControls.mouseButtons = { LEFT: null, MIDDLE: ROTATE, RIGHT: PAN }`: the left
  button is reserved for placing, the middle rotates, the right pans; scroll zooms. A `mousedown` handler
  prevents the browser's middle-click autoscroll on the canvas.
- **`Hud`** — wires the buttons in `index.html` and decides what is visible. Three groups: `#top-left` (Menu and Help
  buttons), `#top-bar` (top centre: Undo, Redo, a divider, Clear and Play/Stop) and `#hotbar` (bottom: the hotbar).
  Menu: nothing is shown. Build: everything. Play: `#top-left` and a `#top-bar` reduced to Stop (the elements marked
  `.build-only` are hidden) while `#hotbar` is hidden. The old instruction card was replaced by the help button.
- **`openHelpDialog` / `toggleHelpDialog`** (`src/ui/help-dialog.ts`) — modal opened by the info button (top-left,
  shown while building/playing) or the `H` key. One tab per topic, rendered from `HELP_TABS`
  (`src/constants/help-content.ts`: sections of rows with key caps + text; edit that file to change the content).
  Keyboard: `Esc` or `H` close, `Tab` cycles inside the dialog, `←/→/Home/End` change tab; the last tab is remembered.
  The shared behaviour lives in `openModal` (below). Text is set with `textContent`.
- **`openModal`** (`src/ui/modal.ts`) — generic modal used by the help and the catalog (the confirm dialog has its own
  smaller implementation). It builds the `.dialog-backdrop` / `.dialog`, closes on `Esc`, on extra `closeCodes` (the key
  that opens it) and on a click on the backdrop, traps `Tab` among the focusable elements, restores the previous focus,
  swallows every other key (capture-phase listener + `stopPropagation`, so the game under it does not react: no
  hotbar selection, undo or driving) and allows a single modal at a time. Callers pass `build()` (fills the dialog and
  returns the element to focus), optional `onKeyDown` and `onClose`.
- **`Hotbar`** (`src/ui/hotbar.ts`) — `HOTBAR.slots` (9) slots, each a part type or empty; the selected slot is what
  `BuildMode.setTool` places (`null` = place nothing). `main.ts` wires `hotbar.subscribe(part => build.setTool(part))`
  and the keys `1`–`9` / `B`. Slots are persisted in `localStorage` (`STORAGE.hotbarKey`, per browser, not per save).
  Drag a slot onto another to swap, out of the bar or right-click to empty it; `add(type)` puts a part in the slot that
  has it, the first empty one, or replaces the selected one; `onLayoutChange` lets the catalog refresh its inspector.
  The slot pictures come from `part-preview`.
- **`openCatalog`** (`src/ui/catalog-dialog.ts`) — the parts catalog (modal): tabs = "All" + `PART_CATEGORIES`, one card
  per part of `PART_ORDER`/`PART_INFO` (`src/constants/part-catalog.ts`). Hovering (or focusing) a card spins its
  preview (`startSpin`); clicking opens the **inspector** on the right (spinning preview, description, properties, tips,
  "Add to hotbar"/"Select in hotbar"); dragging a card onto a slot assigns it. While it is open the hotbar is raised above
  the backdrop (`#hotbar.over-dialog`, `Z_INDEX.hotbarOverDialog`) so it stays a drop target. `B` closes it too.
- **`part-preview`** (`src/ui/part-preview.ts`) — ONE shared off-screen `WebGLRenderer` (browsers cap WebGL contexts) that
  draws any part (built with `createPartObject`, centred and framed from its bounding sphere, lit like the game) into any
  2D canvas: `renderPartPreview(type, canvas, angle)`; `startSpin` animates it with `requestAnimationFrame` and returns
  a stop function. Per-part resting angles are in `PART_INFO[type].previewAngle`; sizes/speeds in `PREVIEW`.
- **`drag-drop`** (`src/ui/drag-drop.ts`) — pointer-event drag & drop (not the HTML5 API, flaky with canvases/touch): a
  press that moves more than `DRAG.threshold` px shows a ghost image and highlights the slot under the pointer
  (`[data-slot]`, `.drop-hover`); without movement it is a click. Drop targets are the hotbar slots.
- **`confirmDialog`** (`src/ui/confirm-dialog.ts`) — reusable modal: `await confirmDialog({ title, message,
  confirmLabel, cancelLabel, danger })` resolves `true` on confirm and `false` on cancel, Escape or a click on the
  backdrop. It builds its DOM on demand (`.dialog-*` classes in `main.css`, `role="alertdialog"`, `aria-modal`), traps
  Tab between its two buttons, restores the previous focus, and sets all text with `textContent`. With `danger: true`
  the confirm button is red and **Cancel gets the initial focus**, so pressing Enter never deletes by accident. Only
  one dialog is open at a time (opening another cancels the first). Used to confirm deleting a save; strings are in
  `TEXT.menu.deleteDialog`.
- **`Menu`** — title screen and saved-games panel (load / delete / new). Uses `save.ts`; names are
  inserted with `textContent`.
- **`save.ts`** — `listSaves`, `getSave`, `createSave`, `updateSave`, `deleteSave`; handles the one-time
  migration from `blocklab.v1`.
- **`main.ts`** — owns the mode state (`physics`/`vehicle` are non-null only in Play), the `R` restart and
  the animation loop (camera follow in Play).

## Frame limit

`requestAnimationFrame` fires at the display's refresh rate, so `main.ts` asks `FrameLimiter.shouldRender(now)` at
the top of every callback and returns early when it says no. The limiter schedules frames on a fixed timeline
(`next += 1000 / targetFps`) with a small tolerance (`FRAME_LIMIT.toleranceMs`), so the average stays at 60 even when
the refresh rate is not a multiple of 60 (75 Hz renders 4 of every 5 callbacks; a naive "wait one interval since
the last frame" would drop to 37.5 FPS). After a stall (first frame, hidden tab) the timeline restarts instead of
rendering a burst of catch-up frames. Skipped callbacks do not touch the timer, so the next rendered frame's `dt`
covers the whole gap and physics (fixed 1/60 s steps) stays in sync. The FPS counter only counts rendered frames.
It cannot raise the frame rate: on a 30/50 Hz display the game runs at that rate.

## Sky

`Sky` (`src/scene/sky.ts`) is a large inverted sphere with a `ShaderMaterial`, shared by the menu, build and
play modes (one Three.js scene). It has no textures:

- a gradient from `COLORS.scene.sky` at the horizon (also the fog colour, so the far floor melts into the sky)
  to `COLORS.scene.skyZenith`;
- **blocky "voxel" clouds** to match the game's look: the view direction is projected on a flat cloud layer that
  is split into square cells (`SKY.cloudScale` cells per unit). Each cell is either fully filled or empty,
  decided by thresholding fractal noise sampled at the cell centre (`SKY.coverage`, `SKY.clumpiness`).
  Filled cells get thin seams and a shaded bevel on the lower-right edges where the neighbour is empty, so they
  read as chunky bricks;
- movement: the cell grid is offset by `SKY.wind * time`, so whole blocks glide with the wind (the pattern
  changes very slowly through `SKY.evolveSpeed`, so cells rarely pop in or out);
- anti-shimmer: far from the camera cells get smaller than `SKY.minCellPixels`, so the shader blends to a smooth
  density there; clouds also fade out near the horizon;
- `update(elapsed, camera.position)` runs every frame and keeps the dome centred on the camera (the sky never gets
  closer). The dome radius must stay below `CAMERA.far`.

All parameters are in `SKY` (`src/constants/game.ts`) and the colours in `COLORS.scene`. The default camera
(`CAMERA.startPosition`) is low enough for the sky to show in the upper part of the screen.

## Branding assets

Static files in `public/` (served from `/`, copied as-is to `dist/`):

- `logo-mark.svg`: isometric red brick with studs and a wheel; shown above the title in the main menu
  (`#menu-logo` in `index.html`, styled in `main.css`).
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
`html, body` in `src/styles/main.css` (`button`/`input` inherit it). Font tokens live in `src/constants/typography.ts`. Orbitron is wide: keep font sizes small and buttons
`white-space: nowrap` so the HUD does not wrap. Text inside the 3D scene does not use it.

## Conventions

- English for all in-game text; kebab-case file names.
- Shared geometries/materials are created once in `part-defs.ts`; never dispose them per instance.

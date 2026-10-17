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
  parts/wheel-model.ts         Geometry of the wheel: tire (lathe + tread lugs), rim (lip, spokes, hub, nuts; open between the spokes)
  build/grid.ts                Data model: the set of placed parts
  build/history.ts             Undo/redo: snapshot history of grid edits (one step per user action)
  build/build-mode.ts          Mouse picking, ghost preview, place/remove
  play/physics-world.ts        Grid -> Rapier bodies/joints, scenery, stepping and sync
  play/vehicle-controller.ts   Keyboard -> wheel motors
  ui/zoom-control.ts           Zoom buttons + slider (top left, under Menu), in sync with the mouse-wheel zoom
  ui/fps-counter.ts            FPS readout (top right), counted per rendered frame, toggled with F3
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
  type: PartType;
  cell: Vec3;
  face?: Vec3; // wheels and engines: outward normal of the block face it is mounted on
  studs?: Vec3; // orientation of EVERY part: where its local up points (default up)
  spin?: number; // ... and quarter turns around it (default 0); only turns the shape can tell apart are stored
}
```

A wheel or engine at `cell` with `face` is attached to the block at `cell - face`.

**Every part is oriented the same way** (24 turns): `studs` is the direction its local +Y points in and `spin` quarter turns around
it, a rotation matrix (`matrixOf`, `applyMatrix` in `types.ts`) whose columns say where its local axes go. What the local axes mean
depends on the part: a block's studs are its up, a wheel's axle is its local +X (`axleOf`), a large wheel's too and it fills the
2 x 2 cells that its local +Y and +Z lead to (`partCells`, `partCentre`), an engine's front is its local +Z (`frontOf`). Of the 24
orientations only the ones the shape can tell apart are stored (`canonicalOrientation` in `parts/orientation.ts`: a square block
has 6, a wheel 6, an L bracket, an engine and a large wheel 24). `face` only says where a part is mounted and is independent of how it is turned.
Saves made before (a wheel's `rotation` / `pitch`, a large wheel's `rotation`, an engine's `front`) are converted by `legacyOrientation` when they are loaded
(`SAVE.format`, `Grid.load(parts, legacyFormat)`).

## Modules

- **`Grid`** — `Map` keyed by `"x,y,z"` (`cellKey`, rounded; each part under its own `cell`, its centre). `get(cell)` finds the part centred there, `all()` returns each part once, `canPlace` tests the part's box against the others and the build area (see *Studs & placement* below; the **large wheel** occupies the 4 cells of `partCells`, `partCentre` is where its model and body are centred), `remove` takes the part's `cell` (a block's removal also removes the wheels on it, `isWheelType`). `canPlace` enforces: free cell, `y >= 0`, `x, z` within `buildRange(cells)` (`-n/2 … n/2 - 1`) and `0 <= y <= n - 1` for the current game's grid size (`Grid.setSize`; inside the floor grid, whose squares are exactly one cell: lines at n ± 0.5), and for wheels a
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
- **Cursor modes** (`CursorMode` in `types.ts`, `CURSOR_MODES` in `constants/cursor-modes.ts`) — `build`, `inspect`,
  `paint`, `remove` (keys I = inspect, B = build, E = paint, R = remove). `main.ts` `setCursorMode` applies one mode everywhere: `BuildMode.setMode`, the highlighted
  button of the top bar (`Hud.setCursorMode`; the buttons are created from `CURSOR_MODES`: key cap + an SVG icon taken from
  the `icon` field, with the name in the tooltip and `aria-label`), `body[data-cursor-mode]`
  (cursor shape in CSS) and `controls.mouseButtons` (`LEFT` is always `null`: a left
  drag never moves the camera; in inspect mode it draws a selection box). Choosing a hotbar slot (`Hotbar.onUserSelect`) goes back to build.
- **Rotation of the part to place** — `BuildMode.orientation` (the same for every part, see the data model) is given to the part placed
  (`canonicalOrientation` of it is stored) and to every block painted; `rotate(±1)` (keys `A`/`D`, the top-bar buttons, wired in
  `main.ts` / `Hud.setRotateEnabled`) turns it around the vertical axis and `tilt(±1)` (`W`/`S`, `↑`/`↓`) around the screen's left-right axis
  (`screenRight()`; if the part's main direction (`mainAxisOf`: studs, axle or front) lies along that axis, the key rolls it around the other
  horizontal axis instead), both through `turnOrientation(..., reduce = false)`, so the ghost keeps every quarter turn even for a part that looks
  the same afterwards. They are only active when `canRotate` (Build mode, a part with `PART_INFO[type].rotatable`); the orientation
  resets when the selected part changes. The placement ghost is **one persistent object**, built unturned, whose quaternion is
  animated by `BuildMode.update(dt)` (called every frame from the main loop): `ghostQuat` eases towards `ghostTargetQuat`
  (`ROTATION.smoothing`) with a slerp. `rotate` / `tilt` re-run the hover with the last pointer position so the ghost reacts without moving the mouse.
- **`BuildMode`** — raycasts against placed parts and the ground plane, picks the nearest hit and derives
  a target part (blocks go on the clicked face's neighbour cell; wheels only on side faces). In **build** mode the left button places on
  press; with the block tool, holding it and moving **paints** blocks (a `Stroke`): the pointer ray is intersected with
  the plane of the face where the stroke began (not with the new blocks, which would make it grow towards the camera),
  the layer coordinate stays fixed, cells between two pointer events are interpolated, `Grid.addMany` adds them with a
  single change notification, and cells farther than `BUILD.maxPaintDistance` from the start are ignored. The stroke
  ends on release (also outside the canvas or on window blur). In **remove** mode the left button removes the part under
  the pointer on press and keeps erasing while dragging (an `Erase`, committed to the history as one step; a new removal
  needs `BUILD.clickMaxDistance` px of pointer movement, so a stack is not drilled through). In **inspect** mode a left
  *click* (no movement) calls `select(part)` and a left *drag* draws a selection box (`.selection-marquee`, a fixed `div`) and on
  release `selectMany(partsInRect(...))` selects every part whose `partBounds`, projected to the screen, touches the box (x-ray: parts
  hidden behind others count); Shift adds to the selection (a Shift click toggles a part). The selection is a list (`selectedParts`;
  `selected` is the part when exactly one is selected), `Grid.moveParts(parts, delta)` moves the selection as a group (plus what is mounted on its blocks): the group is taken out of the grid and put back from the bottom up, each part through `canPlace(part, false)` (build area, overlap and host block, but no support needed, so a lifted group may hang), or nothing changes. `BuildMode.moveSelectionBy(direction)` (inspector buttons, `MOVE` steps, directions snapped to the world axes nearest to the camera's right / forward) and a drag that starts on a selected part (`dragMove`: the pointer slides on a horizontal plane, or a vertical one with Shift, and the selection follows in `MOVE` steps, one undo step) both use it, keeping the selection on the moved parts (`moving` stops `rebuild` from dropping them). Each selected part gets a yellow outline
  (`build/outline.ts`: wireframe + translucent fill around `partBounds(part)`), the listeners registered with
  `onSelectionChange` are told, and `rebuild()` (every grid change) re-validates the selection (dropped if the part is
  gone, refreshed otherwise). Outside build mode the part under the cursor gets a hover outline (white / red). A right
  click removes (build and remove modes) and a right *drag* pans, told apart by pointer movement
  (< `BUILD.clickMaxDistance`). Owns the `group` of build meshes and hides it during Play (which also clears the
  selection).
- **`wheel-model`** (`src/parts/wheel-model.ts`) — the wheel's geometry, built once and shared by all wheels, all around the Y
  axis (the axle; `createPartObject` turns it onto the real axle). A **tire** (a `LatheGeometry` of the rubber ring with flat
  sidewalls, rounded shoulders and a flat tread, plus staggered tread lugs) around a **rim** (lip ring, 5 spokes, hub cap
  and 6-sided lug nuts, merged into one light-metal mesh), open between the spokes (a braked wheel shows its brake disc there). Each wheel is
  2 meshes (`mergeGeometries`), ~2k triangles. The tire is `R - lugHeight` thick plus the lugs, so nothing sticks out
  of the physical radius `WHEEL.radius`; the placement ghost is the same model made translucent. Every measure is in `WHEEL_VISUAL` (`constants/game.ts`), colours in `COLORS.part`
  (`tire`, `rim`), rim roughness/metalness in `ROUGHNESS` / `METALNESS`.
- **`part-defs`** — shared geometries/materials, `createPartObject(part, ghost?)` and
  `faceQuaternion(face)` (maps the cylinder's Y axis to the axle). Used by build mode, ghost and Play.
  A block's mesh **fills its whole cell** (`BLOCK_VISUAL_SIZE = CELL_SIZE`, the same as its collider), so neighbouring blocks
  touch with no gap. Each block still reads as a separate brick through its dark outline (`LineSegments` of the cube's edges),
  drawn `BLOCK_EDGE_SCALE` (1.004) larger than the cube so it sits just outside the faces and stays continuous instead of
  z-fighting; the faces use `polygonOffset` for the same reason. The placement ghost is the part itself, translucent (`ALPHA.ghost`, red when it cannot be placed: `COLORS.part.ghostInvalid`; `makeGhost`) and `GHOST_BLOCK_SCALE` smaller so it
  does not z-fight with the faces of its neighbours, and the sun's shadow has a `bias`/`normalBias` (`LIGHTS`) against
  self-shadowing noise on faces that now touch.
- **`PhysicsWorld`** — see [physics.md](physics.md).
- **`VehicleController`** — see [physics.md](physics.md).
- **`ZoomControl`** (`src/ui/zoom-control.ts`) — zoom is the camera's distance to the orbit target. The limits are
  applied to `OrbitControls.minDistance/maxDistance`, so the wheel, pinch and the control itself share them. The slider
  is logarithmic (equal steps = equal ratio; top = closest) and the label (inside the bar, above the slider) is the
  zoom as the slider position in percent (`0%` = farthest, `100%` = closest; the camera distance itself is unchanged). It listens to the controls' `change` event (wheel, damping, the camera following the car), so mouse zoom moves
  the slider; slider/buttons move the camera along its line of sight (`setDistance`). The slider value is not rewritten
  while it is being dragged, and the control releases keyboard focus after a click so the arrow keys keep driving.
  Hidden in the menu (`main.ts` calls `setVisible` and `sync()` together with the HUD). `#zoom` is fixed at the top left, right
  under the home button; inside, three same-width `.zoom-panel`s are stacked: `+`, `#zoom-bar` (percentage label +
  slider) and `−`.
- **`FpsCounter`** — counts frames over `FPS_COUNTER.updateInterval` and colours the number by threshold; the first
  window (shader compilation) is discarded. `main.ts` calls `frame(elapsed)` every frame and toggles it on F3.
- **Camera controls** (`main.ts`) — `OrbitControls.mouseButtons = { LEFT: null, MIDDLE: ROTATE, RIGHT: PAN }`: the left
  button is reserved for placing, the middle rotates, the right pans; scroll zooms. A `mousedown` handler
  prevents the browser's middle-click autoscroll on the canvas. **The camera cannot go under the terrain:**
  `maxPolarAngle` only keeps the camera above its orbit target, but panning moves the target itself, so after every
  `controls.update()` `keepCameraAboveGround` clamps the target to the ground (`GROUND_Y`) and the camera to
  `GROUND_Y + CAMERA.minHeight` and re-aims it (it does nothing while the limits hold).
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
- **Painting** — `Part.color?` (`#rrggbb`, validated by `isHexColor`), allowed only when `PART_INFO[type].paintable` (block yes, wheel no). `Grid.paint(cell, color|null)` replaces the part (no-op for unpaintable/invalid/unchanged) and `Grid.load` strips bad paint from saves. `createPartObject` takes per-colour cached materials (edge = colour × `PAINT_EDGE_FACTOR`), so Play shows the paint too. Painting happens only in the **paint** cursor mode: `PaintPalette` (`ui/paint-palette.ts`, `#paint-palette` under the top bar, colours in `PAINT_COLORS`) tells `BuildMode.setPaintColor`; a left click/drag paints (same stroke machinery as remove, one undo step). The inspector only displays the colour; the catalog never paints.
- **Suspension** — `Part.suspension?` (0-100, wheels only: `PART_INFO[type].hasSuspension`; missing = `SUSPENSION.defaultStrength`, read with `suspensionOf`). `Grid.setSuspension(cell, strength)` replaces the part (default stored as "not set"; no-op for parts without suspension or unchanged) and `Grid.load` sanitises saves. The only UI is the slider in `PartInspector` (`onSuspension`, committed on release through `history.run`); `PhysicsWorld` builds the spring from it (see physics.md).
- **Studs & placement** — structural parts have studs on a face of each box and dark round sockets on the opposite face, the underside that takes the studs of another part (`STUD`, `COLORS.part.socket`, `socketsMesh` in `part-defs.ts`; drawn as one merged mesh by `createPartObject`, no picking). `Part.cell` is the part's centre in cell units: x / z in steps of `STUD.pitch` and a height given by what it rests on, so coordinates are not always integers (use `cellKey`, which rounds, and the 0.001 `EPS` of `parts/part-geometry.ts`). The `Grid` has no cell index any more: `partBox(part)` (a block 1³, a plate 1 × 0.2 × 1, a wheel its cell, a large wheel its 2 × 2 cells) and `boxesOverlap` decide what is in the way, `studsEngaged(a, b)` counts the studs of two stacked parts, `Grid.canPlace` requires a block or plate to be on the ground or have `engagedStuds > 0`, and `Grid.linkedParts(part)` (stud links) is what welds: `connectedBlockParts` and the `PhysicsWorld` flood-fill both use it, so side-by-side blocks are separate bodies. `BuildMode.structuralTarget` turns a pick into a position (ground / on top / under / beside), snapping to the pitch and clamping the footprint within one stud column of the part it rests against; strokes keep the lattice they start on. `Grid.load` converts old plates (a thin slab inside a cell, with `face` / `layers`) to flat plates and drops standing ones.
- **Orientation** — see the data model: `Part.studs` + `Part.spin` for every part. `partBox` gives a plate its thin side along the studs, `studsEngaged` only links parts whose studs point the same way and that touch across that axis, `createPartObject` builds every part in its own frame and turns the root by `orientationQuaternion` (a wheel carries the turn in its pivot instead: its Rapier body stays unturned and moves the whole object, so it would lose a turn on the root). `BuildMode` keeps the orientation of the part to place, `structuralTarget` places an oriented structural part against the picked face (beside a part with the studs up it still goes level with the bottom), and wheels and engines are mounted on the picked block face turned as the user chose.
- **Structural shapes** — `SHAPES` (`constants/part-shapes.ts`) gives every structural `PartType` (`block`, `blockQuarter`, `blockHalf`, `blockLarge`, `plate`, `plateQuarter`, `plateHalf`, `plateLarge`, `plateLargeHalf`, `bracket`, `bracketSmall`, `bracketLarge`) a list of boxes (each with its own studs direction; an L bracket is a flat plate plus a wall plate with studs on its outside) and `spins`. `Part.cell` is the centre of the first (anchor) box. `parts/orientation.ts` turns `Part.studs` + `Part.spin` (quarter turns around the studs, only for shapes where it matters) into a matrix; `parts/part-geometry.ts` gives `partBoxes` (world boxes with studs direction), `partBox` (bounding box), `partsOverlap` and `studsEngaged` (summed over every pair of boxes with equal studs direction that touch). `isStructural(type)` is what is part of the body, `partVolume` (sum of the boxes) makes a plate's mass a fraction of a block's; wheels mount only on the plain `block`.
- **Weight** — `Part.weight?` (blocks only: `PART_INFO[type].hasWeight`; an integer `WEIGHT.min`-`WEIGHT.max`, missing = `WEIGHT.default`, read with `weightOf`). `Grid.setWeight(cell, weight, connected?)` replaces the block (or every welded block, one `emit`), `connectedBlockParts` / `connectedWeight` give the rigid body's blocks and total weight, and `Grid.load` sanitises saves. The only UI is the slider (and "apply to connected" button) in `PartInspector` (`onWeight` through `history.run`; the slider is the shared `sliderSection`, like the suspension's). `PhysicsWorld` multiplies each block collider's density by `weightMass(weight)`.
- **Flying** — see physics.md: `VehicleController.pilot` (W / S pitch, A / D roll, Q / E yaw, only when no autopilot) is copied by `main.ts` into `PhysicsWorld.pilot` every frame; `PhysicsWorld.airborne` / `fly` act on the bodies that carry wheels or thrusters (`FLIGHT` in `constants/physics.ts`).
- **Thruster** — `PartType` `'thruster'`: like the engine and the turbo, a compact unit mounted on a block face (`isMountedType`, `isCompactMounted`, `THRUSTER_BODY` in `MOUNTED_BODY`, `Grid.thrustersOnBody`), freely oriented, any face, `Part.power` as its thrust (the inspector shows it as *Thrust*; `Grid.setPower` applies "to the thrusters on this body"). Drawn by `createThrusterModel` (`parts/thruster-model.ts`, `THRUSTER_VISUAL`: a jet along local z, front +z, bell and `thrusterTip` at the back; colours `COLORS.part.thruster*`, paint replaces the tube). Space fires it (the brake's key, `VehicleController.thrusting`). See physics.md and `PlayEffects.fireThruster` (the orange `FX.thrustFlame`).
- **Turbo** — `PartType` `'turbo'`: like the engine, a compact unit mounted on a block face (`isMountedType`, `isCompactMounted`, body `TURBO_BODY` in `MOUNTED_BODY`, which `partCentre` / `partBox` use; `Grid.mountedOn` / `turbosOnBody` / `mountedOfTypeOnBody`), freely oriented, any face of a block, with `Part.power` as its boost (the same 1-10 `clampPower` / `powerOf`; `Grid.setPower` applies "to the turbos on this body"; the inspector shows it as *Boost*). Drawn by `createTurboModel` (`parts/turbo-model.ts`, `TURBO_VISUAL`, bottle along local z, nozzle at the back `turboNozzleTip`; colours `COLORS.part.turbo*`, paint replaces the bottle). See physics.md for the boost and `PlayEffects` for the flame.
- **Brake** — `PartType` `'brake'` exists only as a catalog / hotbar part: it is never placed in the grid, it sets `Part.brake` (1-10, wheels only: `PART_INFO[type].hasBrake`, `BRAKE`, `brakeOf`) with `Grid.setBrake(cell, strength | null, wholeBody?)` (like `setTire`; `Grid.load` sanitises it). `BuildMode` handles the tool apart from placement: on hover `setBrakeGhost` shows the brake model (`createBrakeModel`, `parts/brake-model.ts`, `BRAKE_VISUAL`, `brakePose`) on the wheel under the pointer, red when it already has one; a click runs `setBrake` through `history.run`. `createPartObject` draws a braked wheel's disc inside the wheel object (the rim is open between the spokes, so it shows through); in Play the caliper is a separate object (`createCaliperObject`) that follows the hub body, so it stays on the suspension while the wheel spins. The inspector (`PartInspector.brakeSection`) shows the strength slider, "apply to the braked wheels on this body" and **Remove brake**. See physics.md.
- **Engine** — `PartType` `'engine'`: not structural, a separate unit mounted on a block face like a wheel (`face` = outward normal, host at `cell - face`, `isMountedType`, `Grid.mountedOn`; `Grid.remove` of the host removes it). its orientation (`frontOf`: its local +Z turned by `Part.studs` / `Part.spin`) says where it pushes, `Part.power?` (`ENGINE`, `powerOf`, `Grid.setPower` / `enginesOnBody`, `PartInspector` slider with "apply to the engines on this body"). Its body is `ENGINE_BODY` (`partCentre` puts it against the host, `partBox` sizes it), drawn by `createEngineModel` (`parts/engine-model.ts`, tuned through `ENGINE_VISUAL` / `ENGINE_FAN`: a V engine in its own frame, front +z, heads +y) which `createPartObject` turns like any part; colours `COLORS.part.engine*` (aluminium, rim, dark parts; paint replaces the aluminium). `Grid.engineDrive` (saved as `SaveGame.engineDrive`, read with `engineDriveOf`, which also accepts the old name `motorDrive`; true for new games, false for older saves) decides whether wheels need an engine; see physics.md. `Hud.setNotice` shows the "no engine" message.
- **Effects** (`FX`, `COLORS.fx` in `constants/`) — *Bounce*: a part the player has just placed (only `BuildMode`'s own `grid.add` / `addMany`, flagged by `placing`; a load, an undo or a redo do not bounce) squashes and stretches like jelly for `FX.bounce.duration` (`BuildMode.animateBounces`, a damped cosine on the vertical scale of the part's holder group, which is also what raycasts find through `userData.part`). *Pop*: a part the player removes (right click, the remove mode, the inspector's button, Clear; through `BuildMode.removeAnimated`, which flags the removal) swells a little and shrinks away in `FX.pop.duration` (`animateRemovals`: on the rebuild the holders of the parts that are gone move to `dyingGroup`, out of the raycast group, so they cannot be picked; the wheels and engines that go with a block pop too; undo / redo / load do not). *Play*: `PhysicsWorld` owns a `PlayEffects` (`play/play-effects.ts`) fed with its wheels and engines and with `PhysicsWorld.level` (0-1, from `VehicleController.level`): clods of earth thrown up by a wheel that touches the ground (a downward ray against the ground collision group) and moves or spins, more (and bigger, livelier clods) the faster and the more it slips, smoke puffs from each engine's exhaust (more, bigger and gentler the faster the vehicle goes; the `FX` values are the strongest effect, at `FX.dust.maxSpeed` / `FX.smoke.maxSpeed`, down to `scaleMin` of the size), and the shaking of the engines (a high-frequency offset and tilt of their object, stronger while driving). Particles are instanced meshes (`play/particles.ts`, `ParticleSystem`: one draw call, shrinking instead of fading). The menu's background car shows them too.
- **Tires** — `Part.tire?` (an integer `TIRE.min`-`TIRE.max`, 0 speed … 100 traction, wheels only: `PART_INFO[type].hasTire`; missing = `TIRE.default` 50, read with `tireValueOf`; `tireOf` interpolates friction / speed / torque between the `TIRE.points`). `Grid.setTire(cell, value, wholeBody?)` replaces the part, or every wheel on the same body (`wheelsOnBody`: the wheels on the host block of the wheel and on all blocks welded to it; one `emit`) (default stored as "not set"; no-op when unchanged) and `Grid.load` sanitises saves and converts the old named tires (`legacyTireValue`). The only UI is the slider in `PartInspector` (`onTire` through `history.run`, the shared `sliderSection`, whose `applyAll` option adds the "apply to the others" button used by the weight and the tire); `PhysicsWorld` uses the tire's friction and passes its speed / torque multipliers to `VehicleController` via `WheelDrive`.
- **Previews** — `part-preview.ts` draws every preview with one shared off-screen renderer. By default each part is framed to fill the canvas; `{ common: true }` (catalog cards and catalog inspector) frames all parts at the distance that fits the biggest one (`spinRadius`), so relative sizes show. `{ color }` paints the preview.
- **`LoadingScreen`** (`src/ui/loading-screen.ts`, markup `#loading` in `index.html`, `z-index` above everything, blocks input) — overlay with the brand mark, the name, a progress bar and a status label. `run(steps)` shows it, runs each `{ label, run }` step (the bar advances after each; a paint is awaited first so the label is visible before a heavy step blocks the thread) and hides it with a fade; it stays at least `LOADING.minDurationMs` so it never flashes, and overlapping `run` calls queue. `show` / `setProgress` / `hide` are available when the steps are driven elsewhere (the boot sequence in `main.ts`). Used for: boot (Rapier init), loading / creating a game (menu → build) and Menu (build → menu). Play / Stop do not use it (they are instant and `R` restarts often); wrap them the same way if a scene ever gets heavy.
- **`PartInspector`** (`src/ui/part-inspector.ts`) — the panel in inspect mode (`#part-inspector`, `position: fixed` on the
  **right edge, vertically centred**: `top` and `bottom` are both `SIZE.hotbarReserved`, so the margins above and below
  are equal, it never reaches the top bar or the hotbar and it **fills the height between them**; when the window is
  short only the **body** scrolls: the header with the title and the × button is outside the scrolling `.inspector-body`, so it stays fixed):
  small spinning preview beside the name and category, a *Remove part* button
  (`history.run`), "This part" rows (position; for a block the size of its rigid body from `Grid.connectedBlocks` and its
  wheels from `Grid.wheelsOn`; for a wheel its host block and axle) and the properties from `PART_INFO`.
  `main.ts` calls `inspector.show(part)` from `build.onSelectionChange`, so it follows undo/redo and every other edit.
- **`Hotbar`** (`src/ui/hotbar.ts`) — `HOTBAR.slots` (9) slots, each a part type or empty; the selected slot is what
  `BuildMode.setTool` places (`null` = place nothing). `main.ts` wires `hotbar.subscribe(part => build.setTool(part))`
  and the keys `1`–`9` / `C`. Slots are persisted in `localStorage` (`STORAGE.hotbarKey`, per browser, not per save).
  Drag a slot onto another to swap, out of the bar or right-click to empty it; `add(type)` puts a part in the slot that
  has it, the first empty one, or replaces the selected one; `onLayoutChange` lets the catalog refresh its inspector.
  The slot pictures come from `part-preview`.
- **`openCatalog`** (`src/ui/catalog-dialog.ts`) — the parts catalog (modal): tabs = "All" + `PART_CATEGORIES`, one card
  per part of `PART_ORDER`/`PART_INFO` (`src/constants/part-catalog.ts`). Hovering (or focusing) a card spins its
  preview (`startSpin`); clicking opens the **inspector** on the right (spinning preview, description, properties, tips,
  "Add to hotbar"/"Select in hotbar"); dragging a card onto a slot assigns it. While it is open the hotbar is raised above
  the backdrop (`#hotbar.over-dialog`, `Z_INDEX.hotbarOverDialog`) so it stays a drop target. `C` (the modal's `closeCodes`) closes it too.
- **`part-preview`** (`src/ui/part-preview.ts`) — ONE shared off-screen `WebGLRenderer` (browsers cap WebGL contexts) that
  draws any part (built with `createPartObject`, centred and framed from its bounding sphere, lit like the game) into any
  2D canvas: `renderPartPreview(type, canvas, angle)`; `startSpin` animates it with `requestAnimationFrame` and returns
  a stop function. Every preview rests at the same angle (`PREVIEW.angle`); sizes/speeds in `PREVIEW`.
- **`drag-drop`** (`src/ui/drag-drop.ts`) — pointer-event drag & drop (not the HTML5 API, flaky with canvases/touch): a
  press that moves more than `DRAG.threshold` px shows a ghost image and highlights the slot under the pointer
  (`[data-slot]`, `.drop-hover`); without movement it is a click. Drop targets are the hotbar slots.
- **`confirmDialog`** (`src/ui/confirm-dialog.ts`) — reusable modal: `await confirmDialog({ title, message,
  confirmLabel, cancelLabel, danger })` resolves `true` on confirm and `false` on cancel, Escape or a click on the
  backdrop. It builds its DOM on demand (`.dialog-*` classes in `main.css`, `role="alertdialog"`, `aria-modal`), traps
  Tab between its two buttons, restores the previous focus, and sets all text with `textContent`. With `danger: true`
  the confirm button is red and **Cancel gets the initial focus**, so pressing Enter never deletes by accident. Only
  one dialog is open at a time (opening another cancels the first). It swallows every key press while open, so the
  game under it does not react (important now that it also appears while building). Used to confirm deleting a save
  (`TEXT.menu.deleteDialog`) and **Clear** (`TEXT.clearDialog`, asked in `main.ts`; skipped when the grid is empty;
  the clear itself is one undo step).
- **`Menu`** — title screen, saved-games panel (load / delete) and the *New game* panel (name + grid size; `onNew(name, gridCells)`). `main.ts` `setGridSize` rebuilds the floor lines and calls `Grid.setSize` before a game is loaded or created. Uses `save.ts`; names are
  inserted with `textContent`.
- **`save.ts`** — `listSaves`, `getSave`, `createSave(name, gridCells)`, `updateSave`, `deleteSave`, `gridCellsOf(save)` (`SaveGame.gridCells`, one of `GRID_SIZES`; missing = the default); handles the one-time
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
and pack 16/32/48 into an ICO). Edit the SVG to change colours. The logo is the red brand brick (`#d9453b`); the in-game blocks are a soft blue
(`COLORS.part.block`), so the logo no longer matches them on purpose (recolour the SVGs and regenerate the rasters if you
want it to). The favicon background matches the HUD (`#1a1f2b`).

## Scrollbars

The panels that can scroll (help, catalog grid and its inspector, the part inspector's body, the saved-games list) use a
**slim, styled scrollbar that always takes its own space** (`::-webkit-scrollbar` of `--space-sm` width with a
`--color-surface-divider` thumb, `scrollbar-gutter: stable`; Firefox falls back to `scrollbar-width: thin`). The OS
overlay scrollbar was painted over the content and cut buttons and texts at the right edge of the inspector. When you add
another scrolling panel, add its selector to the `:is(...)` lists at the end of `src/styles/main.css`.

## UI font

The UI uses **Orbitron** (variable), imported in `main.ts` from `@fontsource-variable/orbitron` and applied on
`html, body` in `src/styles/main.css` (`button`/`input` inherit it). Font tokens live in `src/constants/typography.ts`. Orbitron is wide: keep font sizes small and buttons
`white-space: nowrap` so the HUD does not wrap. Text inside the 3D scene does not use it.

## Conventions

- English for all in-game text; kebab-case file names.
- Shared geometries/materials are created once in `part-defs.ts`; never dispose them per instance.

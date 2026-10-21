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
- Scenery (ramps, obstacles): `SCENERY_PARTS` in `src/constants/scenery.ts`, catalog parts on one fixed body (`PhysicsWorld.buildScenery` / `addStructuralColliders`); edit that list to change them
- `src/play/`: `physics-world.ts` (grid -> Rapier), `vehicle-controller.ts` (WASD -> engines)
- `src/play/play-effects.ts` + `src/play/particles.ts`: Play effects (wheel dust, engine smoke, engine shaking; `PhysicsWorld.level` from `VehicleController.level`); the placement bounce is in `BuildMode.animateBounces`; tunables in `FX` / `COLORS.fx` (`src/constants/`)
- `src/parts/part-defs.ts`: visuals/dimensions of every part
- `src/menu/`: main-menu background (`menu-scene.ts`: random car + orbiting camera, `random-build.ts`: coupe / pickup / propeller / rocket kinds with random paint; keep new builds valid: `Grid.add` drops what does not fit, mind the stud lattice for 0.5-wide parts; the menu autopilot drives rotors, pistons and thrusters)
- `src/constants/`: design tokens and tunables (colours, spacing, typography, physics, game, text); `theme.ts` publishes them as CSS variables
- `src/styles/main.css`: all CSS, tokens only; buttons get their raised look from the **Button skin** section at the end (add a new button's selector to its lists; tokens `BUTTON`, `COLORS.button`, `OVERLAYS.sheen`)
- `src/frame-limiter.ts`: 60 FPS cap (`FRAME_LIMIT`); the main loop returns early when `shouldRender` is false
- `src/build/history.ts`: undo/redo (`begin`/`commit`/`run`); wrap every user edit of the grid in one step (Ctrl/Cmd+Z / Y)
- `src/ui/loading-screen.ts`: loading overlay (mark + name + progress bar + label) for scene changes; wrap such transitions in `loading.run([{ label, run }, …])` (`main.ts` does it for menu ⇄ build and at boot); timings in `LOADING`, strings in `TEXT.loading`
- `src/ui/confirm-dialog.ts`: reusable modal confirmation (`confirmDialog`); use it instead of `window.confirm`
- `src/camera-limits.ts`: `limitCamera` (limits the polar angle so the camera stays above the ground at its current distance, instead of pushing it up: the zoom distance stays exact; call before `controls.update()`, also used by `ZoomControl`) and `panArea` + the `area` of `limitCamera` (while building the orbit target stays within the creation widened by `CAMERA.panMargin`, so the zoom is always about the creation; not while playing), and `keepCameraAboveGround` (safety net after the update)
- `src/ui/zoom-control.ts`: zoom buttons/slider synced with the wheel; limits in `CAMERA.minDistance/maxDistance`
- `src/ui/fps-counter.ts`: FPS readout (F3 toggles)
- `src/ui/help-dialog.ts` + `src/constants/help-content.ts`: help modal with tabs (info button top-left, `H`). **Update `help-content.ts` whenever you add or change a control or shortcut**
- Rotation: every part has the same orientation (`Part.studs` + `Part.spin`, 24 turns: a block's studs, a wheel's axle = local X, an engine's front = local Z, a large wheel's reach = local Y / Z; `parts/orientation.ts`, `canonicalOrientation`), turned by `BuildMode.rotate` (A/D, top-bar buttons: around the vertical axis) and `tilt` (W/S: around the screen's left-right axis) with a smoothly animated ghost (`BuildMode.update(dt)`) that keeps the full turn even for parts that look the same. Old saves (wheel `rotation` / `pitch`, engine `front`) are converted by `legacyOrientation` (`SAVE.format`). **Keep `help-content.ts` in sync**
- Painting: `Part.color`, `PART_INFO[type].paintable`, `Grid.paint`, painted only in paint mode with the palette under the top bar (never in the catalog; the inspector just shows the colour); keep `help-content.ts` in sync.
- Selection (inspect mode): `F` flies the camera to the selection (`focusOnSelection` / `runCameraFocus` in `main.ts`, `CAMERA.focusSeconds` / `focusDistance`); a left drag draws a box (`BuildMode.partsInRect`, `selectMany`, Shift adds); a drag that starts on a selected part moves the selection (`Grid.moveParts`, `BuildMode.moveSelectionBy` / `dragMove`, `MOVE`; Shift = vertical) and the multi-selection inspector has the move buttons. **Keep `help-content.ts` in sync**
- Cursor modes I (inspect) / B (build) / E (paint) / R (remove) (`CursorMode`, `constants/cursor-modes.ts`): `BuildMode.setMode` + `main.ts setCursorMode`; inspect mode selects parts (outline, `src/ui/part-inspector.ts` panel), paint mode paints by clicking/dragging (colour from `src/ui/paint-palette.ts`), remove mode erases by clicking/dragging. **Keep `help-content.ts` in sync**
- `src/parts/wheel-model.ts`: wheel geometry (tire + rim), tuned through `WHEEL_VISUAL`; keep it within `WHEEL.radius` / `WHEEL.width`, which are the physical size
- Settings (the gear button, top right): `src/settings.ts` + `constants/settings.ts` (`SETTINGS_DEFAULTS`, `SETTINGS_PANEL`) + `ui/settings-dialog.ts`, applied in `applySettings` (`main.ts`); **a new setting is a default, a panel row and a line in `applySettings`; keep `docs/` and `help-content.ts` in sync**
- `src/audio/` + `src/constants/sound.ts`: all sound is synthesised (Web Audio, no files): `sound.play(name)` plays a recipe of `SFX`, `VehicleSound` is the Play-mode voices (fed by `PhysicsWorld.audioState()`). **A new action that should make a sound gets a recipe in `SFX` and a `sound.play` where it happens; a new part with a motion gets a voice in `VehicleSound`; keep `help-content.ts` and `docs/` in sync.** `M` / `#btn-sound` mute
- `src/ui/hotbar.ts`, `src/ui/catalog-dialog.ts`, `src/ui/part-preview.ts`, `src/ui/drag-drop.ts`, `src/ui/modal.ts`: hotbar (keys 1-9), parts catalog (C) with 3D previews, drag & drop, shared modal. **New parts: add them to `PartType`, `PART_INFO`/`PART_ORDER` (`constants/part-catalog.ts`) and `docs/adding-a-part.md`**
- `src/ui/controls-panel.ts` + `src/constants/play-controls.ts`: the Play-mode panel (bottom left): the fixed driving / flight rows (`PLAY_CONTROLS`) plus one row per key the player gave to parts (`PART_KEY_LABELS`, grouped by key) and a warning for parts without a key; **a part that takes a key needs a `PART_KEYS` entry and a `PART_KEY_LABELS` label** (and keep `help-content.ts` in sync)
- `src/ui/hud.ts`, `src/ui/menu.ts`, `index.html`: top bars / hotbar visibility and the main menu with its saved-games panel (markup)
- `public/`: static branding assets (`logo-mark.svg`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`; regenerate the raster ones if the SVG changes)
- `src/scene/sky.ts`: shader sky dome with blocky (voxel-style) clouds that drift with the wind (parameters in `SKY`, `src/constants/game.ts`)
- `src/save.ts`: named save slots in localStorage, each with its floor-grid size `gridCells` (one of `GRID_SIZES`; chosen in the New game panel, `ui/menu.ts`) (key `blocklab.saves.v2`; migrates the old `blocklab.v1`)

See [docs/architecture.md](docs/architecture.md) and [docs/physics.md](docs/physics.md).

## Conventions

- **Never hard-code colours, sizes, spacing, fonts, tunable numbers or UI strings**: add/use a token in `src/constants/`
  (see [docs/constants.md](docs/constants.md)). CSS only uses `var(--...)`; Three.js colours go through `hexToNumber(COLORS...)`.
- **All in-game text is English** (HUD, help, labels, `lang="en"`).
- **File names are kebab-case** (`build-mode.ts`); classes inside stay PascalCase.
- The `Grid` is the single source of truth; the simulation never mutates it. Stop discards the physics world.
- The game starts in the main menu. Edits autosave only to the active save (`activeSave` in `main.ts`);
  set it to `null` around `grid.load/clear` so loading does not rewrite (and re-date) a save.
- UI font is Orbitron (self-hosted, imported in `main.ts`, token in `typography.ts`); it is wide, so keep sizes modest and buttons `nowrap`.
- Mouse: left = place on press / drag to paint blocks on the starting face's plane (never moves the camera), right click = remove / right drag = pan, middle drag = rotate,
  scroll = zoom (`controls.mouseButtons` in `main.ts`; click-vs-drag logic in `build-mode.ts`).
- `index.html` hides the whole body until `main()` adds `html.ready` (after `applyTheme()`), and paints the page `#0a0e18` (= `COLORS.surface.vignette`) meanwhile, so no unstyled flash on first load; keep that colour in sync.
- The version shown in the menu comes from `package.json` (`__APP_VERSION__`, defined in `vite.config.ts`).
- User-provided text (save names) is rendered with `textContent`, never `innerHTML`.
- Cell `[x, y, z]` centre is world `(x, y, z)`; ground top is `y = -0.5`; valid cells have `y >= 0` and x, z within `buildRange(cells)` (`-n/2 … n/2 - 1`) and `0 <= y <= n - 1` of the game's grid size (`Grid.setSize`; inside the floor grid, whose squares are exactly one cell: lines at n ± 0.5).
- Shared geometries/materials are created once in `part-defs.ts`; do not dispose them per instance.
- Adding a part type: follow [docs/adding-a-part.md](docs/adding-a-part.md).

## Physics gotchas

- Connected blocks must stay **one rigid body** with one collider per block; do not joint individual cubes.
- Multi-cell parts (the large wheel `bigWheel`, 2 x 2 cells that its orientation leads to): `partCells` / `partCentre` in `types.ts`; position visuals / bodies at `partCentre`, never at `cell`. `isWheelType` covers both wheels.
- Wheel chain: `chassis -prismatic spring- hub -revolute- wheel` (`SUSPENSION`, `Part.suspension`, set only in `PartInspector`); the spring must stay `ForceBased` and scaled by the supported mass, an acceleration-based one cannot hold the chassis. The vehicle controller drives the hub-wheel revolute joint; the hub needs a large rotational inertia (`SUSPENSION.hubInertia`) or the engine is too weak and A / D stop steering.
- Orientation: see Rotation above; `face` only says where a wheel / engine is mounted. A wheel's Rapier body must stay unturned, so a wheel carries its turn in the pivot of its visual (`createPartObject`), not on the root. `studsEngaged` requires equal stud directions. **Keep `help-content.ts` in sync.**
- Wedges / slopes (`ShapeBox.wedge`, `slope*` types in `STRUCTURAL_TYPES`): triangular prisms with sockets underneath and NO studs on the slope (`studsEngaged` only lets them be held), bounding-box occupancy, a convex-hull collider from `wedgePoints`, `partVolume` halved. They are not hosts. **Keep `docs/` and `help-content.ts` in sync.**
- Part names: structural parts are `<studs wide>x<studs long> <Kind>` (kinds: Block, Plate, L bracket, Slope, Slope Plate) (`2x2 Block`, `1x2 Plate`, `4x4 L bracket`; top-face studs, narrow side first, no height except `Low` (3 plates, 0.6) / `Tall` (2 cells) variants: `2x2 Low Block`; see `docs/adding-a-part.md`); `PartType` keys keep the old names (saved games). Use the pattern for new sizes.
- Structural parts (`STRUCTURAL_TYPES`: block, the 1x1 / 1x2 / 1x4 / 2x4 / 4x4 blocks and their low (0.6) and tall (2 cells) variants, plate, the 1x1 / 1x2 / 1x4 / 2x4 / 4x4 / 4x8 plates, and the 1x2 / 2x2 / 2x4 / 4x4 L brackets) are described by `SHAPES` (`constants/part-shapes.ts`: boxes with a studs direction each, anchor = first box = `Part.cell`, `spins`); orientation = `Part.studs` + `Part.spin` (`parts/orientation.ts`); use `partBoxes` / `relativeBoxes` / `partsOverlap`, not a single box, and `isStructural(type)`. Mounted parts go on any block (see below). **Keep `docs/` and `help-content.ts` in sync.**
- Studs (`STUD`, `parts/part-geometry.ts`): blocks and plates snap to the stud pitch (x / z half cells) and are welded only through engaged studs (`Grid.linkedParts`, also what `PhysicsWorld` flood-fills); `Grid.canPlace` needs the ground or `engagedStuds > 0`; there is no cell index: use `partBoxes` / `partsOverlap`, compare positions with `cellKey` / `EPS`. Plate (`'plate'`, `PLATE.thickness`): a thin block with studs (flat, or a wall when tilted); use `isStructural(type)` (block or plate) wherever "part of the body" is meant, and `partVolume` for mass.
- Engine (`'engine'`, NOT structural: mounted on a block face like a wheel, `face` + `front` + `power`, `ENGINE`, `ENGINE_BODY`, `isMountedType`, `Grid.mountedOn` / `enginesOnBody`): with `Grid.engineDrive` (true for new games, saved in `SaveGame.engineDrive`; old saves drive every wheel) a wheel is powered only by the engines of its body, pushing towards their front (turned around = reversed, sideways = nothing); power is shared among the body's wheels (`WheelDrive.engines`, `VehicleController`). Position matters: `PhysicsWorld.applyEngines` turns each engine's push into a torque about the body's centre of mass (`ENGINE.leverage`, `PhysicsWorld.throttle`), so a high or off-centre engine pitches / turns the vehicle. Wheels, engines, turbos, thrusters, rotors and pistons mount on any block (`HOST_TYPES` / `isHostType`: every block, low and tall ones included; not plates and brackets); `Part.cell` of a mounted part is the unit cell against the face, centred on the pointer in half-cell steps when the face is wider than a cell, and its host is `Grid.hostOf(part)` (the block whose face contains `cell - face / 2`), never `cell - face`; an engine's front may not point into its block and it may not be upside down (heads down) (`Grid.canPlace`). **Keep `help-content.ts` and `docs/` in sync.**
- **Part keys** (`Part.key`, a `KeyboardEvent.code`; `src/constants/part-keys.ts`, `Grid.setKey`, `ui/key-capture.ts`, the key section of `PartInspector`, the bell + `ui/alerts-dialog.ts`): NO part has a default key; the player gives each rotor, piston, thruster and turbo (required: the bell counts them) and each wheel (its brake's key, optional) its own (`isKeyed`), parts with the same key work together, and hold-vs-toggle is decided per part type in `PART_KEYS` (thruster / turbo / brake = hold, rotor / piston = toggle). `PhysicsWorld.isOn(part)` (= `VehicleController.isOn`) says whether a part runs; never hard-code a key for a part. W A S D / arrows / Q E / R / P / H / M are `RESERVED_KEYS`; editing keys (I, B, C...) may be assigned. Parts that need a key and have none are counted by the bell (`lacksKey`). **A new part that takes a key: `PART_KEYS`, `PART_KEY_LABELS`, `help-content.ts` and `docs/`.**
- Flying: `PhysicsWorld.fly` (W / S pitch, A / D roll, Q / E yaw while `airborne`, i.e. no contact with the ground; `FLIGHT`, `VehicleController.pilot`, `PhysicsWorld.pilot`) acts on the bodies that carry wheels or thrusters; the nose comes from the thrusters / engines / wheels (`buildFlight`). **Keep `help-content.ts` and `docs/` in sync.**
- Driving assist: `PhysicsWorld.straighten` (heading hold while the player does not steer; `VEHICLE.straighteningGain`, `PhysicsWorld.steering`) and `PhysicsWorld.drag` (`VEHICLE.airDrag`) act on the bodies that carry wheels; the simulation veers a little on its own, so keep them when you change the wheels.
- Thruster (`'thruster'`, like the engine: mounted on a block face, `Part.power` = thrust, `THRUSTER`, `THRUSTER_BODY`, `MOUNTED_BODY`, `Grid.thrustersOnBody`): its key (`Part.key`, hold) makes `PhysicsWorld.applyThrust` push its host body along its front at the place where it is mounted. **Keep `help-content.ts` and `docs/` in sync.**
- **Placement never corrects a part's orientation**: the ghost takes the orientation the player chose (A / D, W / S) and only turns red when `Grid.canPlace` says no (engine front into the block, upside-down engine, rotor head pointing at the block…). Do not auto-orient new parts.
- Piston (`'piston'`, like the rotor, NOT structural: `Part.stroke` 1-6 half cells, `PISTON`, `PISTON_VISUAL` / `PISTON_BODY`, `headOf` / `isHeaded` shared with the rotor): its head (stud box) holds a separate body joined by a prismatic joint; its key (toggle) pushes it out / back (`VehicleController.isOn`, `PhysicsWorld.isOn`), the rod is rescaled each frame. **Keep `help-content.ts`, `play-controls.ts` and `docs/` in sync.**
- Rotor (`'rotor'`, mounted on a block face like the engine, NOT structural: `Part.speed` -10..10 (sign = direction), `ROTOR`, `ROTOR_VISUAL` / `ROTOR_BODY`, `rotorHead` in `part-geometry.ts` (its head is a stud box, so parts on it are held by it), `Grid.linkedParts` skips it, `PhysicsWorld.buildRotors`): the structural parts engaged with its head are a separate body joined to the block's by a motorised hinge (contacts off) and turn with the head when its key (toggle) switches it on (`VehicleController.isOn`). Its studs (local up) must point away from the block (`Grid.canPlace`); like every part it is placed with the orientation the player chose and is never turned for them. **Keep `help-content.ts` and `docs/` in sync.**
- Turbo (`'turbo'`, like the engine: mounted on a block face, `Part.power` = boost, `TURBO`, `TURBO_BODY`, `MOUNTED_BODY`, `isCompactMounted`, `Grid.turbosOnBody`): its key (hold) boosts the driven wheels of its body (`WheelDrive.turbos`, `VehicleController`); the engine and the turbo share the power slider and `setPower`. **Keep `help-content.ts` and `docs/` in sync.**
- Brake (NOT a part: every wheel has one, `Part.brake` 1-10 default `BRAKE.default`, `Grid.setBrake`, `brakeOf`, `brakePose`, `createCaliperObject`, slider in `PartInspector.brakeSection`): the wheel's own key (`Part.key`, optional, hold; `lacksKey` ignores wheels) holds the wheels that have it (`WheelDrive.brake` / `part`, `VehicleController`). **Keep `help-content.ts` and `docs/` in sync.**
- Block weight (`WEIGHT`, `Part.weight`, slider in `PartInspector`, `Grid.setWeight`): block collider density = `CHASSIS.density × weightMass(weight)`; default weight 4 = ×1 so nothing changes for old saves.
- Tires (`TIRE`, `Part.tire` 0-100, a slider only in `PartInspector`) set wheel friction, top speed and motor torque, interpolated between three points; keep `torque` scaled with `friction`, or high-grip tires cannot skid-steer.
- A wheel body must start **un-rotated**: Rapier's revolute joint uses the same axis numbers in both bodies'
  local frames, so only the wheel's *collider* and mesh are rotated toward the axle.
- Wheels (radius 0.65) collide only with the ground; this is done with collision groups, keep it that way.
- Tuning constants (speed, motor strength, brake, steering, friction, gravity) live in `src/constants/physics.ts` and are listed in `docs/physics.md`.

## Verifying changes

1. `npm run build` must pass.
2. Run `npm run dev`, open the app and exercise the feature: place blocks/wheels with real clicks, press
   Play, drive with W/S/A/D, `R` restarts, Stop returns to the intact build.
3. Dev mode exposes `window.__blocklab` (`grid`, `camera`, `controls`, `getPhysics()`, `getMode()`, `menuScene`, `build`, `history`, `zoom`) for inspecting
   state, e.g. a body's position, from the console.
4. The in-app browser pane pauses `requestAnimationFrame` while hidden; if physics seems frozen, bring the
   tab to the front (a screenshot also wakes it) before concluding something is broken.

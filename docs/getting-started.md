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

## Hotbar and parts catalog

The bottom bar is a **hotbar** of 9 slots. The selected slot (yellow border) decides what the left button places;
select it with `1`–`9` or a click. A fresh install has the **Block** in slot 1 and the **Wheel** in slot 2; the rest are
empty. Rearrange it by dragging a slot onto another one (they swap), drag a slot out of the bar or right-click it to
empty it. The layout and the selected slot are remembered in the browser (not per saved game).

The button at the right of the hotbar (or `B` / `C`) opens the **parts catalog**, a modal with tabs (**All** plus one per
category) and a card with a 3D preview for each part:

- **Hover** a card and its preview spins.
- **Click** a card to open the **inspector** on the right: big spinning preview, category, description, properties
  and tips, and a button that adds the part to the hotbar (or selects its slot if it is already there).
- **Drag** a card onto a hotbar slot (the hotbar stays above the dimmed background while the catalog is open).

`Esc`, `B`, `C` or the `×` button close the catalog.

## Zoom control

In the **top-left corner, right under the Menu button**, there is a **zoom control** made of three parts stacked vertically: the `+` button on top (in its own panel), the
bar in the middle, with no card around it (the zoom percentage at its top and a vertical slider below it, top = closest) and the `−` button
at the bottom. The percentage is relative to the default view (`100%`). It works together with the mouse
wheel: scrolling moves the slider, and dragging the slider or pressing the buttons zooms the camera. Zoom is limited
to a camera distance of **3 to 60 units** (`CAMERA.minDistance` / `CAMERA.maxDistance`, about `513%` to `26%`), for
the wheel, the buttons and the slider alike. It is shown while building and playing, not in the main menu.

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
- Each save shows its number of parts, its grid size and its date.
- **New game** opens the *New game* panel: type a name (optional, it defaults to "Creation N") and pick the **grid size** (Small 16 × 16, Medium 32 × 32, Large 64 × 64, the default and the biggest), then **Create**. The size is fixed for that game: blocks can only be placed inside the floor grid, which is drawn with one square per cell. Saves from before sizes existed are Large. A grid of `n` squares covers the cells `-n/2 … n/2 - 1` on x and z, and the build height is limited to `n` cells (`y` from 0 to `n - 1`) too.
- **Back** returns to the title screen (or from the New game panel to the saved games).

The bottom-right corner shows the game version (`vX.Y.Z`), read from `package.json` at build time
(`vite.config.ts` defines `__APP_VERSION__`). Bump the `version` field there to release a new version.

In the game, the **☰ Menu** button (top-left, next to the ⓘ help button, on its left) returns to the main menu.

## Help

The **ⓘ button** in the top-left corner (or the `H` key) opens a help dialog with all the instructions, mouse
controls and keyboard shortcuts, split into tabs (Basics, Mouse & camera, Build & drive, Shortcuts). `Esc`, `H` or the
`×` button close it. It is available while building and playing, not in the main menu. The text lives in
`src/constants/help-content.ts`.

## Screen layout

| Where | What |
|---|---|
| Top left | **☰ Menu** and, next to it, **ⓘ Help**; the **zoom control** below the Menu button |
| Top centre | Bar with the cursor modes **Q W E**, the rotate buttons **A ↺ D ↻**, **Undo** and **Redo**, then **Clear** and **Play** (while playing it only shows **Stop**) |
| Right edge, centred | The **part inspector** (inspect mode, when a part is selected) |
| Top right | **FPS counter** |
| Bottom centre | **Hotbar**: 9 slots (`1`–`9`) and the **parts catalog** button (build mode only) |

## Controls

### Cursor modes (`Q` / `W` / `E` / `R`)

The left part of the top bar has three **cursor modes**; press the key or click the button. They decide what the left
mouse button does (the middle button always rotates the camera, the right button pans, scroll zooms):

| Mode | Key | Left button |
|---|---|---|
| **Inspect** | `Q` | **Click** a part to select it: it gets a yellow outline and an **inspector panel** opens **centred on the right edge**, filling the height between the top bar and the hotbar (preview, position, how many blocks are welded into its rigid body, wheels attached or host block and axle, properties, a *Remove part* button; blocks also show their **Color**, which is changed in Paint mode) Clicking empty ground, the `×` or leaving the mode deselects. **Dragging rotates the camera** in this mode. Parts under the cursor are outlined in white |
| **Build** (default) | `W` | Places the part of the selected hotbar slot; drag to paint blocks (see below). A right click removes a part |
| **Paint** | `E` | A **palette** appears under the top bar; pick a colour (the first swatch is the default colour and removes paint) and click a block to paint it, or **drag** to paint several (one undo step). Wheels cannot be painted. Painting is undoable, saved and shown in Play. Not available in the catalog |
| **Remove** | `R` | Removes the part under the cursor; **drag to erase** several (one undo step, it does not drill through a stack: it needs some pointer movement between removals). The part under the cursor is outlined in red. A right click removes too |

Choosing a hotbar slot (`1`–`9`, a click or the catalog) switches back to **Build**. The shortcuts only work while
building (in Play, `W` drives). The modes are **icons** with their key cap beside them: a mouse cursor (Inspect), a hammer
(Build), a brush (Paint) and a trash can (Remove); hover one for its name and description. Undo and Redo are icon-only buttons
(curved arrows) in the same style; their tooltip gives the shortcut (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Y`), so they carry no key cap.

### Rotating the part to place (`A` / `D`)

In Build mode, **`D`** turns the part you are about to place a quarter turn **clockwise** and **`A`** counter-clockwise
(seen from above); the **↺ ↻ buttons** in the top bar do the same. The placement preview **turns smoothly** (it takes the
shortest way round, also when you press quickly several times) and every part you place or paint gets that rotation
(0°, 90°, 180°, 270°). The inspector shows the **Rotation** of an inspected part and it is kept in saves and undo/redo.

- Blocks are cubes, so a rotated block looks the same once placed; the rotation is stored and shown in the inspector,
  and it will matter for parts that are not symmetric.
- **Wheels can be rotated too, and it chooses their axle.** A wheel is mounted on a **side face** of a block (that face
  decides where it sits). By default its axle is perpendicular to that face, a normal wheel. Press `A` / `D` for a
  quarter turn and the wheel lies **along** the face instead (like a caster or roller); two quarter turns flip the axle
  direction. The preview turns smoothly between these, and the physics uses the chosen axle (a car whose wheels are all
  turned a quarter turn drives along the other horizontal axis). The inspector shows the rotation, the host block
  (*Mounted on*) and the *Axle*. The rotation chosen for one part does not carry over to another.
- The buttons are dimmed (and `A` / `D` do nothing) outside Build mode and with an empty hotbar slot. While playing,
  `A` / `D` steer the car as always.

### Build mode

| Input | Action |
|---|---|
| Left click | Place the selected part on press (the left button never moves the camera) |
| Left drag (**Block** tool) | Keep the button down and move to **paint blocks**: every cell the pointer passes over gets a block. Painting is locked to the face where you started (ground, a block's top, or a side), so you draw a row, layer or wall without growing towards the camera. Fast moves leave no gaps. Other parts (the wheel) are placed once per press |
| Right click | Remove the part under the cursor (removing a block also removes the wheels mounted on it) |
| Right drag | Pan the camera (a right press that moves is not a click, so nothing is removed). The camera stops at the ground: you cannot pan or orbit under the terrain |
| Middle drag | Rotate the camera |
| Scroll | Zoom |
| **Undo / Redo** buttons (top bar) or `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` (`Ctrl/Cmd+Shift+Z` also redoes) | Revert / reapply your edits. One step per action: a placed block or wheel, a removal (with its wheels), a whole paint stroke, or **Clear**. Up to 100 steps; the history is cleared when you open or create another game. Not available while playing |
| `1` – `9` or click a slot | Select the part in that hotbar slot (an empty slot places nothing) |
| `B` / `C` or the catalog button | Open / close the **parts catalog** |
| **Clear** (top bar) | Remove every part. A confirmation popup asks first (no popup when there is nothing to clear); the result can be undone |
| **Play** (top bar) | Switch to Play mode |

The ghost preview is **green** when the placement is valid and **red** when it is not.

A **wheel** must be mounted on the **side** of a block: hover a side face of a block (not the top or
bottom) and click. The face you click defines the wheel's axle.

### Play mode

| Key | Action |
|---|---|
| `W` / `S` (or ↑ / ↓) | Accelerate / reverse |
| `A` / `D` (or ← / →) | Steer left / right |
| `R` | Restart the simulation from the build (also the **Reset** button, left of Stop in the top bar) |
| **Stop** | Return to build mode; the build is untouched |

## Persistence

Every change is saved automatically to the **active save** in `localStorage` (key `blocklab.saves.v2`,
a list of `{ id, name, updatedAt, parts }`). Saves from the old single-slot format (`blocklab.v1`) are
migrated once into a save called "My creation". There is no export/import yet.

## Dev-only debug hook

In dev mode (`npm run dev`) `window.__blocklab` exposes `{ grid, camera, controls, getPhysics, getMode, menuScene, build, history, zoom }`
for inspection from the browser console. It is stripped from production builds
(`import.meta.env.DEV`).

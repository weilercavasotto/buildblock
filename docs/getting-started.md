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

The bottom bar is a **hotbar** of 9 slots; the **name of the selected part** (e.g. *Large wheel*) is shown in a label above it (nothing for an empty slot). The selected slot (yellow border) decides what the left button places;
select it with `1`–`9` or a click. A fresh install has the **Block** in slot 1 and the **Wheel** in slot 2; the rest are
empty. Rearrange it by dragging a slot onto another one (they swap), drag a slot out of the bar or right-click it to
empty it. The layout and the selected slot are remembered in the browser (not per saved game).

The button at the right of the hotbar (or `C`) opens the **parts catalog**, a modal with tabs (**All** plus one per
category) and a card with a 3D preview for each part:

- **Search**: the field above the cards filters them (in the tab you are on) by name, category, tagline or description; every
  word you type must match. `/` jumps to the field; `C` is typed as text while it has focus (`Esc` still closes the catalog).
- **Hover** a card and its preview spins. All the previews in the catalog (cards and inspector) share one scale, so a part's
  size relative to the others is visible (the large wheel is twice the wheel); the hotbar and the part inspector make each part fill its frame.
- **Click** a card to open the **inspector** on the right: big spinning preview, category, description, properties
  and tips, and a button that adds the part to the hotbar (or selects its slot if it is already there).
- **Drag** a card onto a hotbar slot (the hotbar stays above the dimmed background while the catalog is open).

`Esc`, `C` or the `×` button close the catalog.

## Zoom control

In the **top-left corner, right under the home button**, there is a **zoom control** made of three parts stacked vertically: the `+` button on top (in its own panel), the
bar in the middle, with no card around it (the zoom percentage at its top and a vertical slider below it, top = closest) and the `−` button
at the bottom. The percentage is the slider position: **0%** at the farthest zoom and **100%** at the closest (the zoom itself is logarithmic, as before). It works together with the mouse
wheel: scrolling moves the slider, and dragging the slider or pressing the buttons zooms the camera. Zoom is limited
to a camera distance of **3 to 60 units** (`CAMERA.minDistance` / `CAMERA.maxDistance`, which are the `100%` and `0%` ends), for
the wheel, the buttons and the slider alike. It is shown while building and playing, not in the main menu.

## FPS counter and frame limit

Rendering is **capped at 60 FPS** on any display (a 75/120/144 Hz monitor also shows 60). The target is
`FRAME_LIMIT.targetFps` in `src/constants/game.ts`. A small frames-per-second readout sits in the **top-right corner** in every mode. It is green at 55+ FPS, yellow
at 30+ and red below. Press **F3** to show or hide it. Thresholds and refresh rate: `FPS_COUNTER` in
`src/constants/game.ts`.

### Block weight

Every **block** has a **weight**, an integer from **1 to 16** (default **4**, which is the mass blocks always had), set
with the **Weight** slider in the inspector (Inspect mode; step 1, *Light* … *Heavy*, a **Default** button appears when it
differs). The block's weight is its mass in Play (weight / 4: from a quarter to four times the default), so it changes how
hard the body is to accelerate and to steer and how much the suspension sinks. When the block is welded to others, the
button **Apply to the N connected blocks** gives them all the same weight (one undo step). The inspector also shows the
**Body weight**, the sum of the weights of the welded blocks. A light roof on a heavy base (or a heavy base for a low
centre of gravity) is the point. Weight is per block, saved with the game and undoable; it is not offered in the catalog.
Wheels have no weight setting.

### Tires

Each wheel has a **tire**, set with the **Tire** slider in the inspector (Inspect mode), the same kind of control as the
suspension's: from **0** (*Speed*: slick, low grip, the highest top speed) through **50** (the default, standard tires) to **100**
(*Traction*: deep tread, huge grip, slower: for snow and rough ground), in steps of 5; the **Default** button appears when it
differs, and the button **Apply to the N wheels on this body** (shown when the body has more than one wheel) gives the wheel's
current tire to every wheel mounted on the blocks welded to its block, wheels of both sizes (one undo step). Grip, top speed and
motor strength change smoothly along the slider. It is per wheel, undoable, saved with the game,
applied in Play, and never changed in the catalog (which just lists the property). Mixing tires on one car is allowed. Saves
from when the tire was one of three named types are converted (speed 0, standard 50, traction 100).

### Wheel suspension

A wheel hangs from its block on a spring. Select a wheel in Inspect mode and use the **Suspension** slider in the inspector
(0 = soft and bouncy, 100 = firm and stiff; the default is 50; the **Default** button appears when it differs). The value
is per wheel, it is undoable, saved with the game, and only takes effect in Play (use **Reset** to try a new value). Soft
springs make the body sink more; firm ones keep it level. **The heavier the creation, the more the springs compress** (stack blocks on a car and it sits lower, until it scrapes the floor: use a firmer setting for heavy builds). It is only changed in the inspector, never in the
catalog (which just lists the property).

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

In the game, the **home icon** button (top-left, next to the ⓘ help button, on its left) returns to the main menu.

## Help

The **ⓘ button** in the top-left corner (or the `H` key) opens a help dialog with all the instructions, mouse
controls and keyboard shortcuts, split into tabs (Basics, Mouse & camera, Build & drive, Shortcuts). `Esc`, `H` or the
`×` button close it. It is available while building and playing, not in the main menu. The text lives in
`src/constants/help-content.ts`.

## Screen layout

| Where | What |
|---|---|
| Top left | the **home** button (back to the main menu) and, next to it, **ⓘ Help**; the **zoom control** below the home button |
| Top centre | Bar with the cursor modes **Q W E**, the rotate buttons **A ↺ D ↻**, **Undo** and **Redo**, then **Clear** and **Play** (while playing it only shows **Stop**) |
| Right edge, centred | The **part inspector** (inspect mode, when a part is selected) |
| Top right | **FPS counter** |
| Bottom centre | **Hotbar**: 9 slots (`1`–`9`) and the **parts catalog** button (build mode only) |

## Controls

### Cursor modes (`I` / `B` / `E` / `R`)

The left part of the top bar has three **cursor modes**; press the key or click the button. They decide what the left
mouse button does (the middle button always rotates the camera, the right button pans, scroll zooms):

| Mode | Key | Left button |
|---|---|---|
| **Inspect** | `I` | **Click** a part to select it: it gets a yellow outline and an **inspector panel** opens **centred on the right edge**, filling the height between the top bar and the hotbar (preview, position, how many blocks are welded into its rigid body, wheels attached or host block and axle, properties, a *Remove part* button; blocks also show their **Color**, which is changed in Paint mode, and a **Weight** slider; wheels have **Tire** and **Suspension** controls, see below) Clicking empty ground, the `×` or leaving the mode deselects. **Dragging rotates the camera** in this mode. Parts under the cursor are outlined in white |
| **Build** (default) | `B` | Places the part of the selected hotbar slot; drag to paint blocks (see below). A right click removes a part |
| **Paint** | `E` | A **palette** appears under the top bar; pick a colour (the first swatch is the default colour and removes paint) and click a block to paint it, or **drag** to paint several (one undo step). Wheels cannot be painted. Painting is undoable, saved and shown in Play. Not available in the catalog |
| **Remove** | `R` | Removes the part under the cursor; **drag to erase** several (one undo step, it does not drill through a stack: it needs some pointer movement between removals). The part under the cursor is outlined in red. A right click removes too |

Choosing a hotbar slot (`1`–`9`, a click or the catalog) switches back to **Build**. The key caps next to the icons are only drawn in windows
at least 1180 px wide (the shortcuts stay in the tooltips and the help); in a narrow window the top bar wraps onto a second row
instead of running under the home / help buttons. The shortcuts only work while
building (in Play, `W` / `A` / `S` / `D` drive; while building they only rotate the part to place). The modes are **icons** with their key cap beside them: a mouse cursor (Inspect), a hammer
(Build), a brush (Paint) and a trash can (Remove); hover one for its name and description. Undo and Redo are icon-only buttons
(curved arrows) in the same style; their tooltip gives the shortcut (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Y`), so they carry no key cap.

### Studs: how blocks and plates connect

Blocks and plates have **4 round studs on top** (2 × 2, half a cell apart), like a toy brick, and they connect through them:

- **Positions snap to the stud pitch (half a cell) in x and z.** Hover the top of a block and the ghost shows where the new
  one would rest: put the pointer over the middle and it sits **exactly on top (4 studs)**, towards an edge and it is **shifted
  by half a cell (2 studs engaged)**, towards a corner **shifted both ways (1 stud)**. The height is whatever the part below
  gives (a plate is 0.2 thick, so a block on a plate sits 0.2 higher).
- **A block or plate must be supported**: on the ground (anywhere), or resting on / hanging under another block or plate
  with **at least one stud engaged**. Something floating in mid-air, or touching only with its side, is not valid (red ghost).
  Beside another block or plate, it goes level with its bottom, so it needs the ground or some stud to hold it.
- **Only studs weld.** Parts stacked with a stud engaged form one rigid body in Play. **Blocks side by side are not
  welded**, even if they touch: tie them together with a **plate** across them, or a layer of blocks half a cell off on top
  (like a real brick wall). Wheels are fixed to the block they are mounted on and move with its body. Removing a part leaves
  the ones that rested on it in place (they just stop being supported); the creation is only checked when you place something.
- Dragging with the Block tool keeps the half-cell offset it started with. Saves keep working: whole-cell blocks are the same,
  but a creation made of blocks that only touch (no stud engaged) now falls into separate bodies in Play: put a layer of
  plates or blocks on top of it.

### The plate

The **Plate** (catalog, category *Structure*; drag it onto a hotbar slot) is a thin square panel, **0.2 cells thick**
(`PLATE.thickness`), with the same 4 studs on top. It lies flat; click the ground or the top (or underside) of a block or
plate. It is the Lego plate: use it for floors and body panels and to **tie blocks together** (a plate resting on two blocks
side by side welds them, since each engages some of its studs). Plates stack: a plate on a plate sits 0.2 higher. It can be painted,
has the same **Weight** slider as a block (its mass is that of a block times its thickness, so it is light), is symmetric
(`A` / `D` do nothing) and wheels cannot be mounted on it. Clicking beside a block puts the plate at the level of its bottom.

The **underside** of every block, plate and bracket shows dark round sockets, one per stud position: that is the face that receives the studs of another part.

A plate standing as a wall snaps its thin side to the nearest lattice line **on the side of the pointer**, so it stays in the half cell you point at instead of jumping into the next one.

### More blocks, plates and L brackets

Besides the **Block** and the **Plate** the catalog (*Structure*) has: **Half block** (0.5 × 1 × 1, 2 studs), **Large block** (2 × 1 × 2, 16 studs, four blocks in one), **Half plate** (0.5 × 1, 2 studs), **Large plate** (2 × 2, 16 studs), **Large half plate** (1 × 2, 8 studs), and two **L brackets**: a flat plate with a wall plate on its back edge, studs on top of the flat plate and on the outside of the wall (**L bracket**: 8 studs, **Small L bracket**: 4). They place, weld, paint, weigh and tilt like blocks and plates. Shapes that are not square also depend on `A` / `D` (which way they run, which side the wall is on); wheels are mounted only on the normal block. A part engages the studs of a wall when its own studs point the same way (tilt it with `W` / `S`).

### The engine

The **Engine** (catalog, *Mobility*) is what drives the wheels. It is a separate unit, not a block: a small **V engine** (a 0.8-cell cube: aluminium crankcase, two banks of cylinders with bores, dark oil pan and intake) that you **mount on a face of a block** (top, bottom or sides) like a wheel, without taking the place of a block. Its cylinder heads point away from the block and the **fan** (blades in a ring, with a small yellow nose) marks its **front**. In Play the vehicle is pushed **towards the front of its engine**: turn it with `A` / `D` (around the vertical axis) and `W` / `S` (tilt it up / down) before placing; turned the other way, `W` / `S` are reversed, and an engine facing sideways or up does nothing. The front cannot point into the block it is mounted on (the ghost turns red). Wheels are driven only by the engines mounted on **their body** (the blocks welded together); wheels on a body without an engine roll freely, and a message under the top bar tells you when no wheel is driven. The inspector has a **Power** slider (1-10, default 5, plus "apply to all the engines on this body"): a body's engines add their power and share it among its wheels; one default engine drives 4 wheels at full torque, more wheels get less each, fewer get up to twice as much. An engine weighs as much as two blocks. Removing the block an engine is mounted on removes the engine. Games made before the engine existed keep driving every wheel; new games need an engine.

### The large wheel

The **Large wheel** (catalog, category *Mobility*; drag it onto a hotbar slot) is a wheel of **twice the size** (radius 1.3,
width 0.8): it **occupies 2 × 2 cells** (a square perpendicular to its axle). Click a **side face** of a block
as with the normal wheel: the wheel is anchored at the cell you point at (beside that block) and fills a 2 × 2 square of cells starting there, so the four must be **free** and inside the grid (the ghost is red
otherwise). Like every part it is turned freely (`A` / `D`, `W` / `S`): that chooses its axle and which way the 2 × 2 square extends (by default
its axle is X and it extends up and towards +Z). Its centre is the middle of the four cells, so at ground level it overhangs
the floor a little and the whole creation spawns slightly higher. It has the same **Tire** and **Suspension** controls
as the normal wheel, cannot be painted, and turns more slowly (it still covers more ground per turn). Removing any of its
4 cells (or its block) removes it. Inspecting it shows *Occupies* and its *Axle*.

### Rotating the part to place (`A` / `D`, `W` / `S`)

In Build mode you can turn the part you are about to place in **quarter turns around all three axes** (any of the faces up):

- **`D`** / **`A`**: a quarter turn **clockwise / counter-clockwise** around the vertical axis (seen from above);
  the **↺ ↻ buttons** in the top bar do the same.
- **`W`** / **`S`** (the **`↑`** / **`↓`** arrow keys work too): **tilt** the part up or down a quarter turn, around the horizontal axis that is the
  screen's left-right (so it follows the camera: `W` turns the top of the part away from you, `S` towards you); the **↑ ↓ buttons** do the same.
  `W` / `A` / `S` / `D` are only used to rotate the part while building (they drive while playing).
- The placement preview **turns smoothly** to the chosen orientation (always the quarter turn you asked for, never an extra twist; it is a quaternion
  interpolation towards the orientation you chose, see `BuildMode.update`). If the studs lie along the tilt axis (they point to the
  right or left of the screen), `W` / `S` roll the part around the other horizontal axis instead, so the key always does something: `W` points
  the studs up, `S` down. The orientation resets when you pick another part.

What it does for each part:

- **Blocks, plates and brackets**: the orientation is **which way the main studs point** plus, for shapes that are not square, a **spin** around them
  (`Part.studs` and `Part.spin`, shown as *Studs* in the inspector: Up, Down, +X, −X, +Z, −Z). Tilting a **plate** stands it up as a **wall**;
  a **block** with the studs to the side builds **sideways**. Studs connect only to studs pointing the same way (the studs of
  one go into the underside of the other), so a side-by-side pair of blocks with their studs both pointing +X is welded,
  and a plate upside down on a block's studs is not. The placement is checked exactly as before: no overlap, inside the build
  area, and supported (on the ground, or at least one stud engaged); with the studs sideways a block may hang from the
  side of another one. Nothing changes while the studs point up and you only press `A` / `D`.
- **Every part turns the same way, freely, in all directions**, with the same keys and the same smooth preview. Blocks, plates and brackets: the studs go with
  the turn; a **wheel**'s axle (its local X, *Axle* in the inspector) and a **large wheel**'s axle and reach go with it; an **engine**'s front (the fan) goes with it. The
  part only has to be **mounted** where it is allowed: wheels on the side faces of a block, an engine on any face, but its front cannot point into the block it is mounted on and it cannot be upside down, with its cylinder heads pointing down (the ghost turns red). A wheel with its axle
  along X is a normal wheel on a side face along X; turned a quarter turn it lies along the face, like a caster, and with its axle up or down it spins like a
  turntable (not driven: it is not aligned with the forward direction). The preview turns even for a part that looks the same after the turn
  (a square block with its studs up): you see every quarter turn.

The buttons are dimmed (and the keys do nothing) outside Build mode and with an empty hotbar slot; `W` / `A` / `S` / `D` and the arrows only rotate while
building (they drive while playing).

### Build mode

| Input | Action |
|---|---|
| Left click | Place the selected part on press (the left button never moves the camera) |
| Left drag (**Block** tool) | Keep the button down and move to **paint blocks**: every cell the pointer passes over gets a block (each one must be valid: on the ground or with a stud engaged). Painting is locked to the face where you started (ground, a block's top, or a side), so you draw a row or layer without growing towards the camera, and it keeps the half-cell offset it started with. Fast moves leave no gaps. Other parts (the wheel) are placed once per press |
| Right click | Remove the part under the cursor (removing a block also removes the wheels mounted on it) |
| Right drag | Pan the camera (a right press that moves is not a click, so nothing is removed). The camera stops at the ground: you cannot pan or orbit under the terrain |
| Middle drag | Rotate the camera |
| Scroll | Zoom |
| **Undo / Redo** buttons (top bar) or `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` (`Ctrl/Cmd+Shift+Z` also redoes) | Revert / reapply your edits. One step per action: a placed block or wheel, a removal (with its wheels), a whole paint stroke, or **Clear**. Up to 100 steps; the history is cleared when you open or create another game. Not available while playing |
| `1` – `9` or click a slot | Select the part in that hotbar slot (an empty slot places nothing) |
| `C` or the catalog button | Open / close the **parts catalog** |
| **Clear** (top bar) | Remove every part. A confirmation popup asks first (no popup when there is nothing to clear); the result can be undone |
| **Play** (top bar) | Switch to Play mode |

The ghost preview is the **part itself, translucent**; it turns **red** when the placement is not valid.

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

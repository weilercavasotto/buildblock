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

In the **top-left corner, right under the home button**, there is a **zoom control** made of three parts stacked vertically: the `+` button on top (a key like the home and help buttons), the
bar in the middle, with no card around it (the zoom percentage at its top and a vertical slider below it, top = closest) and the `−` button
at the bottom. The percentage is the slider position: **0%** at the farthest zoom and **100%** at the closest (the zoom itself is logarithmic, as before). It works together with the mouse
wheel: scrolling moves the slider, and dragging the slider or pressing the buttons zooms the camera. Zoom is limited
to a camera distance of **3 to 60 units** (`CAMERA.minDistance` / `CAMERA.maxDistance`, which are the `100%` and `0%` ends), for
the wheel, the buttons and the slider alike. It is shown while building and playing, not in the main menu.

## Sound

The game has **sound effects**, all **synthesised** by the Web Audio API (no audio files): a small tick or click on the buttons of the menus, dialogs and panels, a pop when you **place** a part (lower for a bigger one, a jelly wobble after it) and a bump when a placement is refused, a pop-down when you **remove** one, ticks for **rotate / tilt**, a short spray hiss (the same as the turbo's) for **paint**, a rising and a falling note for **undo / redo**, a chime when a game is opened or created, a sweep when the catalog and the other panels open and close, and the standard button click when **Play** starts, restarts (Reset / `R`) and stops. While **playing** the vehicle has its own voices: the **engine** (its pitch follows the speed and the throttle), the **earth** thrown up by the wheels, a **skid** hiss, the **brakes** squealing, the **thrusters** roaring, the **turbos** spraying (a hiss) while Shift is held, the **rotors** whirring (the pitch follows the speed, chopped as the blades pass), the **pistons** hissing out and thudding home, and a **thud** for every bump or crash (louder the harder). The **speaker button** at the top right (always visible, also in the menu) or the **`M`** key mutes and unmutes everything; the choice is saved. Browsers keep sound off until you click or press a key once, so nothing plays before that, and the game **goes silent when its tab is hidden** (another tab, a minimised window) and resumes when you come back. The tunables are in `src/constants/sound.ts`.

## Settings

The **gear button** at the top right, beside the speaker (always visible, also in the menu), opens the **Settings** panel (`Esc` or × closes it). **Sound**: the mute switch (the same as the speaker and `M`) and three volume sliders: everything, the interface and building sounds, and the vehicle. **Display**: the **FPS counter** (also `F3`) and the **controls panel** at the bottom left while playing. **Graphics**: the **shadows** (turn them off if the game runs slowly) and the **dust, smoke and flames** of Play. A change applies at once and is saved in the browser (`blocklab.settings`; the mute in `blocklab.sound`). To add a setting: a key in `SETTINGS_DEFAULTS` and a row in `SETTINGS_PANEL` (`src/constants/settings.ts`), and apply it in `applySettings` (`src/main.ts`).

## FPS counter and frame limit

Rendering is **capped at 60 FPS** on any display (a 75/120/144 Hz monitor also shows 60). The target is
`FRAME_LIMIT.targetFps` in `src/constants/game.ts`. A small frames-per-second readout, **off by default**, sits under the top-right buttons once you turn it on, in the building and Play modes (never in the main menu) (the **FPS counter** switch in the Settings, or **F3**). It is green at 55+ FPS, yellow
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

The game opens on the main menu (with a credit line at the bottom centre, "Developed by Weiler Cavasotto with a lot of ☕", drawn in `index.html` as `#menu-credit`): a random vehicle (a coupe, a pickup that may lift its cargo on a piston, a buggy with a spinning propeller or a rocket car that fires its thrusters, always freshly painted) wanders in the background while the camera orbits it.
Press **Play** to open the *Saved games* panel:

- **Load** opens a save; **Delete** asks for confirmation in a dialog (Enter/Cancel/Esc/click outside keep the save;
  only the red **Delete** button removes it).
- Each save shows its number of parts, its grid size and its date.
- **New game** opens the *New game* panel: type a name (optional, it defaults to "Creation N") and pick the **grid size** (Small 16 × 16, Medium 32 × 32, Large 64 × 64, the default and the biggest), then **Create**. The size is fixed for that game: blocks can only be placed inside the floor grid, which is drawn with one square per cell. Saves from before sizes existed are Large. A grid of `n` squares covers the cells `-n/2 … n/2 - 1` on x and z, and the build height is limited to `n` cells (`y` from 0 to `n - 1`) too.
- **Back** returns to the title screen (or from the New game panel to the saved games).

The bottom-right corner shows the game version (`vX.Y.Z`), read from `package.json` at build time
(`vite.config.ts` defines `__APP_VERSION__`). Bump the `version` field there to release a new version.

In the game, the **home icon** button (top-left, the first of the three) returns to the main menu. The **folder icon** button, between home and ⓘ, opens the same **Saved games** panel over the game, fading and popping in like the catalog (load, delete, New game; `Back` or `Esc` closes it; opening it while playing stops the simulation, and the game's shortcuts are off while it is open); loading a game goes through the loading screen as from the menu. Edits autosave, so nothing is lost by switching.

## Help

The **ⓘ button** in the top-left corner (or the `H` key) opens a help dialog with all the instructions, mouse
controls and keyboard shortcuts, split into tabs (Basics, Mouse & camera, Build & drive, Shortcuts). `Esc`, `H` or the
`×` button close it. It is available while building and playing, not in the main menu. The text lives in
`src/constants/help-content.ts`.

## Screen layout

| Where | What |
|---|---|
| Top left | the **home** button (back to the main menu), the **folder** button (saved games over the game) and **ⓘ Help**; the **zoom control** below the home button |
| Top centre | Bar with the cursor modes **Q W E**, the rotate buttons **A ↺ D ↻**, **Undo** and **Redo**, then **Clear** and **Play** (while playing it only shows **Stop**) |
| Right edge, centred | The **part inspector** (inspect mode, when a part is selected) |
| Top right | **FPS counter** |
| Bottom centre | **Hotbar**: 9 slots (`1`–`9`) and the **parts catalog** button (build mode only) |

## Controls

### Cursor modes (`I` / `B` / `E` / `R`)

The left part of the top bar has three **cursor modes**; press the key or click the button. They decide what the left
mouse button does (the middle button always rotates the camera, the right button pans, scroll zooms; while building, panning stops 10 cells beyond your creation, or anywhere in the grid when it is empty, so the zoom always works around what you are building, and the camera follows the vehicle freely while playing):

| Mode | Key | Left button |
|---|---|---|
| **Inspect** | `I` | **Drag** a box to select every part it touches on the screen (also parts hidden behind others; hold `Shift` to add to the selection, and `Shift`-click toggles a part); the inspector then shows how many parts of each kind are selected and a **Remove N parts** button (one undo step), plus six **arrow buttons** (up / down drawn against a bar, then forward, left, back, right; the tooltip names each) that **move the whole selection** (half a cell sideways, one plate up or down, as seen from the camera; the wheels and engines mounted on selected blocks go with them), and a **To the ground** button that moves the selection down until its lowest part (mounted parts included) rests on the ground. The same **Move** section is also at the top of the panel of a **single** selected part. The same works with the mouse: **press on a selected part and drag** to slide the selection along the ground (`Shift` + drag moves it up and down; one undo step per drag). A move only happens when every part can be placed where it lands (inside the grid, no overlap, a host block for what is mounted; support is not needed, so a lifted selection can hang in the air), so against an obstacle the selection stops (it slides along it when one axis is free). Press **`F`** with something selected and the **camera flies to it** (0.6 s, smooth), ending close to the part (or framing the whole selection, never nearer than the zoom limit) and looking from the same direction; a mouse press or the wheel takes control back. **Click** a part to select it: it gets a yellow outline and an **inspector panel** opens **centred on the right edge**, filling the height between the top bar and the hotbar (preview, position, how many blocks are welded into its rigid body, wheels attached or host block and axle, properties, a *Remove part* button; blocks also show their **Color**, which is changed in Paint mode, and a **Weight** slider; wheels have **Tire** and **Suspension** controls, see below) Clicking empty ground, the `×` or leaving the mode deselects. **Dragging rotates the camera** in this mode. Parts under the cursor are outlined in white |
| **Build** (default) | `B` | Places the part of the selected hotbar slot; drag to paint blocks (see below). A right click removes a part |
| **Paint** | `E` | A **palette** appears under the top bar; pick a colour (the first swatch is the default colour and removes paint) and click a block to paint it, or **drag** to paint several (one undo step). Wheels cannot be painted. Painting is undoable, saved and shown in Play. Not available in the catalog |
| **Remove** | `R` | Removes the part under the cursor; **drag to erase** several (one undo step, it does not drill through a stack: it needs some pointer movement between removals). The part under the cursor is outlined in red. A right click removes too |

Choosing a hotbar slot (`1`–`9`, a click or the catalog) switches back to **Build**. The key caps next to the icons are only drawn in windows
at least 1180 px wide (the shortcuts stay in the tooltips and the help); in a narrow window the top bar wraps onto a second row
instead of running under the home / help buttons. The shortcuts only work while
building (in Play they drive nothing by themselves: only the keys you gave to the parts do; while building they rotate the part to place). The modes are **icons** with their key cap beside them: a mouse cursor (Inspect), a hammer
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
(`A` / `D` do nothing) and nothing can be mounted on it (only on blocks). Clicking beside a block puts the plate at the level of its bottom.

The **underside** of every block, plate and bracket shows dark round sockets, one per stud position: that is the face that receives the studs of another part.

A plate standing as a wall snaps its thin side to the nearest lattice line **on the side of the pointer**, so it stays in the half cell you point at instead of jumping into the next one.

### More blocks, plates and L brackets

The catalog (*Structure*) has blocks, plates and L brackets in several sizes, named after their studs (see *Naming*): **1x1 Block** (0.5 × 1 × 0.5 cells, 1 stud), **1x2 Block** (0.5 × 1 × 1, 2 studs), **1x4 Block** (0.5 × 1 × 2, 4 studs, a beam), **1x1 Low Block** (0.5 × 0.6 × 0.5, 1 stud), **1x1 Tall Block** (0.5 × 2 × 0.5, 1 stud, a pillar), **2x2 Low Block** (1 × 0.6 × 1, 4 studs), **2x2 Block** (the basic cube, 1 × 1 × 1, 4 studs), **2x2 Tall Block** (1 × 2 × 1, 4 studs), **2x4 Low Block** (1 × 0.6 × 2, 8 studs), **2x4 Block** (1 × 1 × 2, 8 studs, two blocks in one piece), **4x4 Block** (2 × 1 × 2, 16 studs, four blocks in one), **1x1 Plate** (0.5 × 0.5, 1 stud), **1x2 Plate** (0.5 × 1, 2 studs), **1x4 Plate** (0.5 × 2, 4 studs, a strip), **2x2 Plate** (1 × 1, 4 studs), **2x4 Plate** (1 × 2, 8 studs), **4x4 Plate** (2 × 2, 16 studs), **4x8 Plate** (2 × 4, 32 studs), and four **L brackets**: a flat plate with a wall plate on its back edge, studs on top of the flat plate and on the outside of the wall (**1x2 L bracket**: 4 studs, **2x2 L bracket**: 8, **2x4 L bracket**: 1 × 2 flat plate and a 1 × 2 wall, 16, **4x4 L bracket**: 2 × 2 cells flat plate and a 2 × 2 wall, 32). They place, weld, paint, weigh and tilt like blocks and plates. Shapes that are not square also depend on `A` / `D` (which way they run, which side the wall is on); wheels are mounted only on the normal block. A part engages the studs of a wall when its own studs point the same way (tilt it with `W` / `S`).

**Naming:** a structural part is called `<studs wide>x<studs long> <Kind>` (`Block`, `Plate`, `L bracket`), counting the studs on its top face (one cell is 2 studs, so the basic cube is the **2x2 Block**); the narrow side comes first. The height is not in the name: blocks are one cell tall (except the **Low** blocks, three plates or 0.6 tall, and the **Tall** blocks, two cells tall, which say so: `2x2 Low Block`, `2x2 Tall Block`) and plates and brackets are a thin plate. For an L bracket the numbers describe its flat plate. Parts that are not structural keep a plain name (Engine, Wheel, Large wheel…).

### Slopes and wedges

Five **wedges** (*Structure*) are triangular prisms, half the volume of the box they fit in: the **2x2 Slope** (1 × 1 × 1, a 45° ramp), the **1x2 Slope** (0.5 × 1 × 1, narrow), the **2x4 Slope** (1 × 1 × 2, a gentle ramp of about 27°) and two thin ones, the **2x2 Slope Plate** and the **2x4 Slope Plate** (1 × 0.2 × 1 and 1 × 0.2 × 2, a plate thick at one edge and tapering to nothing: wings, spoilers, fairings and propeller blades and fairings). The tall (thick) edge is the **back**: turn them with `A` / `D` and tilt them with `W` / `S` like any part, so a slope can face any way or hang from a ceiling. A wedge has **no studs on the slope**: nothing can be built on it (the preview is red), but its **underside has sockets**, so it holds on the studs of the parts below it (or on the ground), and it welds into the body like any part. It collides as its real shape (a convex hull), so a car drives up it. Like every part it is a body that can be pushed: a ramp on the ground slides away under a car unless you give it weight (the Weight slider, up to 16) or weld it to something heavy. The occupancy test (what is "in the way") uses the whole box of the wedge, not just the solid half.

### Effects

A part you place **bounces like jelly**: it squashes, stretches and wobbles for about half a second (loading a game, undo and redo do not
bounce anything); a part you **remove** (right click, remove mode, the inspector button or Clear) swells a little and **pops away**, wheels and engines with it. In **Play**, the wheels throw up **earth** while they grip the ground and the vehicle moves (more and bigger clods with speed and wheel spin) and every
**engine** puffs **smoke** from its exhaust (more, bigger puffs the faster you go, a light puff already when you press the throttle) and **shakes**, a little at idle and a lot under power. Tuning: `FX` and `COLORS.fx`.

### The thruster

The **Thruster** (catalog, *Mobility*) is a small jet (a steel tube with an intake on the front, a flared dark bell nozzle and a glowing orange ring at the back) that you **mount on a face of a block**, like the engine, without taking the place of a block. Turn it freely (`A` / `D`, `W` / `S`): it pushes towards its **front** and the flame leaves the bell at the back. In Play, **holding its key** (see *Part keys*) every thruster pushes the **body it is mounted on** with a force along its front, applied **where it is mounted**, so one away from the centre of the body also turns it. It works on the ground or in the air, with or without an engine, and the wheels do not matter. A symmetric vehicle goes straight: while you do not steer (`A` / `D`) an upright vehicle holds its heading (a small driving assist; strong collisions, flips and steering switch it off), and an air drag above 10 m/s limits the top speed of a thruster car. The inspector has a **Thrust** slider (1-10, default 5, plus "apply to all the thrusters on this body"); the thrusts of a body's thrusters add up. One default thruster has a force of 100, enough to just lift a light 2 × 2 body (about 90 with the world's gravity); four of them lift it fast. A thruster weighs half a block. The flame is orange, bigger than the turbo's.

### Propeller and wings

The **Propeller** (catalog, *Mobility*) is a motor with spinning blades (a steel housing, a light spinner and two wooden blades; paint takes the housing and, once painted, the blades) that you **mount on a face of a block**, like the thruster, without taking the place of a block. Turn it (`A` / `D`, `W` / `S`) so the blades, its **front**, face the way it should pull; the front may not point into its block (the ghost turns red). Give it a key (*Propellers on / off*, a press switches it): while it is on the blades spin up in about a second and it pushes the body it is mounted on along its front, from where it is mounted (so one off the centre also turns the body). Like a real propeller it pushes hardest standing still and **less the faster the air already moves along its front**, falling to nothing at 45 m/s, which is the top speed of a plane it pulls. The inspector has a **Thrust** slider (1-10, default 5, plus "apply to all the propellers on this body"); one default propeller has a static thrust of 110, and the thrusts of a body's propellers add up. A propeller weighs 0.6 block.

The **Wings** (catalog, *Mobility*: the **4x3 Wing**, 2 × 1.5 cells, and the **8x6 Wing**, 4 × 3 cells) are thin pale **swept-back** wings, like one wing of an airliner seen from above: a flat plate 0.2 thick with a long straight root at the front, against the body, and a short tip at the very back, so the leading and the trailing edges both sweep back. A wing is flat and **the same on both faces**, so one part serves both sides of a plane: by default its root is on the -x side and its tip on +x (the left wing of a plane that flies towards +z), and **turned over (a half turn about its front, +z) it is its own mirror image**, the right wing; you rotate it with `A` / `D` / `W` / `S` until it sits the way you need. A wing has **no studs**, only sockets on both faces: it holds on the studs of the block below it (or, turned over, above it), **or** its root edge can be placed **against the side of a block** (like a wheel, at the height of the face you point at; the root, the long straight edge, has to face the block, so the preview is red until you turn it with `A` / `D`: the root faces -x by default, so on the -x side of a block turn it over), and either way it welds into the body (the same placement, rotation and paint; the Weight slider works too). In Play each wing feels the air that moves past it (the speed of the body at the wing, its turn included) and produces **lift**, perpendicular to the air and towards its top side, and **drag**. The lift grows with the wing's area (about 1.3 and 5.0 square cells) and the **square of its speed** and with the angle between the wing and the air (the *angle of attack*, up to a stall at about 45°): a flat plate with `C_L = sin(2a)`, plus a small built-in incidence so a wing lifts a little when it flies level. Its **front edge is +z** (the long straight root): turn it with `A` / `D` so it points the way the plane flies (stand a wing on edge with `W` / `S` for a tail fin). Put a wing on each side of the body (turned over for the other side), or on top of it, around the centre of mass and a little behind it, and a small pair on a tail further back: a wing far in front of the centre tips the nose up, wings behind it make the plane steadier. Every wing also damps the turn of its body a little, so a plane that is left alone settles instead of tumbling.

**Flight controls.** This is the pitch / roll / yaw control that was removed when the keys became assignable, now as actions of the wings. Every wing has six optional, held actions in the inspector: *Pitch up (nose up)*, *Pitch down*, *Roll left*, *Roll right*, *Yaw left* and *Yaw right* (see *Part keys*). While one is held the wing's **control surface** turns its whole incidence by up to 0.15 rad (the wing visibly tilts) over about 0.4 s, **the way that turns the plane as asked from where the wing is**: the game works out, for each wing, how a change of its lift would turn the body about its centre of mass (`PhysicsWorld.buildWingControls`). So a wing behind the centre lowers its lift to pitch the nose up and one ahead of it raises it, **wings on opposite sides do the opposite of each other to roll**, and an upright wing at the tail turns the plane left or right; a wing near the centre of mass does nothing for that turn. Select all the wings and give them the same keys (or *Copy these keys*): every wing then does its part, and the keys work like the old fixed ones. There is no autopilot, trim or stability assist: a badly balanced plane tips or stalls.

**Taking off.** A plane needs wheels (or a belly to slide on) and about 15-20 m/s: switch the propeller on, roll, and pitch up (the pitch key) to leave the ground; let go and the plane glides, and settles if it is balanced. A **helicopter** is wings on a **rotor** head (wings on opposite sides of the rotor head facing opposite ways, so each leads in its own motion): the blades lift as they turn, and the rotor spins its body the other way, so the body needs wheels (or a second, counter-rotating rotor) to hold it; it has no cyclic control, so it drifts. Measured: a 2 × 2 block with a plate, two 2x4 wings, a 2x4 wing on the tail and a propeller takes off at about 20 m/s, and holding the pitch key for 0.7 s lifts it off the ground; the roll keys lean it to either side.

### The rotor

The **Rotor** (catalog, *Mobility*) is a **spinning head** for propellers, fans, cranes and doors. Like the engine it is a separate unit that you **mount on any face of a block** (any block, not a plate or bracket): a round dark base against the block (a wide flange with bolts, a body and a light bearing ring) and, on top of it, a round orange **head** (paintable) with **4 studs** pointing away from the block, the same 2 × 2 studs as a plate. Turn it like any part (`A` / `D`, `W` / `S`) before placing: the head, with its studs, must point **away from the block** (the way the face points); it is never turned for you, so the preview is **red** until the orientation is right (on a top face the default one already is). Point at the head and click to build on its studs (the preview works there like on a plate). Whatever you build on the studs of the head (blocks, plates, brackets, and the wheels, engines and thrusters mounted on them) **is not welded to the rest of the creation**: it is its own rigid body, held to the block by a motorised hinge, and it **turns with the head** in Play. Press **`F`** while playing to switch every rotor on or off (they start off). In the inspector the **Speed** slider goes from -10 to 10: the sign is the direction (positive is **clockwise seen from the head**), the size is the speed (10 is 25 rad/s) and 0 holds the head still; switched off, a rotor coasts to a stop. Tips: put the plate or the bar of your propeller **centred on the head** and symmetrical, or the spinning mass shakes the body; do not let what is on the head touch the studs of the rest of the creation (it would be welded to it, and the rotor stays rigid); the head and its parts pass through the base and the block they are mounted on (their contacts are off), but collide with everything else, and the block feels the reaction, so a heavy propeller on a light block spins the block the other way.

### The hinge

The **Hinge** (catalog, *Mobility*) is a **servo hinge**: a flat dark base that you mount on a face of a block, like the rotor and the piston (any face of any block, turned with `A` / `D`, `W` / `S` until the head, with its studs, points away from the block: the preview is red otherwise), with a thin **teal head** on top with 4 studs and a light **pin** along one edge of the base. In Play the head swings open **like a lid on that pin**, carrying everything built on its studs, to the **angle** you set, and stays there. Turn the hinge (`A` / `D` around the head) to put the pin on the edge you want. Like every part it needs a key (*Action Keys* in the inspector: *Hinges open / close*, a press action): the first press opens it, the next closes it (it starts closed). The inspector has an **Angle** slider, 15° to 180° in steps of 15° (default 90°), and a **Strength** slider (1-10, default 5): how stiffly the servo holds the angle (its spring stiffness scales with it, `hingeStiffness`). The head moves at about 90° per second (`HINGE.speed`) and the servo motor holds it at the target whatever it carries: with a heavy lid (two large blocks, 8 blocks of weight) the sag at rest measured about 13° at strength 1, 3° at the default and under 2° at 10, and the head reaches and holds the open angle at every strength; when the head touches the studs of the rest of the creation the two are welded and it cannot move (as with the rotor). The base weighs 0.7 blocks and the head can be painted. Use it for doors, hatches, ramps, folding wings and arms. The hinge makes the piston's sound while it moves.

### The piston

The **Spring** (catalog, *Mobility*) is a passive elastic mount: a coil that pushes everything built on its head away from the block and gives under a load. It is mounted like the piston (any face of any block **or flat plate**, the one part that can be mounted on plates; turned with `A` / `D`, `W` / `S` until the head, with its studs, points away from the base; the preview is red otherwise) and has a green head with **4 studs** (paintable). It has **no key**. Whatever is on the head is its own rigid body, joined to the block by a slider along the face with a spring on it: when Play starts the spring unfolds to its **Length** (0.5 to 3 cells, default 1 cell, a slider in the inspector) at 2 cells per second, and then the load decides: the spring constant is fixed by the **Stiffness** slider (1-10, default 5; it doubles every 2 steps), so **the heavier the load the more it is compressed** (the default sinks about a quarter of a cell under 4 blocks, measured 0.135 under 2.1 blocks), and it is under-damped, so a bump makes it bounce. The head may go from fully compressed to twice the length. Use it for shock absorbers, bumpers, trampolines and suspension arms. As with the piston, keep what is on the head from touching the studs of the rest of the creation (it would be welded to it and the spring stays rigid).

The **Piston** (catalog, *Mobility*) lifts things: it pushes up everything built on its head and **holds it there**. It is mounted like the rotor (on any face of a block, turned with `A` / `D`, `W` / `S` until the head, with its studs, points away from the block, otherwise the preview is red; it is never turned for you) and its head is the same kind of round disc with **4 studs** that you build on (silver by default, paintable). Whatever is on the head is its own rigid body, joined to the block by a slider along the face, and moves with the head. Press **`G`** while playing: the head slides out at 1.5 cells per second and **stays out** until you press `G` again, when it slides back (all the pistons together; they start folded). A steel **rod** shows between the barrel and the head while it is out. The **Stroke** slider in the inspector sets how far it goes: 1 to 6 half cells (0.5 to 3 cells, default 1 cell). A spring holds the head, so it lifts whatever you put on it, but a very heavy load makes it sag a little and presses on the block it is mounted on. As with the rotor, keep what is on the head from touching the studs of the rest of the creation (it would be welded to it and the piston stays rigid).

### The turbo

The **Turbo** (catalog, *Mobility*) is a nitrous bottle (blue by default, with a white band, a brass valve and a dark nozzle) that you **mount on a face of a block**, like the engine, without taking the place of a block. Turn it freely (`A` / `D`, `W` / `S`): its nozzle, where the flame leaves, is the back of the bottle. In Play, **holding its key** (see *Part keys*) boosts the **driven wheels** of its body (the wheels an engine powers): they turn up to 40% faster and push twice as hard for each turbo of the default boost, with a blue-white flame out of the nozzle; without an engine on the body the turbo does nothing, and wheels that are not driven are not boosted. The inspector has a **Boost** slider (1-10, default 5, plus "apply to all the turbos on this body"); the boosts of a body's turbos add up, up to three times one default turbo. There is no charge limit yet: the boost lasts as long as you hold the key. A turbo weighs one block. Measured on a 2 × 2 car after 3 s at full throttle: 9.0 m/s without, 12.7 m/s with a default turbo and 13.3 m/s with the strongest one (the speed is also limited by the wheels' grip).

### The brake

**Every wheel has a brake** (a drilled steel disc with a red caliper behind the rim; the rims are open between the spokes, so you can see it). There is no brake part: select the wheel in inspect mode and the inspector has the **Brake** strength slider (1-10, default 5, with "apply to the wheels on this body", saved and undoable like the tire and the suspension) and the wheel's **key section** (*Action Key*). A wheel brakes only when it has a key: in Play, **holding that key** (see *Part keys*) holds back every wheel with it, driven or not (it overrides the throttle for them); a wheel with no key never brakes, and the bell does not count it. Measured on a 2 × 2 car at 8.9 m/s: no brake stops in 2.9 s, brakes (5) on the two front wheels in 2.2 s and on all four in 0.7 s (10: 0.6 s); a locked wheel is limited by its grip. Games saved with the old Brake part keep the strength of the wheels that had one.

### The engine

The **Engine** (catalog, *Mobility*) is what drives the wheels. It is a separate unit, not a block: a small **V engine** (a 0.8-cell cube: aluminium crankcase, two banks of cylinders with bores, dark oil pan and intake) that you **mount on a face of a block** (top, bottom or sides) like a wheel, without taking the place of a block. Its cylinder heads point away from the block and the **fan** (blades in a ring, with a small yellow nose) marks its **front**. In Play the vehicle is pushed **towards the front of its engine**: turn it with `A` / `D` (around the vertical axis) and `W` / `S` (tilt it up / down) before placing; turned the other way, its *Accelerate* key drives the other way, and an engine facing sideways or up does nothing. Give it keys in the inspector (*Accelerate*, optionally *Reverse*: see *Part keys*): it has no default key, and nothing drives until it has one. The front cannot point into the block it is mounted on (the ghost turns red). Wheels are driven only by the engines mounted on **their body** (the blocks welded together); wheels on a body without an engine roll freely, and a message under the top bar tells you when no wheel is driven. The inspector has a **Power** slider (1-10, default 5, plus "apply to all the engines on this body"): a body's engines add their power and share it among its wheels; one default engine drives 4 wheels at full torque, more wheels get less each, fewer get up to twice as much. An engine weighs as much as two blocks. Removing the block an engine is mounted on removes the engine. Games made before the engine existed keep driving every wheel; new games need an engine. **Where it is mounted matters:** while you accelerate on the ground the engine's push also acts on the body from the place where it sits (a lever about the body's centre of mass), so a **high engine tips the nose down** under power (and up when reversing), one **off to a side pulls the vehicle that way**, and a low, central one barely does; heavier vehicles feel it the same way (the push scales with the body's mass). It is tuned with `ENGINE.leverage`.

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
  `W` / `A` / `S` / `D` are used to rotate the part while building (they can be given to parts as keys for playing).
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
building (in Play they are free to be given to parts as keys).

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

### Part keys

**Nothing moves until you give it a key**, and this is a rule of the game: no part comes with a key (not even `W` / `S` / `A` / `D`), and every mobility part is run by keys *you* assign. Select the part in inspect mode (`I`): the inspector starts with an **Action Keys** section, one block per **action** of the part:

| Part | Actions (held = works while the key is down, press = each press switches it) |
|---|---|
| **Engine** | *Accelerate* (held, required) and *Reverse* (held). Each engine has its own throttle: engines on different keys work apart; a wheel takes the throttle of the engines of its body, weighted by their power (engines that push the same way and are not all pressed give a part of the throttle) |
| **Wheel** (small and large) | *Steer left*, *Steer right* (held, optional: differential drive, as the old `A` / `D`; a wheel with no steering key keeps going straight, so you can make only some wheels steer) and *Brake* (held, optional) |
| **Rotor** | *Rotors on / off* (press) |
| **Piston** | *Pistons out / back* (press) |
| **Thruster** | *Thrust* (held) |
| **Propeller** | *Propellers on / off* (press) |
| **Wing** (4x3 and 8x6) | *Pitch up / down*, *Roll left / right*, *Yaw left / right* (held, all optional): each wing moves its control surface the way that turns the plane that way from where it is |
| **Turbo** | *Turbo boost* (held) |

- **Assigning**: each action shows its keys as chips (or *No key*, in red when the action is required, greyed when it is optional). **Add a key** waits for the next key press and adds it (`Esc` cancels, `Backspace` clears the action); a **trash** button clears the action; **click a chip** to remove just that key. An action can have **several keys** (up to 4: `W` and `↑`, say). The keys are saved with the part as physical keys (`KeyboardEvent.code`, shown with the name on the player's keyboard where the browser can tell).
- **Parts with the same key work together**, so one key can run a whole group and different keys run them one by one. A press flips the *press* actions bound to it; a held key runs the *held* ones.
- **Several parts at once**: with a selection the inspector has one block per kind of action in it (*Wheel (4): Steer left*...): adding a key gives it to all of them. A single part also offers *Copy these keys to all N …* to give all its keys to every part of its kind.
- **Reserved keys**: only `R` (restart), `P` (play / stop), `H` (help) and `M` (mute) are used by the game and refused. Letters, digits, the arrows, `Space`, `Shift`, the numeric pad and the punctuation keys are fine, **also the editing keys** (`I`, `B`, `C`...: they do nothing while playing). The list is `RESERVED_KEYS` in `src/constants/part-keys.ts`.
- **Alerts**: the **bell** at the top right (next to settings and sound; hidden in the main menu) shows a red **badge** with the number of parts that have an action without a key, *required* (an engine's *Accelerate*, a rotor's, a piston's, a thruster's, a turbo's) or *optional* (a wheel's steering and brake, an engine's *Reverse*). Click it for the list: first the parts with a required action missing, then the *Optional keys*, grouped by kind and saying what is missing; while building, a row takes you to that part (inspect mode, the camera flies to it).
- The **Controls** panel at the bottom left in Play lists each key with what it runs (`W` *2 × Accelerate*, `A` *4 × Steer left*...), and counts the parts that still need a key.
- **Old games**: a game saved with one key per part keeps it on the part's first action (a wheel's brake); games without it load with every key empty, so the bell lists them. A game saved before engines existed (`engineDrive` false) has nothing to give driving keys to, so its wheels still drive with `W` / `S` and steer with `A` / `D` (and the arrows).
- **Flight controls** are the wings' pitch / roll / yaw keys (see *Propeller and wings*): while keys were fixed, a vehicle in the air could be pitched, rolled and yawed with `W` `S` `A` `D` `Q` `E`; that is gone, and the same control is now given by the keys you assign to the wings.

### Play mode

The vehicle moves only with the keys you gave to its parts (see *Part keys* above):

| Key | Action |
|---|---|
| `R` | Restart the simulation from the build (also the **Reset** button, left of Stop in the top bar) |
| *your keys* | The keys you gave to the **Engines** (accelerate / reverse), **Wheels** (steer, brake), **Rotors**, **Pistons**, **Propellers**, **Wings** (pitch / roll / yaw), **Thrusters** and **Turbos** (see *Part keys*): held actions work while the key is down, rotors and pistons switch on / out and off / back with each press. Nothing moves without keys: `W` `A` `S` `D` and the arrows have no fixed meaning |
| `P` / `Esc` | Stop and return to build mode (the same as **Stop**); `P` in build mode starts Play (an open dialog takes the `Esc` first) |
| **Stop** | Return to build mode; the build is untouched |

## Persistence

Every change is saved automatically to the **active save** in `localStorage` (key `blocklab.saves.v2`,
a list of `{ id, name, updatedAt, parts }`). Saves from the old single-slot format (`blocklab.v1`) are
migrated once into a save called "My creation". There is no export/import yet.

## Dev-only debug hook

In dev mode (`npm run dev`) `window.__blocklab` exposes `{ grid, camera, controls, getPhysics, getMode, menuScene, build, history, zoom }`
for inspection from the browser console. It is stripped from production builds
(`import.meta.env.DEV`).

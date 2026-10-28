/** Content of the help dialog (src/ui/help-dialog.ts). Keep it in sync with the controls. All English. */

export interface HelpRow {
  /** Keys / mouse actions shown as key caps; several entries mean alternatives ("W / ↑"). */
  keys?: string[];
  /**
   * One line per paragraph (separate them with \n); a line that starts with "- " is a bullet (consecutive ones make one list) and a
   * line that ends with a colon is a lead-in for what follows. Keep a paragraph short: split a long text into a summary and bullets.
   */
  text: string;
}

export interface HelpSection {
  heading: string;
  rows: HelpRow[];
}

export interface HelpTab {
  id: string;
  title: string;
  sections: HelpSection[];
}

export const HELP_TABS: HelpTab[] = [
  {
    id: 'basics',
    title: 'Basics',
    sections: [
      {
        heading: 'What is BuildBlock?',
        rows: [
          {
            text: 'Build vehicles out of blocks and wheels on a grid, then press Play to drive them with real physics.',
          },
        ],
      },
      {
        heading: 'How it works',
        rows: [
          { keys: ['Hotbar'], text: 'The bar at the bottom holds up to 9 parts. Press 1–9 or click a slot to choose what you place.' },
          { keys: ['Catalog'], text: 'The button at the right of the hotbar (or C) opens the parts catalog, where you can inspect every part and drag it onto a slot.' },
          { text: 'Place blocks to make a body, then mount wheels on their sides.\n- Blocks and plates stacked on each other\'s studs become one rigid piece; blocks side by side are not welded.\n- Four wheels and a body make a car.' },
          { keys: ['Play'], text: 'In the top bar: drive your creation. Stop brings you back to building, with your build untouched.' },
        ],
      },
      {
        heading: 'Good to know',
        rows: [
          { text: 'The ghost preview is the part itself, translucent, and turns red when it cannot be placed there.' },
          { text: 'Everything is saved automatically to the game you opened. Use Menu to switch or start a new game.' },
        ],
      },
    ],
  },
  {
    id: 'mouse',
    title: 'Mouse & camera',
    sections: [
      {
        heading: 'Cursor modes',
        rows: [
          { keys: ['I'], text: 'Inspect mode: select parts and look at them.\n- Click a part to select it; its details open in a panel centred on the right edge. Clicking empty ground deselects.\n- Drag with the left button to draw a box and select every part it touches (hold Shift to add to the selection, or Shift-click parts to toggle them).\n- With several parts selected the panel lists them and can remove them all at once.\n- The arrow buttons (up and down against a bar, then forward, back, left and right) move the selection half a cell (a plate up or down) as seen from the camera; To the ground moves it down until the lowest part rests on the ground. The same Move section is at the top of the panel of a single part.\n- Or press on a selected part and drag to move the whole selection along the ground (hold Shift to move it up and down). A move whose parts do not fit does nothing.\n- F flies the camera to the selection and ends close to it, looking from the same direction. Rotate the camera with the middle button.\n- The panel also shows the part\'s colour, a block\'s Weight slider (1-16: heavier blocks make the body slower to accelerate and steer), and a wheel\'s Tire slider (speed to traction) and Suspension slider (soft to firm), both applied in Play.' },
          { keys: ['B'], text: 'Build mode (default): the left button places the part of the selected hotbar slot.' },
          { keys: ['E'], text: 'Paint mode: pick a colour in the palette under the top bar (the first swatch restores the default colour), then click a block to paint it.\n- Drag to paint several (one undo step).\n- Wheels cannot be painted.' },
          { keys: ['R'], text: 'Remove mode: the left button removes the part under the cursor; drag to erase several (one undo step). Parts under the cursor are outlined in red.' },
          { text: 'The modes are in the top bar, on the left. Choosing a hotbar slot switches back to Build.' },
        ],
      },
      {
        heading: 'Building (Build mode)',
        rows: [
          { keys: ['Left click'], text: 'Place the selected part.' },
          {
            keys: ['Left drag'],
            text: 'Place several: keep the button down and move.\n- The same part is placed on the face where you started (a row, a layer or a wall).\n- Parts go a whole part apart (a 2x4 plate a plate length, a block a cell).\n- Parts that do not fit are skipped.\n- The whole stroke is one undo step.',
          },
          { keys: ['W', 'S'], text: 'Tilt the part to place a quarter turn up or down, around the screen\'s left-right axis (W / S, the ↑ ↓ arrow keys, or the ↑ ↓ buttons in the top bar).\n- A plate stands as a wall, a block lies with its studs to the side, a bracket lies on its back.\n- A wheel\'s axle points up or down, an engine faces up or down.\n- Every part turns the same way, in all directions.\n- Studs only connect to studs pointing the same way.' },
          { keys: ['A', 'D'], text: 'Rotate the part to place a quarter turn (A counter-clockwise, D clockwise; also the ↺ ↻ buttons in the top bar).\n- The preview follows, also for parts that look the same after the turn.\n- Every part rotates freely this way: a wheel\'s axle, an engine\'s front and a large wheel\'s reach turn with it.' },
          { keys: ['Right click'], text: 'Remove the part under the cursor (Build and Remove modes). Removing a block also removes its wheels.' },
        ],
      },
      {
        heading: 'Camera',
        rows: [
          { keys: ['Middle drag'], text: 'Rotate the camera.' },
          { keys: ['Right drag'], text: 'Move (pan) the camera.\n- While building you cannot pan farther than 10 cells from your creation (the whole grid when it is empty), so the zoom always works around what you are building.' },
          { keys: ['Scroll'], text: 'Zoom in and out.' },
          { text: 'The zoom panel (top left, under the home button) shows the zoom level and has + / − buttons and a slider. Zoom is limited so you cannot go too close or too far.' },
        ],
      },
    ],
  },
  {
    id: 'build-drive',
    title: 'Build & drive',
    sections: [
      {
        heading: 'Hotbar and catalog',
        rows: [
          { keys: ['1 – 9'], text: 'Select the part in that hotbar slot. An empty slot places nothing.' },
          { keys: ['Drag a slot'], text: 'Drop it on another slot to swap them, or drag it out of the bar to empty it. A right click also empties a slot.' },
          { keys: ['Catalog'], text: 'Parts are grouped in tabs by category.\n- The search field (press / to jump to it) filters them by name or description.\n- Hover a part to spin its 3D preview, and click it to inspect it on the right.\n- Drag a part onto a hotbar slot.' },
        ],
      },
      {
        heading: 'Parts',
        rows: [
          { keys: ['2x2 Block'], text: 'A cube with 4 studs on top.\n- Place it on the ground, or on top of (or under) another block or plate with at least one stud engaged.\n- The pointer position chooses whether it rests on 4, 2 or 1 stud (half-cell steps).\n- Stacked parts are welded.' },
          { keys: ['1x1 Block', '1x2 Block', '1x4 Block', '2x4 Block', '4x4 Block', 'Low Blocks', 'Tall Blocks'], text: 'Other block sizes, with the same placement and welding as the 2x2 Block.\n- Low blocks (1x1, 2x2, 2x4) are three plates tall (0.6); tall blocks (1x1, 2x2) two cells tall (2).\n- Smaller and longer ones: a single stud (0.5 × 1 × 0.5), half a block (0.5 × 1, 2 studs), a beam (0.5 × 1 × 2, 4 studs), two blocks in one piece (1 × 1 × 2, 8 studs) and four in one (2 × 1 × 2, 16 studs).\n- Wheels, engines, turbos, thrusters, propellers, rotors and pistons can be mounted on any of them (on a face wider than a cell, the part follows the pointer in half-cell steps).' },
          { keys: ['2x2 Plate'], text: 'A thin square panel (a fifth of a block) with 4 studs.\n- It ties blocks together: one plate on two side-by-side blocks welds them.\n- Good for floors and panels.\n- Same placement as a block. Add it to the hotbar from the parts catalog (C).' },
          { keys: ['1x1 Plate', '1x2 Plate', '1x4 Plate', '2x4 Plate', '4x4 Plate', '4x8 Plate'], text: 'Plates of other sizes. Turn them with A / D to choose which way they run.\n- Small: a single stud (0.5 × 0.5), half as wide (0.5 × 1, 2 studs) and a strip (0.5 × 2, 4 studs).\n- Large: 1 × 2 cells (8 studs), 2 × 2 cells (16 studs) and a big deck of 2 × 4 cells (32 studs).' },
          { keys: ['1x2 L bracket', '2x2 L bracket', '2x4 L bracket', '4x4 L bracket'], text: 'Two plates at a right angle: a flat plate with studs on top and a wall with studs on its outside (4, 8, 16 and 32 studs).\n- A / D turn the wall to the side you need.\n- A part engages the wall studs when its own studs point the same way (tilt it with W / S).' },
          { keys: ['2x2 Slope', '1x2 Slope', '2x4 Slope', '2x2 Slope Plate', '2x4 Slope Plate'], text: 'Wedges: a 45° ramp (a block tall), a narrow one, a gentle one (about 27°) and two thin tapering plates for spoilers and fairings.\n- The thick edge is the back; turn and tilt them like any part (A / D, W / S).\n- They have no studs on the slope, so nothing can be built on it, but they hold on the studs of the parts below them.\n- They collide with their real shape, so a car drives up them.\n- A wedge is a body like any other: give a ramp weight (the inspector slider) so it stays put.' },
          { keys: ['2x2 Ballast'], text: 'A block-sized cube of dense metal with an amber band, 8 times as heavy as a normal block (its weight cannot be changed).\n- Same studs, placement and welding as the 2x2 Block, but nothing is mounted on it.\n- Build it low and near the middle of a vehicle to lower its centre of mass so it does not tip over in turns.\n- Or put it at one end of a plane to balance it.' },
          { keys: ['1x1 Tile', '1x2 Tile', '2x2 Tile', '2x4 Tile', '4x4 Tile'], text: 'Tiles: plates with a smooth top and no studs (0.5 × 0.5, 0.5 × 1, 1 × 1, 1 × 2 and 2 × 2 cells, a plate thick).\n- Sockets underneath: a tile is held by the studs of the parts below it and welds into the body like a plate.\n- Nothing can be built on top of it: for smooth floors, roofs and panels.\n- Same placement, turning and tilting as a plate.' },
          { keys: ['2x2 Round Brick', '2x2 Round Plate', '4x4 Round Brick'], text: 'Round parts: cylinders a block tall (1 cell across with 4 studs, and 2 cells across with 12 studs) and a thin round plate (1 cell across, 4 studs).\n- Only the studs inside the circle exist, so the corners of the big one are bare.\n- They occupy the square of cells around them and place and weld like blocks (A / D turn, W / S tilt).\n- They collide as true cylinders, so one laid on its side rolls.\n- Wheels, engines and other mounted parts do not go on them: use a block for that.' },
          { keys: ['2x2 Glass', '4x4 Glass', '2x2 Windscreen', '2x4 Windscreen'], text: 'Translucent glass: flat panes (1 × 1 with 4 studs and 2 × 2 with 16 studs, a plate thick) and windscreens (a 45° glass wedge and a raked 27° one).\n- Panes place and weld like plates.\n- Windscreens behave like slopes: no studs on the slope, held by the parts below; the thick edge is the back (A / D, W / S).\n- You see through them, but they are solid: they collide and weigh like their plain counterparts.\n- Paint tints the glass; it stays translucent.' },
          { keys: ['Thruster'], text: 'A small jet that pushes its body, no wheels needed.\n- A separate unit: click any face of a block to mount it there (it does not take the place of a block).\n- Turn it (A / D, W / S) so its front points the way it should push; the bell and the flame are at the back.\n- Give it a key in the inspector (no part comes with one). While you hold the key in Play it pushes the body towards its front, from where it sits (so one off the centre also turns the body), on the ground or in the air, with or without an engine.\n- The thrusts of a body\'s thrusters add up; its strength is a slider in the inspector (1-10).' },
          { keys: ['Propeller'], text: 'A motor with spinning blades that pulls a plane through the air.\n- A separate unit like the thruster: click any face of a block to mount it there. Its front, the side with the blades, may not point into the block; turn it (A / D, W / S) so the blades face the way it should pull.\n- Give it a key in the inspector: each press switches it on or off. While it is on the blades spin up (about a second) and it pushes the body towards its front, from where it sits.\n- It pushes hardest standing still and less the faster the air already moves along it, so a plane has a top speed.\n- Its strength is a slider in the inspector (1-10); the pushes of a body\'s propellers add up.' },
          { keys: ['Ski'], text: 'A runner with almost no friction, for sleds.\n- Mounting: click a side face of a block (not the top or bottom) to mount it in the cell beside the block, like a wheel; an arm joins it to the block.\n- It must lie flat with its length along the face (the preview is red otherwise). Turn it with A / D so the curled tip points the way the body slides; W / S, which would tilt it, are not allowed.\n- Its underside is level with a normal wheel, so the body rides a little above the ground, and where a wheel grips the ski glides and keeps its speed.\n- Steering: in the inspector give it Steer left / Steer right keys (the same ones on the skis you want to turn, usually the front pair). While a key is held its runner turns up to 20 degrees, less than a wheel, and its edge, which grips sideways, pulls the body round. Skis without keys hold their line, and a hard turn at speed also bleeds speed.\n- A body on skis that is touching the ground and nearly upright does not pitch or roll (it stays level and follows a ramp), so a thruster on top does not tip it over; it still turns about its vertical axis.\n- Put two or four under a body and push it with a thruster or a propeller, or start it down a ramp. Skis can share a car with wheels. It has no other settings.' },
          { keys: ['Headlight'], text: 'A round lamp.\n- A separate unit like the propeller: click any face of a block to mount it there. Its front, the side with the lens, may not point into the block; turn it (A / D, W / S) so the lens faces the way it should shine.\n- Give it a key in the inspector (no part comes with one): each press switches it on or off in Play, and the lens glows and a faint cone of light shows in front of it. Lamps with the same key switch together.\n- It is a look only: it lights nothing else and does not change the physics.\n- Paint colours the housing.' },
          { keys: ['Siren'], text: 'A police beacon, in the Lighting category with the headlight.\n- A separate unit like the headlight: click any face of a block to mount it there. Its front, the side with the dome, may not point into the block; turn it (A / D, W / S).\n- Give it a key in the inspector (no part comes with one): each press switches it on or off in Play. While it is on its red and blue halves flash in turn and a siren wails (M mutes it).\n- It is a look and a sound only and does not change the physics.\n- Paint colours the base.' },
          { keys: ['Parachute'], text: 'A parachute and air brake.\n- A separate unit like the propeller: click any face of a block to mount it there. Its front, the side the canopy opens towards, may not point into the block; turn it (A / D, W / S).\n- Give it a key in the inspector: each press opens the canopy (in a fraction of a second) or folds it again.\n- While it is open it drags the body against its velocity, harder the faster it goes: it slows a fall to a steady speed and stops a fast car or a landing plane.\n- Its canopy size is a slider in the inspector (1-10). The drags of a body\'s parachutes add up, and one away from the centre also turns the body.' },
          { keys: ['4x3 Wing', '8x6 Wing'], text: 'Wings: thin swept-back wings like one wing of an airliner seen from above, in a small and a big size.\n- A wing is flat and the same on both faces, so one part serves both sides of a plane: turned over (a half turn about its front) it is its own mirror image. Rotate it with A / D / W / S until it is the way you need.\n- It has no studs, only sockets on both faces: it holds on the studs of the block below it (or above it, turned over), or you can place one against the side of a block (point at the face, at any height). Its straight root edge must face the block, so turn it with A / D until the preview is not red. Either way they weld into the body.\n- In Play they feel the air they move through: each lifts towards its top side in proportion to its area and the square of its speed, with a little drag, and lifts a little even when it flies level.\n- The front (+z, the long straight root edge) must point the way the plane flies: turn it with A / D.\n- Layout: put a wing on each side of the body, around its centre, a little behind it, and a small pair on a tail further back. A wing far in front of the centre tips the nose up. A plane needs wheels (or a belly to slide on) to take off.\n- Control surfaces: every wing has one that you run with keys in the inspector (all optional, held): Pitch up / down, Roll left / right and Yaw left / right. Each wing moves its surface for the keys that turn the plane that way from where it sits, so give every wing the same keys (select them all, or use Copy these keys).\n- The wings behind the centre do the pitching, wings on opposite sides the rolling (opposite ways), and an upright one on the tail (stand it up with W / S) the yawing.\n- A rotor turning wings is a helicopter; it spins its body the other way, so wheels or a second, counter-rotating rotor hold it.' },
          { keys: ['Hinge'], text: 'A servo hinge: the head swings open like a lid on a pin along one edge, to an angle, and stays there.\n- A separate unit like the rotor and the piston: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does). A / D also move the pin to another edge.\n- Build on the 4 studs of its flat head: what you put there is not welded to the rest of the creation and swings with the head. Keep it from touching the studs of the rest of the creation, or it is welded to it and cannot swing.\n- Give it a key in the inspector (Action Keys): each press in Play opens it to the angle, the next closes it.\n- The inspector has an Angle slider (15° to 180°, default 90°) and a Strength slider (1-10, default 5): how stiffly the servo holds the angle, so raise it for a heavy lid.' },
          { keys: ['Explosive bolt'], text: 'Drops a stage, for two-stage rockets.\n- A separate unit like the hinge: click any face of a block to mount it there, turned (A / D, W / S) so that its head, the amber plate with studs, points away from the block.\n- Everything built on the studs of the head is held to the block by the bolt as one rigid creation.\n- Give it a key in the inspector: pressing it in Play fires the bolt, once. The joint is gone and a small push sends the two parts away from each other, each on its own from then on (R restarts with the bolt whole).\n- Keep the upper stage from touching the lower one by studs anywhere else, or they stay welded.\n- Give the upper stage its own thruster on another key.' },
          { keys: ['Spring'], text: 'A passive spring: no key.\n- A separate unit like the piston: click any face of a block, plate or L bracket (the only parts besides blocks that take a mounted part; not slopes or wings) to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does).\n- Build on the 4 studs of its green head: what you put there is not welded to the rest of the creation and rides on the spring. Keep it from touching the studs of the rest of the creation, or the spring stays rigid.\n- In Play it unfolds to its Length, and the load compresses it: the heavier, the more, and a bump makes it bounce.\n- The inspector sets the Length (half a cell to 3 cells) and the Stiffness (1-10: a soft spring sinks and bounces, a stiff one barely moves).\n- The head can be painted.' },
          { keys: ['Piston'], text: 'Pushes up (or out) everything built on its head, and holds it there.\n- A separate unit like the rotor: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does).\n- Build on the 4 studs of its round head: what you put there is not welded to the rest of the creation and moves with the head. Keep it from touching the studs of the rest of the creation, or it is welded to it and cannot move.\n- Give it a key in the inspector (no part comes with one): each press in Play slides the head out, where it stays, and the next slides it back.\n- The inspector has a Stroke slider (half a cell to three cells).' },
          { keys: ['Rotor'], text: 'A spinning head for propellers, fans and cranes.\n- A separate unit: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does).\n- Its head is a round disc with 4 studs: whatever you build on those studs (blocks, plates, brackets, even wheels and engines on them) is not welded to the rest of the creation and turns with the head in Play. Keep it from touching the studs of the rest of the creation, or it is welded to it and cannot turn. Build it balanced so it does not shake the body.\n- Give it a key in the inspector (no part comes with one); each press in Play switches it on or off.\n- The inspector has a Speed slider (-10 to 10: the sign is the direction, clockwise seen from the head when positive; 0 holds it).' },
          { keys: ['Turbo'], text: 'A nitrous bottle that boosts the wheels of its body.\n- A separate unit: click any face of a block to mount it there (it does not take the place of a block) and turn it (A / D, W / S) so the nozzle, where the flame leaves, points backwards.\n- While you hold its key in Play (give it one in the inspector), the wheels that an engine drives, on the same body, turn faster and push harder.\n- Its boost (slider in the inspector, 1-10) adds up with the other turbos of the body; it does nothing without an engine.' },
          { keys: ['Engine'], text: 'Drives the wheels of its body.\n- A separate unit: click any face of a block to mount it there (it does not take the place of a block), and turn it (A / D, W / S) so the fan on its front points where the vehicle should go; it cannot point into its block, nor be upside down.\n- A body\'s engines add their power (slider in the inspector, 1-10); one engine of the default power drives 4 wheels at full torque, more wheels share it. It weighs two blocks.\n- Where you mount it matters: while you accelerate on the ground its push acts on the body from where it sits, so a high engine tips the nose down and one off to a side pulls the vehicle that way; a low, central one barely does.' },
          {
            keys: ['Wheel'],
            text: 'Click the side of a block to mount a wheel (not the top or bottom).\n- Its axle starts along X; turn it (A / D, W / S) in any direction before placing, e.g. a quarter turn to make it lie along the face like a caster.\n- Brake: every wheel has one. In the inspector (inspect mode, I) set its strength (1-10) and, if you want it to brake, give its Brake action a key; while you hold that key in Play every wheel with it is held back, driven or not.\n- Steering: give its Steer left / Steer right actions keys (the same ones on all the wheels you want to turn).',
          },
          {
            keys: ['Small wheel', 'Medium wheel'],
            text: 'Wheels of other sizes: the small wheel is half the size of the normal one (a toy-car wheel), the medium wheel one and a half times.\n- Both take one cell and are placed like the wheel, on the side of a block; a small wheel hangs low in its cell so it still reaches the ground.\n- They have the same Tire, Suspension, Brake and steering settings as every wheel.\n- Use the same size on both sides of an axle, or the car leans.\n- A wheel cannot be placed where its tire would overlap another wheel (the preview turns red): leave a gap between neighbouring wheels.\n- They are added to the hotbar from the parts catalog (C).',
          },
          {
            keys: ['Large wheel'],
            text: 'A wheel twice the size.\n- Click the side of a block, as with the wheel: it fills 2 x 2 cells starting at the cell you point at, so those must be free.\n- Turn it (A / D, W / S) to choose its axle and which way it extends.\n- It is added to the hotbar from the parts catalog (C).',
          },
        ],
      },
      {
        heading: 'Editing',
        rows: [
          { keys: ['Undo', 'Redo'], text: 'Buttons in the top bar. A whole paint stroke counts as one step.' },
          { keys: ['Clear'], text: 'In the top bar: removes every part after asking you to confirm (you can undo it).' },
          { keys: ['Menu'], text: 'Top-left home button: back to the main menu.' },
          { keys: ['Saved games'], text: 'Top-left folder button, between the home and help buttons: opens the saved-games panel over the game.\n- Load, delete or start a new game without going back to the main menu.\n- Back or Esc closes it.\n- Your edits are saved automatically, so loading another game does not lose anything.' },
        ],
      },
      {
        heading: 'Driving (Play)',
        rows: [
          { text: 'Nothing moves until you give it a key: no part comes with one, and W, A, S, D and the arrows drive nothing by themselves.\nGiving keys: select a part in inspect mode (I). The inspector has an Action Keys section with one block per action.\n- Click Add a key, then press the key. Esc cancels; Backspace clears the action.\n- Once there are keys, a trash button clears them; click a key chip to remove just that key.\n- An action can have several keys (W and ↑, say), and parts with the same key work together: give a group the same key and a single part its own.\n- With several parts selected the inspector sets the keys of each kind of action at once, and Copy these keys gives one part\'s keys to all of its kind.\nThe actions:\n- Engine: Accelerates (required) and Reverses.\n- Wheel: Steers left, Steers right and Brakes (all optional: a wheel with no steering key keeps going straight, and one with no brake key never brakes).\n- Switched on / off: a rotor, a propeller, a lamp and a siren. A piston goes out / back, a hinge opens / closes, a parachute opens / closes and a stage bolt fires once.\n- A thruster fires and a turbo boosts.\n- Wing: Pitch up / down, Roll left / right and Yaw left / right, all optional.\nHeld or pressed:\n- Thrusters, turbos, brakes, wing controls, accelerating and steering work while the key is held.\n- Rotors, pistons, hinges, propellers, lamps and sirens switch with each press.\nReserved keys:\n- Only R (restart), P (play / stop), H (help) and M (mute) are kept by the game; the editing keys (I, B, C...) can be used.\n- The bell at the top right counts the parts with a required action that has no key, and lists them; the Controls panel shows each key with what it runs.' },
          { keys: ['R'], text: 'Restart the simulation from your build (also the Reset button next to Stop).' },
          { keys: ['P'], text: 'Play, and stop again (the same as the Play / Stop button); Esc stops too.' },
          { text: 'Wheels are driven only by the engines mounted on their body.\n- Each engine has its own throttle (its Accelerate and Reverse keys), so engines on different keys work apart; a wheel takes the throttle of the engines of its body, weighted by their power.\n- An engine pushes the vehicle towards its front, the side with the fan: turned around, its Accelerate key drives the other way, and sideways it does nothing.\n- Steering is differential: a wheel with a steering key slows (or reverses) when its key says the vehicle should turn towards its side and speeds up for the other side.\n- Wheels on a body with no engine roll freely.\n- Games saved before the engine existed still drive every wheel, with W / S and A / D.' },
        ],
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Shortcuts',
    sections: [
      {
        heading: 'Build mode',
        rows: [
          { keys: ['I', 'B', 'E', 'R'], text: 'Cursor mode: Inspect, Build, Paint, Remove.' },
          { keys: ['A', 'D'], text: 'Rotate the part to place (counter-clockwise / clockwise).' },
          { keys: ['W', 'S'], text: 'Tilt the part to place up / down (the ↑ ↓ arrows too).' },
          { keys: ['1 – 9'], text: 'Select the part in that hotbar slot (and switch to Build).' },
          { keys: ['C'], text: 'Open or close the parts catalog.' },
          { keys: ['P'], text: 'Play (press P again to stop).' },
          { keys: ['Ctrl / Cmd + Z'], text: 'Undo.' },
          { keys: ['Ctrl / Cmd + Y', 'Ctrl / Cmd + Shift + Z'], text: 'Redo.' },
        ],
      },
      {
        heading: 'Play mode',
        rows: [
          { text: 'The keys you gave to the parts drive and run the vehicle (see the Controls panel at the bottom left); W / A / S / D only rotate and tilt the part to place while building.' },
          { keys: ['R'], text: 'Restart.' },
          { keys: ['P', 'Esc'], text: 'Stop and go back to building.' },
        ],
      },
      {
        heading: 'Anywhere in the game',
        rows: [
          { keys: ['Settings'], text: 'The gear button at the top right (beside the speaker) opens the settings.\n- Sound: mute and three volume sliders.\n- The FPS counter and the controls panel while playing.\n- Shadows, and the dust, smoke and flames.\n- They are saved.' },
          { keys: ['M'], text: 'Mute / unmute all sounds (also the speaker button at the top right). The choice is saved.' },
          { keys: ['H'], text: 'Open or close this help.' },
          { keys: ['F3'], text: 'Show or hide the FPS counter.' },
          { keys: ['Esc'], text: 'Close this help or a confirmation dialog.' },
        ],
      },
    ],
  },
];

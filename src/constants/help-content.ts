/** Content of the help dialog (src/ui/help-dialog.ts). Keep it in sync with the controls. All English. */

export interface HelpRow {
  /** Keys / mouse actions shown as key caps; several entries mean alternatives ("W / ↑"). */
  keys?: string[];
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
        heading: 'What is BlockLab?',
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
          { text: 'Place blocks to make a body (blocks and plates stacked on each other\'s studs become one rigid piece; blocks side by side are not welded) and mount wheels on their sides. Four wheels and a body make a car.' },
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
          { keys: ['I'], text: 'Inspect mode: click a part to select it and see its details in a panel centred on the right edge. Clicking empty ground deselects. Drag with the left button to draw a box and select every part it touches (hold Shift to add to the selection, or Shift-click parts to toggle them): the panel then lists them, can remove them all at once and has arrow buttons (up and down against a bar, then forward, back, left and right) that move them half a cell (a plate up or down) as seen from the camera, and a To the ground button that moves them down until the lowest part rests on the ground; the same Move section is also at the top of the panel of a single selected part. You can also press on a selected part and drag to move the whole selection along the ground (hold Shift to move it up and down); a move whose parts do not fit does nothing. Press F to fly the camera to the selected part (or to all of them): it ends close to it, looking from the same direction. Rotate the camera with the middle button. The panel also shows the part\'s colour, a block\'s Weight slider (1-16: heavier blocks make the body slower to accelerate and steer), and a wheel\'s Tire slider (speed to traction) and Suspension slider (soft to firm), both applied in Play.' },
          { keys: ['B'], text: 'Build mode (default): the left button places the part of the selected hotbar slot.' },
          { keys: ['E'], text: 'Paint mode: pick a colour in the palette under the top bar (the first swatch restores the default colour), then click a block to paint it; drag to paint several (one undo step). Wheels cannot be painted.' },
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
            text: 'Paint blocks: keep the button down and move to keep placing blocks on the face where you started (a row, a layer or a wall).',
          },
          { keys: ['W', 'S'], text: 'Tilt the part to place a quarter turn up or down (W / S, also the ↑ ↓ arrow keys) (around the screen\'s left-right axis): a plate stands as a wall, a block lies with its studs to the side, a bracket lies on its back, a wheel\'s axle points up or down, an engine faces up or down. Every part turns the same way, in all directions. Also the ↑ ↓ buttons in the top bar. Studs only connect to studs pointing the same way.' },
          { keys: ['A', 'D'], text: 'Rotate the part to place a quarter turn (A counter-clockwise, D clockwise). The preview follows, also for parts that look the same after the turn. Every part rotates freely this way (a wheel\'s axle, an engine\'s front and a large wheel\'s reach turn with it). Also available as the ↺ ↻ buttons in the top bar.' },
          { keys: ['Right click'], text: 'Remove the part under the cursor (Build and Remove modes). Removing a block also removes its wheels.' },
        ],
      },
      {
        heading: 'Camera',
        rows: [
          { keys: ['Middle drag'], text: 'Rotate the camera.' },
          { keys: ['Right drag'], text: 'Move (pan) the camera. While building you cannot pan farther than 10 cells from your creation (the whole grid when it is empty), so the zoom always works around what you are building.' },
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
          { keys: ['Catalog'], text: 'Parts are grouped in tabs by category, and the search field (press / to jump to it) filters them by name or description. Hover a part to spin its 3D preview, click it to inspect it on the right, and drag it onto a hotbar slot.' },
        ],
      },
      {
        heading: 'Parts',
        rows: [
          { keys: ['2x2 Block'], text: 'A cube with 4 studs on top. Place it on the ground, or on top of (or under) another block or plate with at least one stud engaged: the pointer position chooses whether it rests on 4, 2 or 1 stud (half-cell steps). Stacked parts are welded.' },
          { keys: ['1x1 Block', '1x2 Block', '1x4 Block', '2x4 Block', '4x4 Block', 'Low Blocks', 'Tall Blocks'], text: 'Low blocks (1x1, 2x2, 2x4) are three plates tall (0.6) and tall blocks (1x1, 2x2) two cells tall (2). A block cut down to a single stud (0.5 × 1 × 0.5), cut in half (0.5 × 1, 2 studs), a beam (0.5 × 1 × 2, 4 studs), two blocks in one piece (1 × 1 × 2, 8 studs) and four blocks in one (2 × 1 × 2, 16 studs). Same placement and welding as a block; wheels, engines, turbos, thrusters, propellers, rotors and pistons can be mounted on any of them (on a face wider than a cell, the part follows the pointer in half-cell steps).' },
          { keys: ['2x2 Plate'], text: 'A thin square panel (a fifth of a block) with 4 studs, to tie blocks together (one plate on two side-by-side blocks welds them) and for floors and panels. Same placement as a block. Add it to the hotbar from the parts catalog (C).' },
          { keys: ['1x1 Plate', '1x2 Plate', '1x4 Plate', '2x4 Plate', '4x4 Plate', '4x8 Plate'], text: 'Plates of other sizes: a single stud (0.5 × 0.5), half as wide (0.5 × 1, 2 studs), a strip (0.5 × 2, 4 studs), 1 × 2 cells (8 studs), 2 × 2 cells (16 studs) and a big deck of 2 × 4 cells (32 studs). Turn them with A / D to choose which way they run.' },
          { keys: ['1x2 L bracket', '2x2 L bracket', '2x4 L bracket', '4x4 L bracket'], text: 'Two plates at a right angle: a flat plate with studs on top and a wall with studs on its outside (4, 8, 16 and 32 studs). A / D turn the wall to the side you need; a part engages the wall studs when its own studs point the same way (tilt it with W / S).' },
          { keys: ['2x2 Slope', '1x2 Slope', '2x4 Slope', '2x2 Slope Plate', '2x4 Slope Plate'], text: 'Wedges: a 45° ramp (a block tall), a narrow one, a gentle one (about 27°) and two thin tapering plates for spoilers and fairings. The thick edge is the back; turn and tilt them like any part (A / D, W / S). They have no studs on the slope, so nothing can be built on it, but they hold on the studs of the parts below them and collide with their real shape, so a car drives up them. A wedge is a body like any other: give a ramp weight (the inspector slider) so it stays put.' },
          { keys: ['2x2 Glass', '4x4 Glass', '2x2 Windscreen', '2x4 Windscreen'], text: 'Translucent glass: flat panes (1 × 1, 4 studs, and 2 × 2, 16 studs, a plate thick) that place and weld like plates, and windscreens, glass wedges (a 45° one and a raked 27° one) that behave like slopes: no studs on the slope, held by the parts below. The thick edge of a windscreen is the back; turn and tilt as usual (A / D, W / S). You see through them, but they are solid: they collide and weigh like their plain counterparts. Paint tints the glass; it stays translucent.' },
          { keys: ['Thruster'], text: 'A small jet that pushes its body, no wheels needed. A separate unit: click any face of a block to mount it there (it does not take the place of a block) and turn it (A / D, W / S) so its front points the way it should push (the bell and the flame are at the back). While you hold its key in Play it pushes the body it is mounted on towards its front, from where it sits (so one off the centre also turns the body), on the ground or in the air, with or without an engine. Give it a key in the inspector (no part comes with one). The thrusts of a body\'s thrusters add up; its strength is a slider in the inspector (1-10).' },
          { keys: ['Propeller'], text: 'A motor with spinning blades that pulls a plane through the air. A separate unit like the thruster: click any face of a block to mount it there (its front, the side with the blades, may not point into the block) and turn it (A / D, W / S) so the blades face the way it should pull. Give it a key in the inspector: each press switches it on or off; while it is on the blades spin up (about a second) and it pushes the body it is mounted on towards its front, from where it sits. It pushes hardest standing still and less the faster the air already moves along it, so a plane has a top speed. Its strength is a slider in the inspector (1-10); the pushes of a body\'s propellers add up.' },
          { keys: ['Ski'], text: 'A runner with almost no friction, for sleds. A separate unit: click a side face of a block (not the top or bottom) to mount it in the cell beside the block, like a wheel; an arm joins it to the block. It must lie flat with its length along the face (the preview is red otherwise): turn it with A / D so the curled tip points the way the body slides (W / S, which would tilt it, are not allowed). Its underside is level with a normal wheel, so the body rides a little above the ground, and where a wheel grips the ski glides and keeps its speed. It can steer: in the inspector give it Steer left / Steer right keys (the same ones on the skis you want to turn, usually the front pair): while a key is held its runner turns up to 20 degrees, less than a wheel, and its edge, which grips sideways, pulls the body round (skis without keys hold their line and a sled that is not steered runs straight); a hard turn at speed also bleeds speed. It has no other settings. A body on skis that is touching the ground and nearly upright does not pitch or roll (it stays level, and follows a ramp), so a thruster on top does not tip it over; it still turns about its vertical axis. Put two or four under a body and push it with a thruster or a propeller, or start it down a ramp; skis can share a car with wheels.' },
          { keys: ['Parachute'], text: 'A parachute and air brake. A separate unit like the propeller: click any face of a block to mount it there (its front, the side the canopy opens towards, may not point into the block) and turn it (A / D, W / S). Give it a key in the inspector: each press opens the canopy (in a fraction of a second) or folds it again. While it is open it drags the body it is mounted on against its velocity, harder the faster it goes: it slows a fall to a steady speed and stops a fast car or a landing plane. Its canopy size is a slider in the inspector (1-10); the drags of a body\'s parachutes add up, and one away from the centre also turns the body.' },
          { keys: ['4x3 Wing', '8x6 Wing'], text: 'Wings: thin swept-back wings like one wing of an airliner seen from above, in a small and a big size. A wing is flat and the same on both faces, so one part serves both sides of a plane: turned over (a half turn about its front) it is its own mirror image, so rotate it with A / D / W / S until it is the way you need. It has no studs, only sockets on both faces: it holds on the studs of the block below it (or above it, turned over), or you can place one against the side of a block (point at the face, at any height; its straight root edge must face the block, so turn it with A / D until the preview is not red), and either way they weld into the body. In Play they feel the air they move through: each lifts towards its top side in proportion to its area and the square of its speed, with a little drag, and lifts a little even when it flies level. The front (+z, the long straight root edge) must point the way the plane flies: turn it with A / D. Put a wing on each side of the body, around its centre, a little behind it, and a small pair on a tail further back; a wing far in front of the centre tips the nose up. A plane needs wheels (or a belly to slide on) to take off. Every wing has a control surface that you run with keys in the inspector (all optional, held): Pitch up / down, Roll left / right and Yaw left / right. Each wing moves its surface for the keys that turn the plane that way from where it sits, so give every wing the same keys (select them all, or use Copy these keys): the wings behind the centre do the pitching, wings on opposite sides the rolling (opposite ways), an upright one on the tail (stand it up with W / S) the yawing. A rotor turning wings is a helicopter; it spins its body the other way, so wheels or a second, counter-rotating rotor hold it.' },
          { keys: ['Hinge'], text: 'A servo hinge: the head swings open like a lid on a pin along one edge, to an angle, and stays there. A separate unit like the rotor and the piston: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does); A / D also move the pin to another edge. Build on the 4 studs of its flat head: what you put there is not welded to the rest of the creation and swings with the head. Give it a key in the inspector (Action Keys): each press in Play opens it to the angle, the next closes it. The inspector has an Angle slider (15° to 180°, default 90°) and a Strength slider (1-10, default 5): how stiffly the servo holds the angle, so raise it for a heavy lid. Keep what is on the head from touching the studs of the rest of the creation, or it is welded to it and cannot swing.' },
          { keys: ['Explosive bolt'], text: 'Drops a stage, for two-stage rockets. A separate unit like the hinge: click any face of a block to mount it there, turned (A / D, W / S) so that its head, the amber plate with studs, points away from the block. Everything built on the studs of the head is held to the block by the bolt as one rigid creation. Give it a key in the inspector: pressing it in Play fires the bolt, once: the joint is gone and a small push sends the two parts away from each other, each on its own from then on (R restarts with the bolt whole). Keep the upper stage from touching the lower one by studs anywhere else, or they stay welded. Give the upper stage its own thruster on another key.' },
          { keys: ['Spring'], text: 'A passive spring: no key. A separate unit like the piston: click any face of a block, plate or L bracket (the only parts besides blocks that take a mounted part; not slopes or wings) to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does). Build on the 4 studs of its green head: what you put there is not welded to the rest of the creation and rides on the spring. In Play it unfolds to its Length, and the load compresses it: the heavier, the more, and a bump makes it bounce. The inspector sets the Length (half a cell to 3 cells) and the Stiffness (1-10: a soft spring sinks and bounces, a stiff one barely moves). Keep what is on the head from touching the studs of the rest of the creation, or the spring stays rigid. The head can be painted.' },
          { keys: ['Piston'], text: 'Pushes up (or out) everything built on its head, and holds it there. A separate unit like the rotor: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does). Build on the 4 studs of its round head: what you put there is not welded to the rest of the creation and moves with the head. Give it a key in the inspector (no part comes with one); each press in Play slides the head out, where it stays, and the next slides it back. The inspector has a Stroke slider (half a cell to three cells). Keep what is on the head from touching the studs of the rest of the creation, or it is welded to it and cannot move.' },
          { keys: ['Rotor'], text: 'A spinning head for propellers, fans and cranes. A separate unit: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does). Its head is a round disc with 4 studs: whatever you build on those studs (blocks, plates, brackets, even wheels and engines on them) is not welded to the rest of the creation and turns with the head in Play. Give it a key in the inspector (no part comes with one); each press in Play switches it on or off. The inspector has a Speed slider (-10 to 10: the sign is the direction, clockwise seen from the head when positive; 0 holds it). Keep what is on the head from touching the studs of the rest of the creation, or it is welded to it and cannot turn; build it balanced so it does not shake the body.' },
          { keys: ['Turbo'], text: 'A nitrous bottle that boosts the wheels of its body. A separate unit: click any face of a block to mount it there (it does not take the place of a block) and turn it (A / D, W / S) so the nozzle, where the flame leaves, points backwards. While you hold its key in Play (give it one in the inspector), the wheels that an engine drives, on the same body, turn faster and push harder. Its boost (slider in the inspector, 1-10) adds up with the other turbos of the body; it does nothing without an engine.' },
          { keys: ['Engine'], text: 'Drives the wheels of its body. A separate unit: click any face of a block to mount it there (it does not take the place of a block), and turn it (A / D, W / S) so the fan on its front points where the vehicle should go; it cannot point into its block, nor be upside down. A body\'s engines add their power (slider in the inspector, 1-10); one engine of the default power drives 4 wheels at full torque, more wheels share it. It weighs two blocks. Where you mount it matters: while you accelerate on the ground its push acts on the body from where it sits, so a high engine tips the nose down and one off to a side pulls the vehicle that way; a low, central one barely does.' },
          {
            keys: ['Wheel'],
            text: 'Click the side of a block to mount a wheel (not the top or bottom). Its axle starts along X; turn it (A / D, W / S) in any direction before placing, e.g. a quarter turn to make it lie along the face like a caster. Every wheel has a brake: in the inspector (inspect mode, I) set its strength (1-10) and, if you want it to brake, give its Brake action a key; while you hold that key in Play every wheel with it is held back, driven or not. A wheel can also steer: give its Steer left / Steer right actions keys (the same ones on all the wheels you want to turn).',
          },
          {
            keys: ['Small wheel', 'Medium wheel'],
            text: 'Wheels of other sizes: the small wheel is half the size of the normal one (a toy-car wheel), the medium wheel one and a half times. Both take one cell and are placed like the wheel, on the side of a block; a small wheel hangs low in its cell so it still reaches the ground. They have the same Tire, Suspension, Brake and steering settings as every wheel. Use the same size on both sides of an axle, or the car leans. A wheel cannot be placed where its tire would overlap another wheel (the preview turns red): leave a gap between neighbouring wheels. They are added to the hotbar from the parts catalog (C).',
          },
          {
            keys: ['Large wheel'],
            text: 'A wheel twice the size. Click the side of a block, as with the wheel: it fills 2 x 2 cells starting at the cell you point at, so those must be free. Turn it (A / D, W / S) to choose its axle and which way it extends. It is added to the hotbar from the parts catalog (C).',
          },
        ],
      },
      {
        heading: 'Editing',
        rows: [
          { keys: ['Undo', 'Redo'], text: 'Buttons in the top bar. A whole paint stroke counts as one step.' },
          { keys: ['Clear'], text: 'In the top bar: removes every part after asking you to confirm (you can undo it).' },
          { keys: ['Menu'], text: 'Top-left home button: back to the main menu.' },
          { keys: ['Saved games'], text: 'Top-left folder button, between the home and help buttons: opens the saved-games panel over the game (load, delete or start a new game) without going back to the main menu. Back or Esc closes it. Your edits are saved automatically, so loading another game does not lose anything.' },
        ],
      },
      {
        heading: 'Driving (Play)',
        rows: [
          { text: 'Nothing moves until you give it a key: no part comes with one, and W, A, S, D and the arrows drive nothing by themselves. Select a part in inspect mode (I): the inspector has an Action Keys section with one block per action, an Add a key button (click it, then press the key; Esc cancels, Backspace clears the action) and, once there are keys, a trash that clears them; click a key chip to remove just that key. Actions: an engine Accelerates (required) and Reverses; a wheel Steers left, Steers right and Brakes (all optional: a wheel with no steering key just keeps going straight, a wheel with no brake key never brakes); a rotor switches on / off, a piston goes out / back, a hinge opens / closes, a stage bolt fires once, a propeller switches on / off, a parachute opens / closes, a thruster fires and a turbo boosts; a wing has Pitch up / down, Roll left / right and Yaw left / right, all optional. Thrusters, turbos, brakes, wing controls, accelerating and steering work while the key is held; rotors, pistons, hinges and propellers switch with each press. An action can have several keys (W and ↑, say), and parts with the same key work together, so give a group the same key and a single part its own. With several parts selected the inspector sets the keys of each kind of action at once, and Copy these keys gives one part\'s keys to all of its kind. Only R (restart), P (play / stop), H (help) and M (mute) are kept by the game; the editing keys (I, B, C...) can be used. The bell at the top right counts the parts with a required action that has no key, and lists them; the Controls panel shows each key with what it runs.' },
          { keys: ['R'], text: 'Restart the simulation from your build (also the Reset button next to Stop).' },
          { keys: ['P'], text: 'Play, and stop again (the same as the Play / Stop button); Esc stops too.' },
          { text: 'Wheels are driven only by the engines mounted on their body, and each engine has its own throttle (its Accelerate and Reverse keys), so engines on different keys work apart; a wheel takes the throttle of the engines of its body, weighted by their power. An engine pushes the vehicle towards its front, the side with the fan: turned around, its Accelerate key drives the other way, and sideways it does nothing. Steering is differential: a wheel with a steering key slows (or reverses) when its key says the vehicle should turn towards its side and speeds up for the other side. Wheels on a body with no engine roll freely. (Games saved before the engine existed still drive every wheel, with W / S and A / D.)' },
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
          { keys: ['Settings'], text: 'The gear button at the top right (beside the speaker) opens the settings: sound (mute and three volume sliders), the FPS counter, the controls panel while playing, shadows and the dust, smoke and flames. They are saved.' },
          { keys: ['M'], text: 'Mute / unmute all sounds (also the speaker button at the top right). The choice is saved.' },
          { keys: ['H'], text: 'Open or close this help.' },
          { keys: ['F3'], text: 'Show or hide the FPS counter.' },
          { keys: ['Esc'], text: 'Close this help or a confirmation dialog.' },
        ],
      },
    ],
  },
];

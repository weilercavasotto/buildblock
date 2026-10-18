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
          { keys: ['I'], text: 'Inspect mode: click a part to select it and see its details in a panel centred on the right edge. Clicking empty ground deselects. Drag with the left button to draw a box and select every part it touches (hold Shift to add to the selection, or Shift-click parts to toggle them): the panel then lists them, can remove them all at once and has arrow buttons (up and down against a bar, then forward, back, left and right) that move them half a cell (a plate up or down) as seen from the camera. You can also press on a selected part and drag to move the whole selection along the ground (hold Shift to move it up and down); a move whose parts do not fit does nothing. Rotate the camera with the middle button. The panel also shows the part\'s colour, a block\'s Weight slider (1-16: heavier blocks make the body slower to accelerate and steer), and a wheel\'s Tire slider (speed to traction) and Suspension slider (soft to firm), both applied in Play.' },
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
          { keys: ['1x1 Block', '1x2 Block', '1x4 Block', '2x4 Block', '4x4 Block'], text: 'A block cut down to a single stud (0.5 × 1 × 0.5), cut in half (0.5 × 1, 2 studs), a beam (0.5 × 1 × 2, 4 studs), two blocks in one piece (1 × 1 × 2, 8 studs) and four blocks in one (2 × 1 × 2, 16 studs). Same placement and welding as a block; wheels, engines, turbos, thrusters, rotors and pistons can be mounted on any of them (on a face wider than a cell, the part follows the pointer in half-cell steps).' },
          { keys: ['2x2 Plate'], text: 'A thin square panel (a fifth of a block) with 4 studs, to tie blocks together (one plate on two side-by-side blocks welds them) and for floors and panels. Same placement as a block. Add it to the hotbar from the parts catalog (C).' },
          { keys: ['1x1 Plate', '1x2 Plate', '1x4 Plate', '2x4 Plate', '4x4 Plate', '4x8 Plate'], text: 'Plates of other sizes: a single stud (0.5 × 0.5), half as wide (0.5 × 1, 2 studs), a strip (0.5 × 2, 4 studs), 1 × 2 cells (8 studs), 2 × 2 cells (16 studs) and a big deck of 2 × 4 cells (32 studs). Turn them with A / D to choose which way they run.' },
          { keys: ['1x2 L bracket', '2x2 L bracket', '2x4 L bracket', '4x4 L bracket'], text: 'Two plates at a right angle: a flat plate with studs on top and a wall with studs on its outside (4, 8, 16 and 32 studs). A / D turn the wall to the side you need; a part engages the wall studs when its own studs point the same way (tilt it with W / S).' },
          { keys: ['Thruster'], text: 'A small jet that pushes its body, no wheels needed. A separate unit: click any face of a block to mount it there (it does not take the place of a block) and turn it (A / D, W / S) so its front points the way it should push (the bell and the flame are at the back). While you hold Space in Play it pushes the body it is mounted on towards its front, from where it sits (so one off the centre also turns the body), on the ground or in the air, with or without an engine. The thrusts of a body\'s thrusters add up; its strength is a slider in the inspector (1-10).' },
          { keys: ['Piston'], text: 'Pushes up (or out) everything built on its head, and holds it there. A separate unit like the rotor: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does). Build on the 4 studs of its round head: what you put there is not welded to the rest of the creation and moves with the head. Press G in Play: the head slides out and stays out; press G again and it slides back. The inspector has a Stroke slider (half a cell to three cells). Keep what is on the head from touching the studs of the rest of the creation, or it is welded to it and cannot move.' },
          { keys: ['Rotor'], text: 'A spinning head for propellers, fans and cranes. A separate unit: click any face of a block to mount it there, turned (A / D, W / S) so that the head points away from the block (the preview is red until it does). Its head is a round disc with 4 studs: whatever you build on those studs (blocks, plates, brackets, even wheels and engines on them) is not welded to the rest of the creation and turns with the head in Play. Press F to switch the rotors on and off. The inspector has a Speed slider (-10 to 10: the sign is the direction, clockwise seen from the head when positive; 0 holds it). Keep what is on the head from touching the studs of the rest of the creation, or it is welded to it and cannot turn; build it balanced so it does not shake the body.' },
          { keys: ['Turbo'], text: 'A nitrous bottle that boosts the wheels of its body. A separate unit: click any face of a block to mount it there (it does not take the place of a block) and turn it (A / D, W / S) so the nozzle, where the flame leaves, points backwards. While you hold Shift in Play, the wheels that an engine drives, on the same body, turn faster and push harder. Its boost (slider in the inspector, 1-10) adds up with the other turbos of the body; it does nothing without an engine.' },
          { keys: ['Brake'], text: 'Fits to a wheel: pick the brake from the hotbar or the catalog and click a wheel, and a drilled disc with a caliper appears behind its rim (one brake per wheel). While you hold Space in Play, every wheel with a brake is held back, driven or not. Select the wheel in inspect mode (I) to set the strength of its brake (1-10) or take it off.' },
          { keys: ['Engine'], text: 'Drives the wheels of its body. A separate unit: click any face of a block to mount it there (it does not take the place of a block), and turn it (A / D, W / S) so the fan on its front points where the vehicle should go; it cannot point into its block, nor be upside down. A body\'s engines add their power (slider in the inspector, 1-10); one engine of the default power drives 4 wheels at full torque, more wheels share it. It weighs two blocks. Where you mount it matters: while you accelerate on the ground its push acts on the body from where it sits, so a high engine tips the nose down and one off to a side pulls the vehicle that way; a low, central one barely does.' },
          {
            keys: ['Wheel'],
            text: 'Click the side of a block to mount a wheel (not the top or bottom). Its axle starts along X; turn it (A / D, W / S) in any direction before placing, e.g. a quarter turn to make it lie along the face like a caster.',
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
          { keys: ['W', '↑'], text: 'Accelerate.' },
          { keys: ['S', '↓'], text: 'Reverse.' },
          { keys: ['A', '←'], text: 'Steer left.' },
          { keys: ['D', '→'], text: 'Steer right.' },
          { keys: ['Space'], text: 'Brake (the wheels that have a brake) and thrust (the thrusters): both at once if a vehicle has them.' },
          { keys: ['W', 'S', 'A', 'D', 'Q', 'E'], text: 'In the air (nothing of the vehicle touches the ground) they fly it: W / S pitch (W nose down, S nose up), A / D roll (bank left / right), Q / E yaw (turn left / right), around the axes of the vehicle. Its nose is where its thrusters push (the ones that push sideways), else where its engines push, else the way its wheels roll. At low speed the controls bite less.' },
          { keys: ['Shift'], text: 'Turbo: boosts the driven wheels of a body that has a turbo (hold it).' },
          { keys: ['F'], text: 'Switch the rotors on and off (press it).' },
          { keys: ['G'], text: 'Push the pistons out and, pressed again, back.' },
          { keys: ['R'], text: 'Restart the simulation from your build (also the Reset button next to Stop).' },
          { keys: ['P'], text: 'Play, and stop again (the same as the Play / Stop button); Esc stops too.' },
          { text: 'Wheels are driven only by the engines mounted on their body. An engine pushes the vehicle towards its front, the side with the fan: turned around it reverses W / S, and sideways it does nothing. Wheels on a body with no engine roll freely. (Games saved before the engine existed still drive every wheel.)' },
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
          { keys: ['W', 'A', 'S', 'D'], text: 'Drive (the arrow keys work too). I/B/E/R switch modes and W/A/S/D only rotate the part to place while building.' },
          { keys: ['Space'], text: 'Brake the wheels that have a brake and fire the thrusters.' },
          { keys: ['Q', 'E'], text: 'Yaw left / right while the vehicle is in the air (W / S pitch and A / D roll then too).' },
          { keys: ['Shift'], text: 'Turbo boost (a body with a turbo).' },
          { keys: ['F'], text: 'Switch the rotors on and off.' },
          { keys: ['G'], text: 'Pistons out / back.' },
          { keys: ['R'], text: 'Restart.' },
          { keys: ['P', 'Esc'], text: 'Stop and go back to building.' },
        ],
      },
      {
        heading: 'Anywhere in the game',
        rows: [
          { keys: ['H'], text: 'Open or close this help.' },
          { keys: ['F3'], text: 'Show or hide the FPS counter.' },
          { keys: ['Esc'], text: 'Close this help or a confirmation dialog.' },
        ],
      },
    ],
  },
];

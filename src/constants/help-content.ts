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
          { keys: ['I'], text: 'Inspect mode: click a part to select it and see its details in a panel centred on the right edge. Clicking empty ground deselects. The left button also rotates the camera here. The panel also shows the part\'s colour, a block\'s Weight slider (1-16: heavier blocks make the body slower to accelerate and steer), and a wheel\'s Tire slider (speed to traction) and Suspension slider (soft to firm), both applied in Play.' },
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
          { keys: ['W', 'S'], text: 'Tilt the part to place a quarter turn up or down (W / S, also the ↑ ↓ arrow keys) (around the screen\'s left-right axis): a plate stands as a wall, a block lies with its studs to the side, a bracket lies on its back, a wheel\'s axle points up or down. Also the ↑ ↓ buttons in the top bar. Studs only connect to studs pointing the same way.' },
          { keys: ['A', 'D'], text: 'Rotate the part to place a quarter turn (A counter-clockwise, D clockwise). The preview follows. Also available as the ↺ ↻ buttons in the top bar. A wheel is mounted on a side face and its axle is perpendicular to it; rotate it a quarter turn to make it lie along the face instead.' },
          { keys: ['Right click'], text: 'Remove the part under the cursor (Build and Remove modes). Removing a block also removes its wheels.' },
        ],
      },
      {
        heading: 'Camera',
        rows: [
          { keys: ['Middle drag'], text: 'Rotate the camera.' },
          { keys: ['Right drag'], text: 'Move (pan) the camera.' },
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
          { keys: ['Block'], text: 'A cube with 4 studs on top. Place it on the ground, or on top of (or under) another block or plate with at least one stud engaged: the pointer position chooses whether it rests on 4, 2 or 1 stud (half-cell steps). Stacked parts are welded.' },
          { keys: ['Half block', 'Large block'], text: 'A block cut in half (0.5 × 1, 2 studs) and four blocks in one (2 × 1 × 2, 16 studs). Same placement and welding as a block; wheels mount only on the normal block.' },
          { keys: ['Plate'], text: 'A thin square panel (a fifth of a block) with 4 studs, to tie blocks together (one plate on two side-by-side blocks welds them) and for floors and panels. Same placement as a block. Add it to the hotbar from the parts catalog (C).' },
          { keys: ['Half plate', 'Large plate', 'Large half plate'], text: 'Plates of other sizes: half as wide (0.5 × 1, 2 studs), 2 × 2 (16 studs) and 1 × 2 (8 studs). Turn them with A / D to choose which way they run.' },
          { keys: ['L bracket', 'Small L bracket'], text: 'Two plates at a right angle: a flat plate with studs on top and a wall with studs on its outside (8 studs, or 4 for the small one). A / D turn the wall to the side you need; a part engages the wall studs when its own studs point the same way (tilt it with W / S).' },
          {
            keys: ['Wheel'],
            text: 'Click the side of a block to mount a wheel (not the top or bottom). By default its axle is perpendicular to that face; A / D turn it a quarter turn before placing.',
          },
          {
            keys: ['Large wheel'],
            text: 'A wheel twice the size. Click the side of a block, as with the wheel: it fills 2 x 2 cells beside the block (the cell you point at, the one above it and the two beside them), so those must be free. A / D choose which side it extends toward. It is added to the hotbar from the parts catalog (C).',
          },
        ],
      },
      {
        heading: 'Editing',
        rows: [
          { keys: ['Undo', 'Redo'], text: 'Buttons in the top bar. A whole paint stroke counts as one step.' },
          { keys: ['Clear'], text: 'In the top bar: removes every part after asking you to confirm (you can undo it).' },
          { keys: ['Menu'], text: 'Top-left button, just left of the help button: back to the main menu to open another game.' },
        ],
      },
      {
        heading: 'Driving (Play)',
        rows: [
          { keys: ['W', '↑'], text: 'Accelerate.' },
          { keys: ['S', '↓'], text: 'Reverse.' },
          { keys: ['A', '←'], text: 'Steer left.' },
          { keys: ['D', '→'], text: 'Steer right.' },
          { keys: ['R'], text: 'Restart the simulation from your build (also the Reset button next to Stop).' },
          { text: 'Every wheel is driven. The front of the car is the direction the wheels roll, perpendicular to their axle.' },
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
          { keys: ['Ctrl / Cmd + Z'], text: 'Undo.' },
          { keys: ['Ctrl / Cmd + Y', 'Ctrl / Cmd + Shift + Z'], text: 'Redo.' },
        ],
      },
      {
        heading: 'Play mode',
        rows: [
          { keys: ['W', 'A', 'S', 'D'], text: 'Drive (the arrow keys work too). I/B/E/R switch modes and W/A/S/D only rotate the part to place while building.' },
          { keys: ['R'], text: 'Restart.' },
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

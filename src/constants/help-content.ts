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
          { keys: ['Catalog'], text: 'The button at the right of the hotbar (or B / C) opens the parts catalog, where you can inspect every part and drag it onto a slot.' },
          { text: 'Place blocks to make a body (touching blocks become one rigid piece) and mount wheels on their sides. Four wheels and a body make a car.' },
          { keys: ['Play'], text: 'In the top bar: drive your creation. Stop brings you back to building, with your build untouched.' },
        ],
      },
      {
        heading: 'Good to know',
        rows: [
          { text: 'The ghost preview is green when a part can be placed there and red when it cannot.' },
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
          { keys: ['Q'], text: 'Inspect mode: click a part to select it and see its details in a panel centred on the right edge. Clicking empty ground deselects. The left button also rotates the camera here. The panel also shows the part\'s colour, and a wheel\'s Tire type (Standard, Speed or Traction) and Suspension slider (soft to firm), both applied in Play.' },
          { keys: ['W'], text: 'Build mode (default): the left button places the part of the selected hotbar slot.' },
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
          { keys: ['A', 'D'], text: 'Rotate the part to place a quarter turn (A counter-clockwise, D clockwise). The preview turns smoothly. Also available as the ↺ ↻ buttons in the top bar. A wheel is mounted on a side face and its axle is perpendicular to it; rotate it a quarter turn to make it lie along the face instead.' },
          { keys: ['Right click'], text: 'Remove the part under the cursor (Build and Remove modes). Removing a block also removes its wheels.' },
        ],
      },
      {
        heading: 'Camera',
        rows: [
          { keys: ['Middle drag'], text: 'Rotate the camera.' },
          { keys: ['Right drag'], text: 'Move (pan) the camera.' },
          { keys: ['Scroll'], text: 'Zoom in and out.' },
          { text: 'The zoom panel (top left, under the Menu button) shows the zoom level and has + / − buttons and a slider. Zoom is limited so you cannot go too close or too far.' },
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
          { keys: ['Catalog'], text: 'Parts are grouped in tabs by category. Hover a part to spin its 3D preview, click it to inspect it on the right, and drag it onto a hotbar slot.' },
        ],
      },
      {
        heading: 'Parts',
        rows: [
          { keys: ['Block'], text: 'A cube. Place it on the ground or against any face of another block.' },
          {
            keys: ['Wheel'],
            text: 'Click the side of a block to mount a wheel (not the top or bottom). By default its axle is perpendicular to that face; A / D turn it a quarter turn before placing.',
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
          { keys: ['Q', 'W', 'E', 'R'], text: 'Cursor mode: Inspect, Build, Paint, Remove.' },
          { keys: ['A', 'D'], text: 'Rotate the part to place (counter-clockwise / clockwise).' },
          { keys: ['1 – 9'], text: 'Select the part in that hotbar slot (and switch to Build).' },
          { keys: ['B', 'C'], text: 'Open or close the parts catalog.' },
          { keys: ['Ctrl / Cmd + Z'], text: 'Undo.' },
          { keys: ['Ctrl / Cmd + Y', 'Ctrl / Cmd + Shift + Z'], text: 'Redo.' },
        ],
      },
      {
        heading: 'Play mode',
        rows: [
          { keys: ['W', 'A', 'S', 'D'], text: 'Drive (the arrow keys work too). Q/W/E/R and A/D only switch modes / rotate while building.' },
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

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
          { keys: ['1'], text: 'Place blocks to make a body. Blocks that touch become one rigid piece.' },
          { keys: ['2'], text: 'Mount wheels on the side of a block. Four wheels and a body make a car.' },
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
        heading: 'Building',
        rows: [
          { keys: ['Left click'], text: 'Place the selected part.' },
          {
            keys: ['Left drag'],
            text: 'Paint blocks: keep the button down and move to keep placing blocks on the face where you started (a row, a layer or a wall).',
          },
          { keys: ['Right click'], text: 'Remove the part under the cursor. Removing a block also removes its wheels.' },
        ],
      },
      {
        heading: 'Camera',
        rows: [
          { keys: ['Middle drag'], text: 'Rotate the camera.' },
          { keys: ['Right drag'], text: 'Move (pan) the camera.' },
          { keys: ['Scroll'], text: 'Zoom in and out.' },
          { text: 'The zoom panel (top right) shows the zoom level and has + / − buttons and a slider. Zoom is limited so you cannot go too close or too far.' },
        ],
      },
    ],
  },
  {
    id: 'build-drive',
    title: 'Build & drive',
    sections: [
      {
        heading: 'Parts',
        rows: [
          { keys: ['Block'], text: 'A cube. Place it on the ground or against any face of another block.' },
          {
            keys: ['Wheel'],
            text: 'Click the side of a block to mount a wheel. It spins on the axle of that face, so it cannot go on the top or bottom of a block.',
          },
        ],
      },
      {
        heading: 'Editing',
        rows: [
          { keys: ['Undo', 'Redo'], text: 'Buttons in the top bar. A whole paint stroke counts as one step.' },
          { keys: ['Clear'], text: 'In the top bar: removes every part (you can undo it).' },
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
          { keys: ['R'], text: 'Restart the simulation from your build.' },
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
          { keys: ['1'], text: 'Select the Block tool.' },
          { keys: ['2'], text: 'Select the Wheel tool.' },
          { keys: ['Ctrl / Cmd + Z'], text: 'Undo.' },
          { keys: ['Ctrl / Cmd + Y', 'Ctrl / Cmd + Shift + Z'], text: 'Redo.' },
        ],
      },
      {
        heading: 'Play mode',
        rows: [
          { keys: ['W', 'A', 'S', 'D'], text: 'Drive (the arrow keys work too).' },
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

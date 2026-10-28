/**
 * The steps of the tutorial (src/ui/tutorial.ts), shown in order after the welcome dialog: each one highlights the part of the screen that
 * `target` (a CSS selector) picks, with a blinking arrow, and says what it is for. A step without a target is a note in the middle of the
 * screen; a step whose target is not on screen is skipped. All English; keep it in sync with the controls (see `help-content.ts`).
 */
export interface TutorialStep {
  target?: string;
  title: string;
  text: string;
}

export const TUTORIAL_STEPS: ReadonlyArray<TutorialStep> = [
  {
    title: 'Place parts',
    text: 'Pick a part, then click the ground or another part to place it. Hold the button and drag to place several in a row. A right click removes a part.',
  },
  {
    target: '#hotbar-slots',
    title: 'The hotbar',
    text: 'Nine slots hold the parts you use most. Press 1 to 9, or click a slot, to choose what you place. The ghost under the pointer turns red when a part does not fit.',
  },
  {
    target: '#catalog-button',
    title: 'The parts catalog',
    text: 'Press C, or this button, to browse every part: spin its 3D preview, read what it does and drag it onto a hotbar slot.',
  },
  {
    target: '#mode-switch',
    title: 'Cursor modes',
    text: 'Inspect (I) selects parts and shows their settings, Build (B) places, Paint (E) colours and Remove (R) erases. Dragging works in every mode.',
  },
  {
    target: '#rotate-group',
    title: 'Turn the part',
    text: 'Rotate the part before you place it with A and D, and tilt it with W and S. The preview follows, so you see how it will sit.',
  },
  {
    target: '#history-group',
    title: 'Undo and redo',
    text: 'Made a mistake? Undo with Ctrl or Cmd + Z, redo with Ctrl or Cmd + Y. A whole drag counts as one step.',
  },
  {
    target: '#zoom',
    title: 'Look around',
    text: 'Scroll to zoom, or use these controls. Drag with the middle button to rotate the camera and with the right button to pan.',
  },
  {
    target: '#btn-play',
    title: 'Play',
    text: 'Press Play (P) to drive your creation with real physics, and Stop to go back to building. Nothing moves until you give a part a key: select it in Inspect mode and add one in the inspector.',
  },
  {
    target: '#top-left',
    title: 'Menu, saves and help',
    text: 'The home button goes back to the main menu, the folder opens your saved games and the i button opens the help (H). Everything is saved automatically.',
  },
  {
    target: '#btn-settings',
    title: 'Settings',
    text: 'Sound and volume (M mutes), shadows, the FPS counter and the dust, smoke and flame effects.',
  },
  {
    title: 'You are ready',
    text: 'Start with a few blocks and four wheels, an engine on the side of a block, and press Play. The help (H) has the full list of parts and controls.',
  },
];

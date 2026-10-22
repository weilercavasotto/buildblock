import { CursorMode } from '../types';

/** The cursor modes, in toolbar order. `code` is the `KeyboardEvent.code` of their shortcut. */
export const CURSOR_MODES: ReadonlyArray<{
  id: CursorMode;
  label: string;
  /** Shortcut as shown to the user. */
  key: string;
  code: string;
  /** Tooltip / help text. */
  description: string;
  /** Inner markup of a 24×24 stroked SVG icon (trusted constant, drawn with `currentColor`). */
  icon: string;
}> = [
  {
    id: 'inspect',
    label: 'Inspect',
    key: 'I',
    code: 'KeyI',
    description: 'Click a part to inspect it, or drag a box to select several (they can then be moved).',
    // Mouse cursor (pointer arrow)
    icon: '<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.12 1.58a2 2 0 0 0-1.44 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
  },
  {
    id: 'build',
    label: 'Build',
    key: 'B',
    code: 'KeyB',
    description: 'Place parts with the left button (drag to paint blocks).',
    // Hammer
    icon: '<path d="m15 12-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9"/><path d="m17.6 15 3.9-3.9"/><path d="m21.5 11.1-1.9-1.9a2 2 0 0 1-.6-1.4V7l-2.3-2.3a6 6 0 0 0-4.2-1.8L9 3l.9.8A6.2 6.2 0 0 1 12 8.2V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9"/>',
  },
  {
    id: 'paint',
    label: 'Paint',
    key: 'E',
    code: 'KeyE',
    description: 'Paint parts with the chosen colour (drag to paint several). Wheels cannot be painted.',
    // Brush
    icon: '<path d="m11 10 3 3"/><path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"/><path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"/>',
  },
  {
    id: 'remove',
    label: 'Remove',
    key: 'R',
    code: 'KeyR',
    description: 'Remove parts with the left button (drag to erase several).',
    // Trash can
    icon: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  },
];

/**
 * Icons of the buttons that move a selection (inner markup of a 24×24 stroked SVG, trusted constants): arrows on the ground
 * for left / right / forward / back, and an arrow against a bar (the floor / ceiling) for up / down.
 */
export const MOVE_ICONS = {
  left: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  forward: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  back: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  up: '<path d="M5 3h14"/><path d="m18 13-6-6-6 6"/><path d="M12 7v14"/>',
  /** The selection to the floor: an arrow into two ground lines. */
  ground: '<path d="M4 20h16"/><path d="M4 16h16"/><path d="M12 3v9"/><path d="m8 9 4 4 4-4"/>',
  down: '<path d="M5 21h14"/><path d="m6 11 6 6 6-6"/><path d="M12 17V3"/>',
} as const;

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
}> = [
  {
    id: 'build',
    label: 'Build',
    key: 'Q',
    code: 'KeyQ',
    description: 'Place parts with the left button (drag to paint blocks).',
  },
  {
    id: 'inspect',
    label: 'Inspect',
    key: 'W',
    code: 'KeyW',
    description: 'Click a part to inspect it. The left button also rotates the camera.',
  },
  {
    id: 'remove',
    label: 'Remove',
    key: 'E',
    code: 'KeyE',
    description: 'Remove parts with the left button (drag to erase several).',
  },
];

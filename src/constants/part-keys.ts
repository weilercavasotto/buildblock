import { Part, PartType } from '../types';

/**
 * Keys of the parts. No part comes with a key: the player gives each mobility part its own (`Part.key`, a `KeyboardEvent.code`,
 * set in the part inspector), so one key can run a whole group of parts or a single one. A part that needs a key and has none is
 * listed by the alerts panel (the bell at the top right). Parts with the same key move together.
 */

/** How a key runs a part: `hold` = active while the key is held, `toggle` = each press switches it on or off. Decided per type of part. */
export type KeyMode = 'hold' | 'toggle';

/**
 * The types of part that are run by a key, how (`mode`) and whether a missing key is an alert (`required`). A wheel's key is its
 * brake's: every wheel has a brake, but a wheel with no key is fine (it just does not brake), so the bell does not count it. The
 * engine needs no key (W / S / A / D drive it).
 */
export const PART_KEYS: Partial<Record<PartType, { mode: KeyMode; required: boolean }>> = {
  wheel: { mode: 'hold', required: false },
  bigWheel: { mode: 'hold', required: false },
  thruster: { mode: 'hold', required: true },
  turbo: { mode: 'hold', required: true },
  rotor: { mode: 'toggle', required: true },
  piston: { mode: 'toggle', required: true },
};

/** Does this part take a key (a rotor, piston, thruster, turbo or a wheel's brake)? */
export const isKeyed = (part: Pick<Part, 'type'>): boolean => PART_KEYS[part.type] !== undefined;

/** Does this part need a key it does not have yet (what the alerts count)? */
export const lacksKey = (part: Pick<Part, 'type' | 'key'>): boolean => PART_KEYS[part.type]?.required === true && !part.key;

/** The mode of a keyed part's key. */
export const keyModeOf = (part: Pick<Part, 'type'>): KeyMode => PART_KEYS[part.type]?.mode ?? 'hold';

/** The keys that cannot be given to a part, because the game uses them while playing (driving, flying, restarting, stopping...). */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', // drive and steer
  'KeyQ', 'KeyE', // yaw in the air
  'KeyR', // restart
  'KeyP', // play / stop
  'KeyH', // help
  'KeyM', // mute
]);

/** The keys that can be a part's key if they are not reserved: letters, digits, the numeric pad, Space, Shift and the punctuation keys. */
const ASSIGNABLE = /^(Key[A-Z]|Digit\d|Numpad\w+|Space|ShiftLeft|ShiftRight|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Backquote|IntlBackslash|Insert|Home|End|PageUp|PageDown)$/;

/** Why a key cannot be given to a part: `reserved` (the game uses it) or `unsupported` (not a key that works for this), else null. */
export const keyProblem = (code: string): 'reserved' | 'unsupported' | null => {
  if (RESERVED_KEYS.has(code)) return 'reserved';
  return ASSIGNABLE.test(code) ? null : 'unsupported';
};

/** Is `value` a saved key that is still valid? */
export const isValidKey = (value: unknown): value is string => typeof value === 'string' && keyProblem(value) === null;

/** What the user's keyboard calls each code (filled in by `loadKeyLabels` where the browser can tell: a French keyboard has A where a US one has Q). */
let layout: ReadonlyMap<string, string> | null = null;

/** Asks the browser for the real layout of the keyboard, so key names are the ones printed on the user's keys. Safe to ignore if it fails. */
export async function loadKeyLabels(): Promise<void> {
  try {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<ReadonlyMap<string, string>> } }).keyboard;
    if (keyboard) layout = await keyboard.getLayoutMap();
  } catch {
    // unsupported or blocked: the names below are used
  }
}

/** The name of a key as shown on its key cap: `KeyG` is `G`, `Digit1` is `1`, `ShiftLeft` is `Shift`... */
export function keyLabel(code: string): string {
  const printed = layout?.get(code);
  if (printed && printed.length === 1) return printed.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Shift')) return 'Shift';
  const names: Record<string, string> = {
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backslash: '\\', Backquote: '`', IntlBackslash: '\\', PageUp: 'Page Up', PageDown: 'Page Down',
  };
  return names[code] ?? code;
}

import { Part, PartType } from '../types';

/**
 * Keys of the parts. No part comes with a key, and nothing that moves works until the player gives it one (a rule of the game, not just
 * of the parts that exist today): every mobility part has one or more **actions** (`PART_ACTIONS`), and the player assigns each action
 * one or more keys (`Part.keys`, `KeyboardEvent.code`s, in the part inspector). Parts with the same key work together, so one key can
 * run a whole group or a single part. A part with a required action that has no key is listed by the alerts panel (the bell).
 */

/** How a key runs an action: `hold` = active while a key is held, `toggle` = each press switches it on or off. Decided per action. */
export type KeyMode = 'hold' | 'toggle';

/** One thing a part can be told to do: what the key does, how, and whether leaving it without a key is an alert (`required`). */
export interface KeyAction {
  id: string;
  /** What it does, as the inspector and the Controls panel name it. */
  label: string;
  mode: KeyMode;
  required: boolean;
}

const run = (label: string): KeyAction[] => [{ id: 'run', label, mode: 'hold', required: true }];
/** The flight controls of a wing: its control surface moves for whichever of these turns the plane the way it is asked, wherever the wing is (see `PhysicsWorld.applyWings`). */
const surfaces = (): KeyAction[] => [
  { id: 'pitchUp', label: 'Pitch up (nose up)', mode: 'hold', required: false },
  { id: 'pitchDown', label: 'Pitch down (nose down)', mode: 'hold', required: false },
  { id: 'rollLeft', label: 'Roll left', mode: 'hold', required: false },
  { id: 'rollRight', label: 'Roll right', mode: 'hold', required: false },
  { id: 'yawLeft', label: 'Yaw left', mode: 'hold', required: false },
  { id: 'yawRight', label: 'Yaw right', mode: 'hold', required: false },
];
/** Every wheel, whatever its size, steers and brakes. */
const WHEEL_ACTIONS: KeyAction[] = [
  { id: 'steerLeft', label: 'Steer left', mode: 'hold', required: false },
  { id: 'steerRight', label: 'Steer right', mode: 'hold', required: false },
  { id: 'brake', label: 'Brake', mode: 'hold', required: false },
];
/** A ski steers (its runner turns about the vertical axis; optional, held). */
const SKI_ACTIONS: KeyAction[] = [
  { id: 'steerLeft', label: 'Steer left', mode: 'hold', required: false },
  { id: 'steerRight', label: 'Steer right', mode: 'hold', required: false },
];
const toggle = (label: string): KeyAction[] => [{ id: 'run', label, mode: 'toggle', required: true }];

/**
 * The actions of each kind of part that takes keys. An engine accelerates / reverses the wheels of its body (its own throttle, so
 * engines on different keys work apart); a wheel steers (differential drive: a wheel with no steering key keeps going straight) and
 * brakes, both optional; a rotor and a piston switch on and off with each press; a thruster fires and a turbo boosts while held; a propeller switches on and off; a parachute opens and closes; a lamp switches on and off; a stage bolt fires once; a wing moves its control surface while one of its pitch / roll / yaw keys is held, all optional.
 */
export const PART_ACTIONS: Partial<Record<PartType, KeyAction[]>> = {
  engine: [
    { id: 'forward', label: 'Accelerate', mode: 'hold', required: true },
    { id: 'reverse', label: 'Reverse', mode: 'hold', required: false },
  ],
  wheel: WHEEL_ACTIONS,
  smallWheel: WHEEL_ACTIONS,
  mediumWheel: WHEEL_ACTIONS,
  bigWheel: WHEEL_ACTIONS,
  ski: SKI_ACTIONS,
  thruster: run('Thrust'),
  turbo: run('Turbo boost'),
  propeller: toggle('Propellers on / off'),
  parachute: toggle('Parachutes open / closed'),
  lamp: toggle('Lamps on / off'),
  wing: surfaces(),
  wingLarge: surfaces(),
  rotor: toggle('Rotors on / off'),
  piston: toggle('Pistons out / back'),
  hinge: toggle('Hinges open / close'),
  bolt: toggle('Fire stage bolts'),
};

/** The most keys one action can have. */
export const MAX_KEYS_PER_ACTION = 4;

/** The actions of a part (none for a block). */
export const actionsOf = (part: Pick<Part, 'type'>): KeyAction[] => PART_ACTIONS[part.type] ?? [];

/** Does this part take keys? */
export const isKeyed = (part: Pick<Part, 'type'>): boolean => PART_ACTIONS[part.type] !== undefined;

/** The keys the player gave to an action of a part (empty when none). */
export const keysOf = (part: Pick<Part, 'keys'>, action: string): readonly string[] => part.keys?.[action] ?? [];

/** The required actions of a part that have no key yet. */
export const missingActions = (part: Pick<Part, 'type' | 'keys'>): KeyAction[] => actionsOf(part).filter((a) => a.required && keysOf(part, a.id).length === 0);

/** The optional actions of a part that have no key yet (the alerts panel lists them, the bell does not count them). */
export const unassignedOptional = (part: Pick<Part, 'type' | 'keys'>): KeyAction[] => actionsOf(part).filter((a) => !a.required && keysOf(part, a.id).length === 0);

/** Does this part need a key it does not have yet (what the alerts count)? */
export const lacksKey = (part: Pick<Part, 'type' | 'keys'>): boolean => missingActions(part).length > 0;

/** The keys that cannot be given to a part, because the game uses them while playing (restart, play / stop, help, mute). */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'KeyR', // restart
  'KeyP', // play / stop
  'KeyH', // help
  'KeyM', // mute
]);

/** The keys that can be an action's key if they are not reserved: letters, digits, the arrows, the numeric pad, Space, Shift and the punctuation keys. */
const ASSIGNABLE = /^(Key[A-Z]|Digit\d|Arrow(Up|Down|Left|Right)|Numpad\w+|Space|ShiftLeft|ShiftRight|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Backquote|IntlBackslash|Insert|Home|End|PageUp|PageDown)$/;

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
  if (code.startsWith('Arrow')) return { Up: '↑', Down: '↓', Left: '←', Right: '→' }[code.slice(5)] ?? code;
  const names: Record<string, string> = {
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backslash: '\\', Backquote: '`', IntlBackslash: '\\', PageUp: 'Page Up', PageDown: 'Page Down',
  };
  return names[code] ?? code;
}

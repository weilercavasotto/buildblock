import { Part, PartType } from '../types';

/**
 * The keys of Play mode that depend on the parts of the creation. The panel at the bottom left (`ui/controls-panel.ts`) lists the
 * rows whose `when` is true for the creation being played, so a player only sees the commands of the parts they placed.
 * These are the fixed keys (driving and flying). The keys of the rotors, pistons, thrusters, turbos and brakes are the parts' own
 * (`Part.key`, chosen by the player): `ControlsPanel` lists them by key, with `PART_KEY_LABELS`.
 * **Keep it in sync with `VehicleController` (`KEY_MAP`) and `help-content.ts` when a control changes.**
 */
export interface PlayControl {
  /** The key caps, as shown. */
  keys: ReadonlyArray<string>;
  /** What they do. */
  label: string;
  /** Is it useful for this creation? */
  when(parts: ReadonlyArray<Part>): boolean;
}

const has = (parts: ReadonlyArray<Part>, ...types: Part['type'][]): boolean => parts.some((p) => types.includes(p.type));

export const PLAY_CONTROLS: ReadonlyArray<PlayControl> = [
  { keys: ['W', 'S'], label: 'Drive forward / back', when: (parts) => has(parts, 'wheel', 'bigWheel') },
  { keys: ['A', 'D'], label: 'Steer left / right', when: (parts) => has(parts, 'wheel', 'bigWheel') },
  // A vehicle with thrusters flies: the keys that steer it in the air.
  { keys: ['W', 'S'], label: 'Pitch in the air', when: (parts) => has(parts, 'thruster') },
  { keys: ['A', 'D'], label: 'Roll in the air', when: (parts) => has(parts, 'thruster') },
  { keys: ['Q', 'E'], label: 'Yaw in the air', when: (parts) => has(parts, 'thruster') },
];

/** What the key of each kind of keyed part does, as the Controls panel names it (a wheel's key is its brake's). */
export const PART_KEY_LABELS: Partial<Record<PartType, string>> = {
  wheel: 'Brake',
  bigWheel: 'Brake',
  thruster: 'Thrust',
  turbo: 'Turbo boost',
  rotor: 'Rotors on / off',
  piston: 'Pistons out / back',
};

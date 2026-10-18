import { Part } from '../types';

/**
 * The keys of Play mode that depend on the parts of the creation. The panel at the bottom left (`ui/controls-panel.ts`) lists the
 * rows whose `when` is true for the creation being played, so a player only sees the commands of the parts they placed.
 * **Keep it in sync with `VehicleController` (`KEY_MAP`, `F`) and `help-content.ts` when a control changes.**
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
  { keys: ['Space'], label: 'Brake', when: (parts) => parts.some((p) => (p.brake ?? 0) > 0) },
  { keys: ['Space'], label: 'Thrust', when: (parts) => has(parts, 'thruster') },
  { keys: ['Shift'], label: 'Turbo boost', when: (parts) => has(parts, 'turbo') },
  { keys: ['F'], label: 'Rotors on / off', when: (parts) => has(parts, 'rotor') },
  // A vehicle with thrusters flies: the keys that steer it in the air.
  { keys: ['W', 'S'], label: 'Pitch in the air', when: (parts) => has(parts, 'thruster') },
  { keys: ['A', 'D'], label: 'Roll in the air', when: (parts) => has(parts, 'thruster') },
  { keys: ['Q', 'E'], label: 'Yaw in the air', when: (parts) => has(parts, 'thruster') },
];

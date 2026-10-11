export type Vec3 = [number, number, number];
export type PartType = 'block' | 'wheel';

/** What the left button does: place parts, inspect a part, or remove parts. */
export type CursorMode = 'build' | 'inspect' | 'remove';

export interface Part {
  type: PartType;
  cell: Vec3;
  /** Outward normal of the block face a wheel is mounted on (wheel axle direction). */
  face?: Vec3;
}

export const cellKey = (c: Vec3): string => `${c[0]},${c[1]},${c[2]}`;
export const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subVec = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

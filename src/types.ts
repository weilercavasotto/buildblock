export type Vec3 = [number, number, number];
export type PartType = 'block' | 'wheel' | 'bigWheel';

/** Wheels (small and large): mounted on a block face, with a tire and a suspension. */
export const isWheelType = (type: PartType): boolean => type === 'wheel' || type === 'bigWheel';

/** What the left button does: place parts, inspect a part, or remove parts. */
export type CursorMode = 'build' | 'inspect' | 'paint' | 'remove';

export interface Part {
  type: PartType;
  cell: Vec3;
  /** Outward normal of the block face a wheel is mounted on: the host block is at `cell - face`. (The axle is chosen by `rotation`.) */
  face?: Vec3;
  /**
   * Orientation around the vertical axis in clockwise quarter turns seen from above (0-3, i.e. 0°/90°/180°/270°). For a
   * wheel it chooses the axle (`wheelAxle`); for a large wheel (axle always along `face`) only its parity matters: it
   * chooses the side the wheel extends toward (`partCells`). Missing in saves made before rotation existed. Use `partRotation()` to read it.
   */
  rotation?: number;
  /**
   * Paint: a `#rrggbb` colour overriding the part's default one. Only parts whose `PART_INFO[type].paintable` is true can
   * be painted (the wheel cannot). Missing = the default colour. Read it through `partColor()`.
   */
  color?: string;
  /**
   * Wheels only (`PART_INFO[type].hasSuspension`): strength of the wheel's suspension, 0-100. Missing = the default
   * (`SUSPENSION.defaultStrength`). Read it through `suspensionOf()`.
   */
  suspension?: number;
  /** Wheels only (`PART_INFO[type].hasTire`): id of the tire type (see `TIRES`). Missing = `DEFAULT_TIRE`. Read it through `tireOf()`. */
  tire?: string;
}

export const cellKey = (c: Vec3): string => `${c[0]},${c[1]},${c[2]}`;
export const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subVec = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Wraps any integer number of quarter turns into 0-3. */
export const normalizeRotation = (turns: number): number => ((Math.round(turns) % 4) + 4) % 4;

/**
 * Rotation that matches a wheel axle pointing along `face`: +X 0, +Z 1, -X 2, -Z 3 (clockwise seen from above). Only used
 * for saves made when a wheel's axle was always its mounting face (they have no `rotation`).
 */
export function rotationOfFace(face: Vec3): number {
  if (face[0] !== 0) return face[0] > 0 ? 0 : 2;
  return face[2] > 0 ? 1 : 3;
}

/**
 * The rotation of a part in quarter turns (0-3). Stored in `part.rotation`; saves from before rotation existed have none:
 * blocks then count as 0 and wheels as the rotation that points the axle along their mounting face.
 */
export const partRotation = (part: Pick<Part, 'face' | 'rotation'>): number =>
  part.rotation !== undefined ? normalizeRotation(part.rotation) : part.face ? rotationOfFace(part.face) : 0;

/**
 * The direction of a wheel's axle. A small wheel's rotation chooses it: 0 = +X, 1 = +Z, 2 = -X, 3 = -Z (so X for even, Z
 * for odd). A large wheel's axle is always the mounting `face` normal.
 */
export function wheelAxle(part: Pick<Part, 'type' | 'face' | 'rotation'>): Vec3 {
  if (part.type === 'bigWheel') return part.face ? [part.face[0], 0, part.face[2]] : [1, 0, 0];
  return [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]][partRotation(part)] as Vec3;
}

/**
 * Unit vector, horizontal and along the mounted face, that a large wheel extends toward (even rotation: +Z for an X face
 * and +X for a Z face; odd rotation: the opposite way).
 */
function bigWheelSide(part: Pick<Part, 'face' | 'rotation'>): Vec3 {
  const along: Vec3 = part.face && part.face[2] !== 0 ? [1, 0, 0] : [0, 0, 1];
  const sign = normalizeRotation(part.rotation ?? 0) % 2 === 0 ? 1 : -1;
  return [along[0] * sign, 0, along[2] * sign];
}

/**
 * The grid cells a part occupies: just its `cell`, except a large wheel, which covers 2 x 2 cells of the plane of the face
 * it is mounted on: `cell`, the one above it and the two beside them (toward `bigWheelSide`).
 */
export function partCells(part: Pick<Part, 'type' | 'cell' | 'face' | 'rotation'>): Vec3[] {
  if (part.type !== 'bigWheel') return [part.cell];
  const side = bigWheelSide(part);
  const up: Vec3 = [0, 1, 0];
  const beside = addVec(part.cell, side);
  return [part.cell, addVec(part.cell, up), beside, addVec(beside, up)];
}

/** The centre of a part in world coordinates: its cell, except a large wheel, whose centre is the middle of its 4 cells. */
export function partCentre(part: Pick<Part, 'type' | 'cell' | 'face' | 'rotation'>): Vec3 {
  if (part.type !== 'bigWheel') return part.cell;
  const side = bigWheelSide(part);
  return [part.cell[0] + side[0] / 2, part.cell[1] + 0.5, part.cell[2] + side[2] / 2];
}

/** Three.js yaw (counter-clockwise seen from above, radians) of a number of clockwise quarter turns. */
export const yawOfTurns = (turns: number): number => (-turns * Math.PI) / 2;

/** True for a `#rrggbb` colour string (what saved parts may carry in `Part.color`). */
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

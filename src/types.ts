export type Vec3 = [number, number, number];
/** Parts that make up the body of a creation: blocks, plates and L brackets in several sizes (see `SHAPES`). */
export const STRUCTURAL_TYPES = [
  'block',
  'blockHalf',
  'blockLarge',
  'plate',
  'plateHalf',
  'plateLarge',
  'plateLargeHalf',
  'bracket',
  'bracketSmall',
] as const;
export type StructuralType = (typeof STRUCTURAL_TYPES)[number];
export type PartType = StructuralType | 'wheel' | 'bigWheel';

/** Structural parts (touching ones are welded through their studs into one rigid body). */
export const isStructural = (type: PartType): type is StructuralType => (STRUCTURAL_TYPES as readonly string[]).includes(type);

/** Wheels (small and large): mounted on a block face, with a tire and a suspension. */
export const isWheelType = (type: PartType): boolean => type === 'wheel' || type === 'bigWheel';

/** What the left button does: place parts, inspect a part, or remove parts. */
export type CursorMode = 'build' | 'inspect' | 'paint' | 'remove';

export interface Part {
  type: PartType;
  /**
   * Centre of the part, in cell units. Blocks and plates snap to the stud pitch (`STUD.pitch`) in x and z, so they may sit on
   * half cells, and their height is whatever the part they rest on gives (a plate is 0.2 thick), so the numbers are not
   * always integers: compare them through `cellKey`, which rounds. Wheels sit one cell from their host block.
   */
  cell: Vec3;
  /**
   * Outward normal of the block face a wheel is mounted on: its host block is at `cell - face` (its axle is chosen by
   * `rotation`). Not used by blocks and plates.
   */
  face?: Vec3;
  /**
   * Structural parts: the direction the main studs point (a unit vector along an axis), so the part can lie on any of
   * its 6 faces. Missing = up, `[0, 1, 0]`. Together with `spin` it is the whole orientation (24 turns). Read it through
   * `studsOf()`.
   */
  studs?: Vec3;
  /**
   * Structural parts: quarter turns (1-3) of the part around its studs, for the shapes that look different after one (a
   * half plate, an L bracket; see `SHAPES[type].spins`). Missing = 0. Read it through `spinOf()`.
   */
  spin?: number;
  /**
   * Small wheels: `1` or `-1` points the axle straight up or down instead of horizontally (see `wheelAxle`); missing =
   * horizontal, chosen by `rotation`.
   */
  pitch?: 1 | -1;
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
  /** Wheels only (`PART_INFO[type].hasTire`): tire value, an integer 0-100 (0 speed tires, 100 traction tires, see `TIRE`). Missing = `TIRE.default`. Read it through `tireOf()`. */
  tire?: number;
  /** Blocks only (`PART_INFO[type].hasWeight`): weight, an integer (see `WEIGHT`). Missing = `WEIGHT.default`. Read it through `weightOf()`. */
  weight?: number;
}

/** Rounds away the floating-point noise of positions made of halves and fifths (0.001 is far below any real step). */
export const roundCoord = (v: number): number => Math.round(v * 1000) / 1000;
export const cellKey = (c: Vec3): string => `${roundCoord(c[0])},${roundCoord(c[1])},${roundCoord(c[2])}`;
export const addVec = (a: Vec3, b: Vec3): Vec3 => [roundCoord(a[0] + b[0]), roundCoord(a[1] + b[1]), roundCoord(a[2] + b[2])];
export const subVec = (a: Vec3, b: Vec3): Vec3 => [roundCoord(a[0] - b[0]), roundCoord(a[1] - b[1]), roundCoord(a[2] - b[2])];

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
export function wheelAxle(part: Pick<Part, 'type' | 'face' | 'rotation' | 'pitch'>): Vec3 {
  if (part.type === 'bigWheel') return part.face ? [part.face[0], 0, part.face[2]] : [1, 0, 0];
  if (part.pitch) return [0, part.pitch, 0];
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

/** The direction a block's or plate's studs point: its own, or up. */
export const studsOf = (part: Pick<Part, 'studs'>): Vec3 => part.studs ?? [0, 1, 0];

/** The spin of a structural part around its studs (0-3). */
export const spinOf = (part: Pick<Part, 'spin'>): number => normalizeRotation(part.spin ?? 0);

/** Is `v` one of the six axis directions (a unit vector along x, y or z)? */
export const isAxisDirection = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number') && v.filter((n) => n !== 0).length === 1 && v.every((n) => n === 0 || Math.abs(n) === 1);

/**
 * Turns the axis direction `v` by `turns` quarter turns around the axis `axis` (a unit axis vector), counter-clockwise
 * seen from the tip of `axis` (right-handed). Exact: results stay on the axes.
 */
export function turnAbout(v: Vec3, axis: Vec3, turns: number): Vec3 {
  let out = v;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) {
    const dot = axis[0] * out[0] + axis[1] * out[1] + axis[2] * out[2];
    const cross: Vec3 = [
      axis[1] * out[2] - axis[2] * out[1],
      axis[2] * out[0] - axis[0] * out[2],
      axis[0] * out[1] - axis[1] * out[0],
    ];
    out = [cross[0] + axis[0] * dot, cross[1] + axis[1] * dot, cross[2] + axis[2] * dot].map((n) => (n === 0 ? 0 : n)) as Vec3;
  }
  return out;
}

/** Three.js yaw (counter-clockwise seen from above, radians) of a number of clockwise quarter turns. */
export const yawOfTurns = (turns: number): number => (-turns * Math.PI) / 2;

/** True for a `#rrggbb` colour string (what saved parts may carry in `Part.color`). */
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

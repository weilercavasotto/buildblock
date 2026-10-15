import { CELL_SIZE, ENGINE_BODY } from './constants/game';
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
export type PartType = StructuralType | 'wheel' | 'bigWheel' | 'engine';

/** Structural parts (touching ones are welded through their studs into one rigid body). */
export const isStructural = (type: PartType): type is StructuralType => (STRUCTURAL_TYPES as readonly string[]).includes(type);

/** The engine: mounted on a face of a block like a wheel, it drives the wheels of the body. */
export const isEngine = (type: PartType): boolean => type === 'engine';

/** Parts mounted on a face of a block (`Part.face`, the host block is at `cell - face`): the wheels and the engine. */
export const isMountedType = (type: PartType): boolean => type === 'wheel' || type === 'bigWheel' || type === 'engine';

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
   * Outward normal of the block face a wheel or engine is mounted on: its host block is at `cell - face`. Not used by blocks
   * and plates, and independent of how the part is turned (see `studs` / `spin`).
   */
  face?: Vec3;
  /**
   * The orientation of every part, the same way for all of them: the direction the part's local up (+Y) points in (a unit
   * vector along an axis, so it can lie on any of its 6 faces; missing = up, `[0, 1, 0]`) plus a `spin` around it make 24
   * turns. A block's studs are its up; a wheel's axle is its local +X, a large wheel's too (it fills the 2 x 2 cells that its
   * local +Y and +Z lead to), an engine's front is its local +Z. Read them through `orientationOfPart()` and `axleOf()` / `frontOf()`.
   */
  studs?: Vec3;
  /** Quarter turns (1-3) of the part around its `studs` direction (see `studs`); missing = 0. Only turns the shape can tell apart are stored (see `canonicalOrientation`). Read it through `spinOf()`. */
  spin?: number;
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
  /** Engines only (`PART_INFO[type].hasPower`): power, an integer (see `ENGINE`). Missing = `ENGINE.default`. Read it through `powerOf()`. */
  power?: number;
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
 * to read saves made when a wheel's axle was always its mounting face (they have no `rotation`).
 */
export function rotationOfFace(face: Vec3): number {
  if (face[0] !== 0) return face[0] > 0 ? 0 : 2;
  return face[2] > 0 ? 1 : 3;
}

/** The direction a block's or plate's studs point: its own, or up. */
export const studsOf = (part: Pick<Part, 'studs'>): Vec3 => part.studs ?? [0, 1, 0];

/** The spin of a part around its studs direction (0-3). */
export const spinOf = (part: Pick<Part, 'spin'>): number => normalizeRotation(part.spin ?? 0);

/**
 * The orientation of a part as a rotation matrix by columns: where its local x, y, z axes end up in the world (every entry is
 * 0 or ±1, so it is exact). `Orientation` is its compact form, the direction local +Y points in plus a spin around it.
 */
export type Matrix = [Vec3, Vec3, Vec3];
export interface Orientation {
  studs: Vec3;
  spin: number;
}

/** Turn that takes +Y onto `dir` (the part lying with its up along `dir`, before the spin). */
function facing(dir: Vec3): Matrix {
  if (dir[1] === 1) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (dir[1] === -1) return [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
  if (dir[2] === 1) return [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
  if (dir[2] === -1) return [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  if (dir[0] === 1) return [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
  return [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
}

/** Applies the matrix `m` to the vector `v`. */
export const applyMatrix = (m: Matrix, v: Vec3): Vec3 =>
  [0, 1, 2].map((i) => m[0][i] * v[0] + m[1][i] * v[1] + m[2][i] * v[2]).map((n) => (n === 0 ? 0 : n)) as Vec3;

/** The matrix of an orientation: the spin around Y first, then the turn that points the up. Any integer spin works. */
export function matrixOf(o: Orientation): Matrix {
  const base = facing(o.studs);
  const spun: Matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let i = 0; i < normalizeRotation(o.spin); i++) {
    spun[0] = turnAbout(spun[0], [0, 1, 0], 1);
    spun[2] = turnAbout(spun[2], [0, 1, 0], 1);
  }
  return [applyMatrix(base, spun[0]), applyMatrix(base, spun[1]), applyMatrix(base, spun[2])];
}

/** The orientation of a placed (or about to be placed) part. */
export const orientationOfPart = (part: Pick<Part, 'studs' | 'spin'>): Orientation => ({ studs: studsOf(part), spin: spinOf(part) });

const matrixOfPart = (part: Pick<Part, 'studs' | 'spin'>): Matrix => matrixOf(orientationOfPart(part));

/** The direction of a wheel's axle (a small or large wheel): its local +X, turned by its orientation. */
export const axleOf = (part: Pick<Part, 'studs' | 'spin'>): Vec3 => applyMatrix(matrixOfPart(part), [1, 0, 0]);

/** The direction an engine pushes the vehicle towards: its local +Z, turned by its orientation. */
export const frontOf = (part: Pick<Part, 'studs' | 'spin'>): Vec3 => applyMatrix(matrixOfPart(part), [0, 0, 1]);

/**
 * The two directions a large wheel extends in from its `cell` (its local +Y and +Z, turned by its orientation): it covers
 * 2 x 2 cells, the cell, the one in each direction and the one that is both.
 */
function bigWheelReach(part: Pick<Part, 'studs' | 'spin'>): [Vec3, Vec3] {
  const m = matrixOfPart(part);
  return [m[1], m[2]];
}

/** The grid cells a part occupies: just its `cell`, except a large wheel, which covers 2 x 2 cells (see `bigWheelReach`). */
export function partCells(part: Pick<Part, 'type' | 'cell' | 'studs' | 'spin'>): Vec3[] {
  if (part.type !== 'bigWheel') return [part.cell];
  const [u, v] = bigWheelReach(part);
  const beside = addVec(part.cell, u);
  return [part.cell, beside, addVec(part.cell, v), addVec(beside, v)];
}

/** The centre of a part in world coordinates: its cell, except a large wheel (the middle of its 4 cells) and an engine (nearer its host block). */
export function partCentre(part: Pick<Part, 'type' | 'cell' | 'face' | 'studs' | 'spin'>): Vec3 {
  if (part.type === 'engine' && part.face) {
    // The engine body is smaller than a cell and rests against its host block.
    const back = (CELL_SIZE - ENGINE_BODY.depth) / 2;
    return [part.cell[0] - part.face[0] * back, part.cell[1] - part.face[1] * back, part.cell[2] - part.face[2] * back];
  }
  if (part.type !== 'bigWheel') return part.cell;
  const [u, v] = bigWheelReach(part);
  return [part.cell[0] + (u[0] + v[0]) / 2, part.cell[1] + (u[1] + v[1]) / 2, part.cell[2] + (u[2] + v[2]) / 2];
}

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

/** True for a `#rrggbb` colour string (what saved parts may carry in `Part.color`). */
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

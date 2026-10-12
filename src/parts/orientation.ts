import { SHAPES } from '../constants/part-shapes';
import { Part, StructuralType, Vec3, normalizeRotation, studsOf, spinOf, turnAbout } from '../types';

/**
 * Orientation of a structural part: the direction its main studs point plus a spin around them. It is stored as a rotation
 * matrix by columns (where the part's local x, y, z axes end up in the world); every entry is 0 or ±1, so it is exact.
 */
export type Matrix = [Vec3, Vec3, Vec3];
export interface Orientation {
  studs: Vec3;
  spin: number;
}

/** Turn that takes +Y onto `dir` (the part lying with its studs along `dir`, before the spin). */
function facing(dir: Vec3): Matrix {
  if (dir[1] === 1) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (dir[1] === -1) return [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
  if (dir[2] === 1) return [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
  if (dir[2] === -1) return [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  if (dir[0] === 1) return [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
  return [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
}

const apply = (m: Matrix, v: Vec3): Vec3 =>
  [0, 1, 2].map((i) => m[0][i] * v[0] + m[1][i] * v[1] + m[2][i] * v[2]).map((n) => (n === 0 ? 0 : n)) as Vec3;

/** The matrix of an orientation: the spin around Y first, then the turn that points the studs. Any integer spin works. */
export function matrixOf(o: Orientation): Matrix {
  const base = facing(o.studs);
  const spun: Matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let i = 0; i < normalizeRotation(o.spin); i++) {
    spun[0] = turnAbout(spun[0], [0, 1, 0], 1);
    spun[2] = turnAbout(spun[2], [0, 1, 0], 1);
  }
  return [apply(base, spun[0]), apply(base, spun[1]), apply(base, spun[2])];
}

/** The orientation of a placed (or about to be placed) part. */
export const orientationOfPart = (part: Pick<Part, 'studs' | 'spin'>): Orientation => ({ studs: studsOf(part), spin: spinOf(part) });

/**
 * The orientation whose matrix is `m` (a spin that the shape of `type` cannot tell apart is dropped, so equal-looking parts
 * have equal orientations).
 */
export function orientationFromMatrix(type: StructuralType, m: Matrix): Orientation {
  const studs = m[1];
  const base = facing(studs);
  // The part's local x axis seen in the frame of `base`: (1, 0) is spin 0, (0, -1) spin 1, (-1, 0) spin 2, (0, 1) spin 3.
  const x = [0, 1, 2].reduce((sum, i) => sum + m[0][i] * base[0][i], 0);
  const z = [0, 1, 2].reduce((sum, i) => sum + m[0][i] * base[2][i], 0);
  const spin = x === 1 ? 0 : z === -1 ? 1 : x === -1 ? 2 : 3;
  return { studs, spin: spin % SHAPES[type].spins };
}

/** The orientation after turning the part by `turns` quarter turns around the world axis `axis` (see `turnAbout`). */
export function turnOrientation(type: StructuralType, o: Orientation, axis: Vec3, turns: number): Orientation {
  const m = matrixOf(o);
  return orientationFromMatrix(type, [turnAbout(m[0], axis, turns), turnAbout(m[1], axis, turns), turnAbout(m[2], axis, turns)]);
}

/** Stored fields for an orientation (nothing for the default one), to spread into a `Part`. */
export const orientationFields = (o: Orientation): Pick<Part, 'studs' | 'spin'> => ({
  ...(o.studs[1] === 1 ? {} : { studs: o.studs }),
  ...(o.spin === 0 ? {} : { spin: o.spin }),
});

/** Is `value` a valid saved spin? */
export const isSpin = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3;

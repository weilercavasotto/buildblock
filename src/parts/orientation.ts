import { SHAPES } from '../constants/part-shapes';
import { Matrix, Orientation, Part, PartType, Vec3, applyMatrix, isStructural, matrixOf, normalizeRotation, rotationOfFace, turnAbout } from '../types';

export { matrixOf, orientationOfPart } from '../types';
export type { Matrix, Orientation } from '../types';

/**
 * Every part is oriented the same way (see `Part.studs` / `Part.spin`): 24 turns, the direction its local +Y points in plus
 * a spin around it. Which turns look the same depends on the part: a square block repeats every quarter turn around its
 * studs, a wheel repeats around its axle (local X), an L bracket, an engine and a large wheel never repeat.
 */

const identity: Matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const quarterTurns = (axis: Vec3, count: number[]): Matrix[] =>
  count.map((k) => [turnAbout([1, 0, 0], axis, k), turnAbout([0, 1, 0], axis, k), turnAbout([0, 0, 1], axis, k)] as Matrix);

/** The turns (in the part's own frame) that leave its shape looking the same: the part may be stored with any of them. */
function symmetryOf(type: PartType): Matrix[] {
  if (isStructural(type)) {
    const spins = SHAPES[type].spins;
    return quarterTurns([0, 1, 0], spins === 1 ? [0, 1, 2, 3] : spins === 2 ? [0, 2] : [0]);
  }
  if (type === 'wheel') return quarterTurns([1, 0, 0], [0, 1, 2, 3]); // around its axle
  if (type === 'rotor') return quarterTurns([0, 1, 0], [0, 1, 2, 3]); // a round base and a square head: around its axis
  return [identity];
}

const DIRECTIONS: Vec3[] = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
const rank = (o: Orientation): number => DIRECTIONS.findIndex((d) => d.every((v, i) => v === o.studs[i])) * 4 + o.spin;

/** Every one of the 24 orientations. */
export const ALL_ORIENTATIONS: Orientation[] = DIRECTIONS.flatMap((studs) => [0, 1, 2, 3].map((spin) => ({ studs, spin })));

/**
 * The orientation whose matrix is `m`, as a direction plus a spin (the spin is unreduced: see `canonicalOrientation`).
 */
export function orientationOfMatrix(m: Matrix): Orientation {
  return ALL_ORIENTATIONS.find((o) => {
    const candidate = matrixOf(o);
    return candidate.every((col, i) => col.every((v, j) => v === m[i][j]));
  })!;
}

/** The turn after the part's own `symmetry` one: the orientation of the same part looking the same. */
const compose = (m: Matrix, local: Matrix): Matrix => [applyMatrix(m, local[0]), applyMatrix(m, local[1]), applyMatrix(m, local[2])];

/**
 * The orientation without the turn that the shape of `type` cannot tell apart, so equal-looking parts have equal orientations:
 * of all the orientations that look the same it is the lowest one.
 */
export function canonicalOrientation(type: PartType, o: Orientation): Orientation {
  const m = matrixOf(o);
  return symmetryOf(type)
    .map((turn) => orientationOfMatrix(compose(m, turn)))
    .reduce((best, candidate) => (rank(candidate) < rank(best) ? candidate : best));
}

/**
 * The orientation after turning the part by `turns` quarter turns around the world axis `axis` (see `turnAbout`). With
 * `reduce` (the default) it is the canonical one; the placement ghost keeps the full turn so a part that looks the same
 * after a quarter turn still shows it.
 */
export function turnOrientation(type: PartType, o: Orientation, axis: Vec3, turns: number, reduce = true): Orientation {
  const m = matrixOf(o);
  const next = orientationOfMatrix([turnAbout(m[0], axis, turns), turnAbout(m[1], axis, turns), turnAbout(m[2], axis, turns)]);
  return reduce ? canonicalOrientation(type, next) : next;
}

/** Stored fields for an orientation (nothing for the default one), to spread into a `Part`. */
export const orientationFields = (o: Orientation): Pick<Part, 'studs' | 'spin'> => ({
  ...(o.studs[1] === 1 ? {} : { studs: o.studs }),
  ...(o.spin === 0 ? {} : { spin: o.spin }),
});

/** Is `value` a valid saved spin? */
export const isSpin = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3;

/**
 * The orientation of a part saved before every part was oriented the same way: a wheel had `rotation` (clockwise quarter
 * turns, picking its axle) and `pitch` (axle straight up / down), a large wheel `rotation` (its parity: which side it extends
 * toward) and an engine `front` (with its up along its face). Returns the canonical orientation with the same look.
 */
export function legacyOrientation(
  part: Pick<Part, 'type' | 'face'> & { rotation?: number; pitch?: number; front?: Vec3 },
  /** Saves from before wheels could be rotated had no `rotation`: their axle was the face normal. */
  axleFromFace: boolean,
): Orientation {
  const face = part.face ?? [1, 0, 0];
  const find = (match: (m: Matrix) => boolean): Orientation | undefined => ALL_ORIENTATIONS.find((o) => match(matrixOf(o)));
  const same = (a: Vec3, b: Vec3) => a.every((v, i) => v === b[i]);
  let found: Orientation | undefined;

  if (part.type === 'wheel') {
    const rotation = part.rotation !== undefined ? normalizeRotation(part.rotation) : axleFromFace ? rotationOfFace(face) : 0;
    const axle: Vec3 = part.pitch ? [0, part.pitch, 0] : ([[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]][rotation] as Vec3);
    found = find((m) => same(m[0], axle));
  } else if (part.type === 'bigWheel') {
    // The axle was the face normal and its rotation picked the side (along the face) it extended toward, besides going up.
    const axle: Vec3 = [face[0], 0, face[2]];
    const along: Vec3 = face[2] !== 0 ? [1, 0, 0] : [0, 0, 1];
    const sign = normalizeRotation(part.rotation ?? 0) % 2 === 0 ? 1 : -1;
    const side: Vec3 = [along[0] * sign, 0, along[2] * sign];
    found = find((m) => same(m[0], axle) && ((same(m[1], side) && same(m[2], [0, 1, 0])) || (same(m[2], side) && same(m[1], [0, 1, 0]))));
  } else if (part.type === 'engine') {
    // The front pushed along `front` (default: out of the face) and the cylinder heads were up the face normal.
    const front = part.front ?? face;
    const up: Vec3 = same(front, face) || same(front, face.map((v) => -v) as Vec3) ? (face[1] === 0 ? [0, 1, 0] : [1, 0, 0]) : face;
    found = find((m) => same(m[2], front) && same(m[1], up));
  }
  return canonicalOrientation(part.type, found ?? { studs: [0, 1, 0], spin: 0 });
}

/**
 * The direction that defines how a part of `type` is turned: a block's studs, a wheel's axle, an engine's front. What the tilt
 * keys aim at when they cannot turn the part around the screen's left-right axis (see `BuildMode.tilt`).
 */
export function mainAxisOf(type: PartType, o: Orientation): Vec3 {
  const m = matrixOf(o);
  if (type === 'wheel' || type === 'bigWheel') return m[0];
  if (type === 'engine') return m[2];
  return m[1];
}

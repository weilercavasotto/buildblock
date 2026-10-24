import { CELL_SIZE, HEADED_PARTS, MOUNTED_BODY, SHAPES, STUD, WHEEL, studInside, wheelSizeOf } from '../constants';
import { Part, Vec3, addVec, axleOf, roundCoord, applyMatrix, isCompactMounted, isHeaded, isHostType, isStructural, isWing, matrixOf, orientationOfPart, partCells, partCentre, studsOf, spinOf } from '../types';

/** Axis-aligned box, in world units. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

/** A box of a structural part and the direction its studs point (a world axis vector). */
export interface StudBox extends Box {
  studs: Vec3;
  /** A wedge (see `ShapeBox.wedge`): the box is its bounding box, and it has no studs on top. */
  wedge?: true;
  /** A cylinder inscribed in the box (see `ShapeBox.round`). */
  round?: true;
  /** Smooth (see `ShapeBox.smooth`): no studs on top, only sockets underneath. */
  smooth?: true;
}

/** Tolerance for comparing heights and edges made of halves and fifths. */
export const EPS = 1e-3;

/** The parts' fields that decide their boxes and studs. */
type Shape = Pick<Part, 'type' | 'cell' | 'face' | 'studs' | 'spin'>;


const relativeCache = new Map<string, StudBox[]>();

/**
 * The boxes of a structural part as they sit in the world, relative to its `cell`: the shape's boxes turned by the part's
 * orientation. The first one is the anchor (centred on `cell`).
 */
export function relativeBoxes(part: Pick<Part, 'type' | 'studs' | 'spin'>): StudBox[] {
  if (!isStructural(part.type)) return [];
  const key = `${part.type}|${studsOf(part)}|${spinOf(part)}`;
  let boxes = relativeCache.get(key);
  if (!boxes) {
    const m = matrixOf(orientationOfPart(part));
    boxes = SHAPES[part.type].boxes.map((box) => {
      const centre = applyMatrix(m, box.offset);
      const half = applyMatrix(m, box.size).map((v) => Math.abs(v) / 2);
      return {
        min: centre.map((v, i) => v - half[i]) as Vec3,
        max: centre.map((v, i) => v + half[i]) as Vec3,
        studs: applyMatrix(m, box.studs).map((n) => (n === 0 ? 0 : n)) as Vec3,
        ...(box.wedge ? { wedge: true as const } : {}),
        ...(box.round ? { round: true as const } : {}),
        ...(box.smooth ? { smooth: true as const } : {}),
      };
    });
    relativeCache.set(key, boxes);
  }
  return boxes;
}

/**
 * The corners of each wedge of a structural part, relative to its `cell` (turned by its orientation): the six points of the
 * triangular prism, three at each end of its width (a swept wing's half: the outline's corners at both faces). One entry per box of the shape: `null` for a box that is not a wedge.
 */
export function wedgePoints(part: Pick<Part, 'type' | 'studs' | 'spin'>): Array<Vec3[] | null> {
  if (!isStructural(part.type)) return [];
  const m = matrixOf(orientationOfPart(part));
  return SHAPES[part.type].boxes.map((box) => {
    if (!box.wedge) return null;
    if (box.polygon) {
      const h = box.size[1] / 2;
      return box.polygon.flatMap(([x, z]) => [-h, h].map((y) => applyMatrix(m, [box.offset[0] + x, box.offset[1] + y, box.offset[2] + z]).map((v) => roundCoord(v)) as Vec3));
    }
    const [w, h, d] = box.size.map((v) => v / 2);
    const profile: Array<[number, number]> = [[-d, -h], [d, -h], [-d, h]]; // z, y: the back foot, the front foot and the back top
    return [-w, w].flatMap((x) => profile.map(([z, y]) => applyMatrix(m, [box.offset[0] + x, box.offset[1] + y, box.offset[2] + z]).map((v) => roundCoord(v)) as Vec3));
  });
}

/** The boxes (with the direction of their studs) a structural part occupies in the world. */
export function partBoxes(part: Shape): StudBox[] {
  return relativeBoxes(part).map((box) => ({ min: addVec(part.cell, box.min), max: addVec(part.cell, box.max), studs: box.studs, ...(box.wedge ? { wedge: true as const } : {}), ...(box.round ? { round: true as const } : {}), ...(box.smooth ? { smooth: true as const } : {}) }));
}

/**
 * The head of a rotor or a piston in the world (folded, as it is placed): a thin plate on the outside of the part (the side its `face`
 * points to), with its studs pointing that way (the parts welded to them move with the head). `null` for any other part. The base is
 * the rest of `partBox`.
 */
export function headOf(part: Shape): StudBox | null {
  if (!isHeaded(part.type) || !part.face) return null;
  const whole = partBox(part);
  const axis = part.face.findIndex((v) => v !== 0);
  const sign = part.face[axis];
  const depth = HEADED_PARTS[part.type as keyof typeof HEADED_PARTS].headDepth;
  const head: StudBox = { min: [...whole.min] as Vec3, max: [...whole.max] as Vec3, studs: part.face.map((v) => (v === 0 ? 0 : v)) as Vec3 };
  if (sign > 0) head.min[axis] = whole.max[axis] - depth;
  else head.max[axis] = whole.min[axis] + depth;
  return head;
}

/** The boxes whose studs engage the studs of other parts: those of a structural part, or the head of a rotor or a piston. */
function studBoxesOf(part: Shape): StudBox[] {
  // A wing has sockets on both of its faces (it is held from below or, turned over, from above), so it counts as two boxes facing opposite ways.
  if (isWing(part.type)) return partBoxes(part).flatMap((box) => [box, { ...box, studs: box.studs.map((v) => (v === 0 ? 0 : -v)) as Vec3 }]);
  if (isStructural(part.type)) return partBoxes(part);
  const head = headOf(part);
  return head ? [head] : [];
}

/** The smallest box that holds all of `boxes`. */
export function boundingBox(boxes: ReadonlyArray<Box>): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], box.min[i]);
      max[i] = Math.max(max[i], box.max[i]);
    }
  }
  return { min, max };
}

/**
 * The box a part occupies: for a structural part the one around all its boxes, an engine, a turbo or a thruster its compact body, a wheel fills its
 * cell, a large wheel its 2 x 2 cells.
 */
export function partBox(part: Shape): Box {
  if (isStructural(part.type)) return boundingBox(partBoxes(part));
  if (isCompactMounted(part.type) && part.face) {
    // A compact box against the host block: `depth` out of the face, `width` across it (`MOUNTED_BODY`).
    const centre = partCentre(part);
    const body = MOUNTED_BODY[part.type];
    const half = part.face.map((v) => (v !== 0 ? body.depth : body.width) / 2);
    return { min: centre.map((v, i) => v - half[i]) as Vec3, max: centre.map((v, i) => v + half[i]) as Vec3 };
  }
  const half = CELL_SIZE / 2;
  return boundingBox(partCells(part).map((c) => ({ min: [c[0] - half, c[1] - half, c[2] - half] as Vec3, max: [c[0] + half, c[1] + half, c[2] + half] as Vec3 })));
}

/** The box around a wheel's tire (its radius across the axle, half its width along it), for telling whether two wheels overlap. */
export function wheelBox(wheel: Shape): Box {
  const { scale } = wheelSizeOf(wheel.type);
  const axle = axleOf(wheel);
  const centre = partCentre(wheel);
  const half = axle.map((v) => (v !== 0 ? WHEEL.width : WHEEL.radius * 2) * scale / 2) as Vec3;
  return { min: centre.map((v, i) => v - half[i]) as Vec3, max: centre.map((v, i) => v + half[i]) as Vec3 };
}

/** Do the interiors of the two boxes intersect (touching faces do not count)? */
export function boxesOverlap(a: Box, b: Box): boolean {
  for (let i = 0; i < 3; i++) {
    if (a.max[i] - b.min[i] <= EPS || b.max[i] - a.min[i] <= EPS) return false;
  }
  return true;
}

/** Do two parts intersect? Structural parts are compared box by box (an L bracket does not fill its bounding box). */
export function partsOverlap(a: Shape, b: Shape): boolean {
  if (!boxesOverlap(partBox(a), partBox(b))) return false;
  const [boxesA, boxesB] = [isStructural(a.type) ? partBoxes(a) : [partBox(a)], isStructural(b.type) ? partBoxes(b) : [partBox(b)]];
  return boxesA.some((x) => boxesB.some((y) => boxesOverlap(x, y)));
}

/**
 * How many studs engage when two structural parts are put together. A box's studs point along its `studs` direction `d`
 * and fit into the underside (the face looking along `-d`) of a box whose own studs also point along `d`, which is why a
 * part turned upside down does not connect to one that is not. The boxes must touch on those faces and their faces overlap;
 * each `STUD.pitch` x `STUD.pitch` square of the overlap is one stud. Summed over every pair of boxes; 0 when the parts do
 * not connect (a part that is neither structural nor a rotor or piston has no studs). The head of a rotor or a piston counts like a plate with its studs
 * along the part's face, so a part placed on it is held by it (and moves with it in Play).
 */
export function studsEngaged(a: Shape, b: Shape): number {
  const [boxesA, boxesB] = [studBoxesOf(a), studBoxesOf(b)];
  if (boxesA.length === 0 || boxesB.length === 0) return 0;
  if (!boxesOverlapOrTouch(partBox(a), partBox(b))) return 0;
  let count = rootContact(a, b) + rootContact(b, a);
  for (const boxA of boxesA) {
    for (const boxB of boxesB) {
      if (boxA.studs.some((v, i) => v !== boxB.studs[i])) continue;
      const axis = boxA.studs.findIndex((v) => v !== 0);
      const [u, w] = [0, 1, 2].filter((i) => i !== axis);
      // The studs of one box fit the underside of the other: its stud face touches the other's socket face (`studs` is the same for both).
      // A wedge or a tile has no studs, so it can only be the one that is held (its underside on the studs of the other).
      const stud = (box: StudBox) => (box.studs[axis] > 0 ? box.max[axis] : box.min[axis]);
      const socket = (box: StudBox) => (box.studs[axis] > 0 ? box.min[axis] : box.max[axis]);
      const aOnB = !boxA.wedge && !boxA.smooth && Math.abs(stud(boxA) - socket(boxB)) <= EPS;
      const bOnA = !boxB.wedge && !boxB.smooth && Math.abs(stud(boxB) - socket(boxA)) <= EPS;
      if (!aOnB && !bOnA) continue;
      const overlapU = Math.min(boxA.max[u], boxB.max[u]) - Math.max(boxA.min[u], boxB.min[u]);
      const overlapW = Math.min(boxA.max[w], boxB.max[w]) - Math.max(boxA.min[w], boxB.min[w]);
      if (overlapU <= EPS || overlapW <= EPS) continue;
      count += studsBetween(boxA, boxB, u, w, overlapU, overlapW);
    }
  }
  return count;
}

/**
 * The studs in the overlap of two stud faces (`overlapU` x `overlapW` along the axes `u`, `w`): one per `STUD.pitch` square, except that a
 * round box only has the studs whose centre is inside its circle, so those are counted one by one.
 */
function studsBetween(a: StudBox, b: StudBox, u: number, w: number, overlapU: number, overlapW: number): number {
  const squares = Math.round((overlapU * overlapW) / (STUD.pitch * STUD.pitch));
  if (!a.round && !b.round) return squares;
  const startU = Math.max(a.min[u], b.min[u]);
  const startW = Math.max(a.min[w], b.min[w]);
  const [nu, nw] = [Math.round(overlapU / STUD.pitch), Math.round(overlapW / STUD.pitch)];
  let count = 0;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nw; j++) {
      const [pu, pw] = [startU + (i + 0.5) * STUD.pitch, startW + (j + 0.5) * STUD.pitch];
      const inside = (box: StudBox) => !box.round || studInside(pu - (box.min[u] + box.max[u]) / 2, pw - (box.min[w] + box.max[w]) / 2, box.max[u] - box.min[u]);
      if (inside(a) && inside(b)) count++;
    }
  }
  return count;
}

/**
 * Is the root edge of the wing `wing` (the long straight edge of a swept wing, where it meets the body) against a side of the block `block`?
 * Then it is held by it, without studs (a wing is mounted on the side of a block like a wheel, or sits on top of it on its studs): 1, else 0.
 * Only the root counts, so the wing has to be turned until its root faces the block (the placement ghost is red until then).
 */
function rootContact(wing: Shape, block: Shape): number {
  if (!isWing(wing.type) || !isHostType(block.type)) return 0;
  const shape = SHAPES[wing.type].boxes[0];
  const root = shape.polygon!;
  const m = matrixOf(orientationOfPart(wing));
  const normal = applyMatrix(m, [Math.sign(root[0][0]), 0, 0]); // out of the wing, through its root
  const axis = normal.findIndex((v) => v !== 0);
  // The root edge as a box in the world: the two ends of its outline at the bottom and the top of the plate.
  const h = shape.size[1] / 2;
  const ends = [applyMatrix(m, [root[0][0], -h, root[0][1]]), applyMatrix(m, [root[1][0], h, root[1][1]])].map((p) => addVec(wing.cell, p));
  const edge: Box = { min: ends[0].map((v, i) => Math.min(v, ends[1][i])) as Vec3, max: ends[0].map((v, i) => Math.max(v, ends[1][i])) as Vec3 };
  const other = partBox(block);
  if (Math.abs(edge.min[axis] - (normal[axis] > 0 ? other.min[axis] : other.max[axis])) > EPS) return 0;
  return [0, 1, 2].every((i) => i === axis || Math.min(edge.max[i], other.max[i]) - Math.max(edge.min[i], other.min[i]) > EPS) ? 1 : 0;
}

/** True when the boxes overlap or touch (a quick test before comparing the boxes of two parts). */
function boxesOverlapOrTouch(a: Box, b: Box): boolean {
  return [0, 1, 2].every((i) => a.max[i] - b.min[i] >= -EPS && b.max[i] - a.min[i] >= -EPS);
}


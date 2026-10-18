import { CELL_SIZE, MOUNTED_BODY, ROTOR_VISUAL, SHAPES, STUD } from '../constants';
import { Part, Vec3, addVec, applyMatrix, isCompactMounted, isRotor, isStructural, matrixOf, orientationOfPart, partCells, partCentre, studsOf, spinOf } from '../types';

/** Axis-aligned box, in world units. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

/** A box of a structural part and the direction its studs point (a world axis vector). */
export interface StudBox extends Box {
  studs: Vec3;
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
      };
    });
    relativeCache.set(key, boxes);
  }
  return boxes;
}

/** The boxes (with the direction of their studs) a structural part occupies in the world. */
export function partBoxes(part: Shape): StudBox[] {
  return relativeBoxes(part).map((box) => ({ min: addVec(part.cell, box.min), max: addVec(part.cell, box.max), studs: box.studs }));
}

/**
 * The head of a rotor in the world: a thin square plate on the outside of the rotor (the side its `face` points to), with its studs
 * pointing that way (the part welded to them turns with the head). `null` for any other part. The base is the rest of `partBox`.
 */
export function rotorHead(part: Shape): StudBox | null {
  if (!isRotor(part.type) || !part.face) return null;
  const whole = partBox(part);
  const axis = part.face.findIndex((v) => v !== 0);
  const sign = part.face[axis];
  const head: StudBox = { min: [...whole.min] as Vec3, max: [...whole.max] as Vec3, studs: part.face.map((v) => (v === 0 ? 0 : v)) as Vec3 };
  if (sign > 0) head.min[axis] = whole.max[axis] - ROTOR_VISUAL.headDepth;
  else head.max[axis] = whole.min[axis] + ROTOR_VISUAL.headDepth;
  return head;
}

/** The boxes whose studs engage the studs of other parts: those of a structural part, or the head of a rotor. */
function studBoxesOf(part: Shape): StudBox[] {
  if (isStructural(part.type)) return partBoxes(part);
  const head = rotorHead(part);
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
 * not connect (a part that is neither structural nor a rotor has no studs). The head of a rotor counts like a plate with its studs
 * along the rotor's face, so a part placed on it is held by it (and turns with it in Play).
 */
export function studsEngaged(a: Shape, b: Shape): number {
  const [boxesA, boxesB] = [studBoxesOf(a), studBoxesOf(b)];
  if (boxesA.length === 0 || boxesB.length === 0) return 0;
  if (!boxesOverlapOrTouch(partBox(a), partBox(b))) return 0;
  let count = 0;
  for (const boxA of boxesA) {
    for (const boxB of boxesB) {
      if (boxA.studs.some((v, i) => v !== boxB.studs[i])) continue;
      const axis = boxA.studs.findIndex((v) => v !== 0);
      const [u, w] = [0, 1, 2].filter((i) => i !== axis);
      if (Math.abs(boxA.max[axis] - boxB.min[axis]) > EPS && Math.abs(boxB.max[axis] - boxA.min[axis]) > EPS) continue;
      const overlapU = Math.min(boxA.max[u], boxB.max[u]) - Math.max(boxA.min[u], boxB.min[u]);
      const overlapW = Math.min(boxA.max[w], boxB.max[w]) - Math.max(boxA.min[w], boxB.min[w]);
      if (overlapU <= EPS || overlapW <= EPS) continue;
      count += Math.round((overlapU * overlapW) / (STUD.pitch * STUD.pitch));
    }
  }
  return count;
}

/** True when the boxes overlap or touch (a quick test before comparing the boxes of two parts). */
function boxesOverlapOrTouch(a: Box, b: Box): boolean {
  return [0, 1, 2].every((i) => a.max[i] - b.min[i] >= -EPS && b.max[i] - a.min[i] >= -EPS);
}


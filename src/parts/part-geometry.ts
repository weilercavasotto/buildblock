import { CELL_SIZE, PLATE, STUD } from '../constants';
import { Part, Vec3, isStructural, partCells, studsOf } from '../types';

/** Axis-aligned box, in world units. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

/** Tolerance for comparing heights and edges made of halves and fifths. */
export const EPS = 1e-3;

/** The parts' fields that decide their box and studs. */
type Shape = Pick<Part, 'type' | 'cell' | 'face' | 'rotation' | 'studs'>;

/**
 * The box a part occupies: a block fills a cell, a plate is a slab `PLATE.thickness` thick along the direction of its studs
 * (flat when they point up, a wall when they point sideways), a wheel fills its cell, a large wheel its 2 x 2 cells.
 */
export function partBox(part: Shape): Box {
  if (part.type === 'bigWheel') {
    const cells = partCells(part);
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const c of cells) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], c[i] - CELL_SIZE / 2);
        max[i] = Math.max(max[i], c[i] + CELL_SIZE / 2);
      }
    }
    return { min, max };
  }
  const half: Vec3 = [CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2];
  if (part.type === 'plate') half[studsOf(part).findIndex((v) => v !== 0)] = PLATE.thickness / 2;
  return {
    min: [part.cell[0] - half[0], part.cell[1] - half[1], part.cell[2] - half[2]],
    max: [part.cell[0] + half[0], part.cell[1] + half[1], part.cell[2] + half[2]],
  };
}

/** Do the interiors of the two boxes intersect (touching faces do not count)? */
export function boxesOverlap(a: Box, b: Box): boolean {
  for (let i = 0; i < 3; i++) {
    if (a.max[i] - b.min[i] <= EPS || b.max[i] - a.min[i] <= EPS) return false;
  }
  return true;
}

/**
 * How many studs engage when two blocks or plates are stacked: they must point the same way (the studs of one go into the
 * underside of the other, which is why a part turned upside down does not connect to one that is not), the parts must touch
 * on the faces across that direction (either one on top of the other) and their footprints overlap; each `STUD.pitch` x
 * `STUD.pitch` square of the overlap is one stud. 0 when they do not connect (or are not blocks / plates).
 */
export function studsEngaged(a: Shape, b: Shape): number {
  if (!isStructural(a.type) || !isStructural(b.type)) return 0;
  const dir = studsOf(a);
  const other = studsOf(b);
  if (dir[0] !== other[0] || dir[1] !== other[1] || dir[2] !== other[2]) return 0;
  const axis = dir.findIndex((v) => v !== 0);
  const [u, w] = [0, 1, 2].filter((i) => i !== axis);
  const boxA = partBox(a);
  const boxB = partBox(b);
  if (Math.abs(boxA.max[axis] - boxB.min[axis]) > EPS && Math.abs(boxB.max[axis] - boxA.min[axis]) > EPS) return 0;
  const overlapU = Math.min(boxA.max[u], boxB.max[u]) - Math.max(boxA.min[u], boxB.min[u]);
  const overlapW = Math.min(boxA.max[w], boxB.max[w]) - Math.max(boxA.min[w], boxB.min[w]);
  if (overlapU <= EPS || overlapW <= EPS) return 0;
  return Math.round((overlapU * overlapW) / (STUD.pitch * STUD.pitch));
}

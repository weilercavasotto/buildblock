import { CELL_SIZE, PLATE } from './game';
import { StructuralType, Vec3 } from '../types';

/**
 * The geometry of every structural part (blocks, plates, L brackets), in its own frame with the main studs pointing up and
 * the origin at the centre of its first box (the "anchor": the part's `cell`, and the box whose edges snap to the stud
 * lattice). To add a size, add a `StructuralType` and an entry here (see docs/adding-a-part.md).
 */
export interface ShapeBox {
  /** Edge lengths along x, y, z, in cells (multiples of the stud pitch, except a plate's thickness). */
  size: Vec3;
  /** Centre of the box relative to the anchor box's centre. */
  offset: Vec3;
  /** Direction its studs point (an axis vector); the opposite face is its underside, which takes the studs of another part. */
  studs: Vec3;
}

export interface Shape {
  /** The first box is the anchor. */
  boxes: ReadonlyArray<ShapeBox>;
  /** How many of the 4 quarter turns around the studs look different (1: a square footprint, 2: a rectangle, 4: an L). */
  spins: 1 | 2 | 4;
}

const flat = (width: number, depth: number): ShapeBox => ({ size: [width, PLATE.thickness, depth], offset: [0, 0, 0], studs: [0, 1, 0] });
const solid = (width: number, height: number, depth: number): ShapeBox => ({ size: [width, height, depth], offset: [0, 0, 0], studs: [0, 1, 0] });

/**
 * An L bracket: a flat plate plus a wall plate standing on its back edge (outside the flat plate's footprint, studs facing
 * back), as tall as a block. Each plate has the studs of its width x depth, so a bracket 1 wide has 4 + 4 studs.
 */
const bracket = (width: number): ReadonlyArray<ShapeBox> => [
  flat(width, CELL_SIZE),
  {
    size: [width, CELL_SIZE, PLATE.thickness],
    offset: [0, (CELL_SIZE - PLATE.thickness) / 2, (CELL_SIZE + PLATE.thickness) / 2],
    studs: [0, 0, 1],
  },
];

export const SHAPES: Record<StructuralType, Shape> = {
  block: { boxes: [solid(1, 1, 1)], spins: 1 },
  /** Half a block: 1 x 1 footprint cut in two (2 studs). */
  blockHalf: { boxes: [solid(0.5, 1, 1)], spins: 2 },
  /** Four blocks in one: 2 x 2 footprint (16 studs). */
  blockLarge: { boxes: [solid(2, 1, 2)], spins: 1 },
  plate: { boxes: [flat(1, 1)], spins: 1 },
  /** A plate half as wide (2 studs). */
  plateHalf: { boxes: [flat(0.5, 1)], spins: 2 },
  /** Four plates in one: 2 x 2 (16 studs). */
  plateLarge: { boxes: [flat(2, 2)], spins: 1 },
  /** A large plate half as wide: 1 x 2 (8 studs). */
  plateLargeHalf: { boxes: [flat(1, 2)], spins: 2 },
  /** Two plates at a right angle (8 studs). */
  bracket: { boxes: bracket(1), spins: 4 },
  /** The same L, half as wide (4 studs). */
  bracketSmall: { boxes: bracket(0.5), spins: 4 },
};

/** Volume of a structural part relative to a block (what makes a plate light at the same weight setting). */
export const partVolume = (part: { type: StructuralType }): number =>
  SHAPES[part.type].boxes.reduce((sum, box) => sum + box.size[0] * box.size[1] * box.size[2], 0);

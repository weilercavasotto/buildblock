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
 * An L bracket: a flat plate (`width` x `size` footprint) plus a wall plate (`width` wide, `size` tall) standing on its back
 * edge (outside the flat plate's footprint, studs facing back). Each plate has the studs of its width x depth, so the normal
 * bracket (1 wide, size 1) has 4 + 4 studs and the large one (2 wide, size 2) 16 + 16.
 */
const bracket = (width: number, size: number = CELL_SIZE): ReadonlyArray<ShapeBox> => [
  flat(width, size),
  {
    size: [width, size, PLATE.thickness],
    offset: [0, (size - PLATE.thickness) / 2, (size + PLATE.thickness) / 2],
    studs: [0, 0, 1],
  },
];

export const SHAPES: Record<StructuralType, Shape> = {
  block: { boxes: [solid(1, 1, 1)], spins: 1 },
  /** The smallest block: a 0.5 x 0.5 footprint, full height (1 stud). */
  blockQuarter: { boxes: [solid(0.5, 1, 0.5)], spins: 1 },
  /** Half a block: 1 x 1 footprint cut in two (2 studs). */
  blockHalf: { boxes: [solid(0.5, 1, 1)], spins: 2 },
  /** A long thin beam: 0.5 x 2 footprint, full height (4 studs in a row). */
  blockLong: { boxes: [solid(0.5, 1, 2)], spins: 2 },
  /** Two blocks in a row: 1 x 2 footprint, full height (8 studs). */
  blockBeam: { boxes: [solid(1, 1, 2)], spins: 2 },
  /** Four blocks in one: 2 x 2 footprint (16 studs). */
  blockLarge: { boxes: [solid(2, 1, 2)], spins: 1 },
  plate: { boxes: [flat(1, 1)], spins: 1 },
  /** The smallest plate: 0.5 x 0.5 (a single stud). */
  plateQuarter: { boxes: [flat(0.5, 0.5)], spins: 1 },
  /** A plate half as wide (2 studs). */
  plateHalf: { boxes: [flat(0.5, 1)], spins: 2 },
  /** A long thin plate: 0.5 x 2 (4 studs in a row). */
  plateLong: { boxes: [flat(0.5, 2)], spins: 2 },
  /** Four plates in one: 2 x 2 (16 studs). */
  plateLarge: { boxes: [flat(2, 2)], spins: 1 },
  /** A big deck: 2 x 4 (32 studs). */
  plateHuge: { boxes: [flat(2, 4)], spins: 2 },
  /** A large plate half as wide: 1 x 2 (8 studs). */
  plateLargeHalf: { boxes: [flat(1, 2)], spins: 2 },
  /** Two plates at a right angle (8 studs). */
  bracket: { boxes: bracket(1), spins: 4 },
  /** The same L, half as wide (4 studs). */
  bracketSmall: { boxes: bracket(0.5), spins: 4 },
  /** The bracket twice as long: a 1 x 2 flat plate and a wall 1 wide and 2 tall (16 studs). */
  bracketLong: { boxes: bracket(1, 2 * CELL_SIZE), spins: 4 },
  /** Twice the bracket in both ways: a 2 x 2 flat plate and a wall 2 wide and 2 tall (32 studs). */
  bracketLarge: { boxes: bracket(2, 2 * CELL_SIZE), spins: 4 },
};

/** Volume of a structural part relative to a block (what makes a plate light at the same weight setting). */
export const partVolume = (part: { type: StructuralType }): number =>
  SHAPES[part.type].boxes.reduce((sum, box) => sum + box.size[0] * box.size[1] * box.size[2], 0);

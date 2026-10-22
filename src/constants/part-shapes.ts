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
  /**
   * A wedge: a triangular prism instead of a box. Its slope rises towards -z (in its own frame, studs up) from the front edge (+z, at the
   * bottom) to the back edge (-z, the full height), so it is half the volume of the box. It has no studs on top (the slope is not a flat
   * face) but its underside has sockets, like any box: parts below it hold it, nothing is built on it.
   */
  wedge?: true;
  /**
   * A flat swept shape instead of a box: a convex outline (x, z, in cells, relative to the centre of the box) extruded over the box's height.
   * Like a wedge it has no studs on top (`wedge` is set with it): only sockets underneath, and its bounding box is what it occupies.
   */
  polygon?: ReadonlyArray<readonly [number, number]>;
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
 * A swept wing, a thin flat plate `span` wide (x) and `depth` deep (z), the thin edge that leads being +z: the root edge, on the body side
 * (`root`: -1 is the -x side, a wing on the left of a plane that flies towards +z), is `rootChord` of the depth long and starts at the front;
 * the tip, on the other side, is `tipChord` long and at the very back, so both the leading and the trailing edge sweep back towards the
 * tip (a plan view like an airliner's wing). Turned over (a half turn about the front, +z) it is the mirror image: a wing is a flat plate, the same on both faces, with sockets on both, so the same part serves both sides of a plane.
 */
const swept = (span: number, depth: number, root: 1 | -1): ReadonlyArray<ShapeBox> => {
  const rootChord = 0.55 * depth;
  const tipChord = 0.29 * depth;
  const x = (span / 2) * root;
  return [
    {
      size: [span, PLATE.thickness, depth],
      offset: [0, 0, 0],
      studs: [0, 1, 0],
      wedge: true,
      polygon: [[x, depth / 2], [x, depth / 2 - rootChord], [-x, -depth / 2], [-x, -depth / 2 + tipChord]],
    },
  ];
};
const wedge = (width: number, height: number, depth: number): ShapeBox => ({ ...solid(width, height, depth), wedge: true });

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

/** The heights (cells) of the low blocks (three plates) and the tall ones (two blocks), besides the full block. */
export const BLOCK_HEIGHT = { low: 3 * PLATE.thickness, tall: 2 * CELL_SIZE } as const;

export const SHAPES: Record<StructuralType, Shape> = {
  block: { boxes: [solid(1, 1, 1)], spins: 1 },
  /** The smallest block: a 0.5 x 0.5 footprint, full height (1 stud). */
  blockQuarter: { boxes: [solid(0.5, 1, 0.5)], spins: 1 },
  /** A single-stud connector, low (3 plates tall). */
  blockLowQuarter: { boxes: [solid(0.5, BLOCK_HEIGHT.low, 0.5)], spins: 1 },
  /** A single-stud pillar, two blocks tall. */
  blockTallQuarter: { boxes: [solid(0.5, BLOCK_HEIGHT.tall, 0.5)], spins: 1 },
  /** Half a block: 1 x 1 footprint cut in two (2 studs). */
  blockHalf: { boxes: [solid(0.5, 1, 1)], spins: 2 },
  /** A long thin beam: 0.5 x 2 footprint, full height (4 studs in a row). */
  blockLong: { boxes: [solid(0.5, 1, 2)], spins: 2 },
  /** The block, low: 3 plates tall (4 studs). */
  blockLow: { boxes: [solid(1, BLOCK_HEIGHT.low, 1)], spins: 1 },
  /** The block, tall: two blocks high (4 studs). */
  blockTall: { boxes: [solid(1, BLOCK_HEIGHT.tall, 1)], spins: 1 },
  /** The 2 x 4 beam, low (8 studs). */
  blockBeamLow: { boxes: [solid(1, BLOCK_HEIGHT.low, 2)], spins: 2 },
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
  /** A 45 degree slope: 1 x 1 footprint, 1 tall, rising towards the back. */
  slope: { boxes: [wedge(1, 1, 1)], spins: 4 },
  /** The slope half as wide (0.5 x 1). */
  slopeHalf: { boxes: [wedge(0.5, 1, 1)], spins: 4 },
  /** A gentle slope: 1 x 2 footprint, 1 tall (about 27 degrees). */
  slopeLong: { boxes: [wedge(1, 1, 2)], spins: 4 },
  /** A thin wedge, a plate thick at the back and tapering to nothing: a wing or a fairing (1 x 1). */
  slopePlate: { boxes: [wedge(1, PLATE.thickness, 1)], spins: 4 },
  /** The same, 1 x 2 (a longer, gentler taper). */
  slopePlateLong: { boxes: [wedge(1, PLATE.thickness, 2)], spins: 4 },
  /** A swept wing, 2 x 1.5: the root at -x (the left wing of a plane that flies towards +z), the tip at +x. Flat and the same on both faces, so turned over it is its own mirror image (the wing of the other side). No studs on top. */
  wing: { boxes: swept(2, 1.5, -1), spins: 4 },
  /** The big wing: 4 x 3. */
  wingLarge: { boxes: swept(4, 3, -1), spins: 4 },
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
  SHAPES[part.type].boxes.reduce((sum, box) => sum + (box.polygon ? polygonArea(box.polygon) * box.size[1] : (box.size[0] * box.size[1] * box.size[2]) / (box.wedge ? 2 : 1)), 0);

/** The area (square cells) of a convex outline (`ShapeBox.polygon`). */
export const polygonArea = (polygon: ReadonlyArray<readonly [number, number]>): number =>
  Math.abs(polygon.reduce((sum, [x, z], i) => sum + x * polygon[(i + 1) % polygon.length][1] - polygon[(i + 1) % polygon.length][0] * z, 0)) / 2;

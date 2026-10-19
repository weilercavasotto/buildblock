import { Grid } from '../build/grid';
import { CELL_SIZE, PAINT_COLORS, PISTON_BODY, PLATE, RANDOM_BUILD, ROTOR_BODY } from '../constants';
import { Part, Vec3 } from '../types';

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const chance = (probability: number): boolean => Math.random() < probability;

/** The kinds of vehicle the main menu shows (see `RANDOM_BUILD.archetypes`). */
export type Archetype = 'coupe' | 'pickup' | 'propeller' | 'rocket';

/** The colours of a build: the body, an accent and a third colour for the small details. */
interface Palette {
  body: string;
  accent: string;
  detail: string;
}

/** Three different colours of the paint palette (not the default blue, so every car looks painted). */
function randomPalette(): Palette {
  const colours = PAINT_COLORS.slice(1).map((c) => c.hex);
  const body = pick(colours);
  const accent = pick(colours.filter((c) => c !== body));
  const detail = pick(colours.filter((c) => c !== body && c !== accent));
  return { body, accent, detail };
}

/** What a build is made of, for the menu to know what to drive (rotors, pistons, thrusters, turbos). */
export interface RandomBuild {
  grid: Grid;
  archetype: Archetype;
}

/**
 * A random vehicle for the main menu: one of several kinds (a coupe with a sloping hood, a pickup with a lifting bed, a buggy with a
 * propeller, a rocket car), painted with a random palette. All are built the same way: a base of blocks on the ground tied together by
 * two layers of plates (blocks side by side are not welded, only studs weld: the first layer of plates spans neighbouring columns, the
 * second, offset by half a cell, spans the rows), X axles of wheels and an engine pushing towards -z, then the parts of the kind.
 * A part that does not fit is simply left out (`add` ignores it), so a build is always valid.
 */
export function generateRandomBuild(): RandomBuild {
  const archetype = pick(RANDOM_BUILD.archetypes);
  const palette = randomPalette();
  const grid = new Grid();
  const add = (part: Part): boolean => grid.add(part);
  const width = archetype === 'propeller' ? 2 : pick(RANDOM_BUILD.widths);
  const length = archetype === 'pickup' ? pick(RANDOM_BUILD.pickupLengths) : archetype === 'propeller' ? pick(RANDOM_BUILD.propellerLengths) : pick(RANDOM_BUILD.lengths);
  const baseTop = CELL_SIZE / 2;
  const deckTop = baseTop + PLATE.thickness * 2;
  const onDeck = CELL_SIZE / 2 + deckTop; // the height of the centre of a block on the deck

  // The base: blocks, and two layers of plates that weld them.
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < length; z++) add({ type: 'block', cell: [x, 0, z], color: palette.body });
  }
  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < length; z++) add({ type: 'plate', cell: [x + 0.5, baseTop + PLATE.thickness / 2, z], color: palette.accent });
  }
  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < length - 1; z++) add({ type: 'plate', cell: [x + 0.5, baseTop + PLATE.thickness * 1.5, z + 0.5], color: palette.accent });
  }

  const axles = new Set([0, length - 1]);
  if (length >= 4 && chance(RANDOM_BUILD.middleAxleChance)) axles.add(Math.floor(length / 2));
  for (const z of axles) {
    add({ type: 'wheel', cell: [-1, 0, z], face: [-1, 0, 0] });
    add({ type: 'wheel', cell: [width, 0, z], face: [1, 0, 0] });
  }
  // An engine on the side of a base block that carries no wheel, pushing the way the car drives (this build needs an engine to move).
  const host = [...Array(length).keys()].find((z) => z > 0 && !axles.has(z));
  if (host !== undefined) {
    add({ type: 'engine', cell: [-1, 0, host], face: [-1, 0, 0], spin: 2 }); // its front (local +z) turned to -z
    grid.engineDrive = true;
  }

  const across = [...Array(width).keys()];
  /** A row of `type` across the car at row `z`, `y` above the ground. */
  const row = (type: Part['type'], z: number, y: number, color: string, extra: Partial<Part> = {}) => across.forEach((x) => add({ type, cell: [x, y, z], color, ...extra } as Part));
  /** The roof: a plate on every block of the cabin row `z` (its top is at `top`). */
  const roof = (z: number, top: number, color: string) => across.forEach((x) => add({ type: 'plate', cell: [x, top + PLATE.thickness / 2, z], color }));

  if (archetype === 'coupe') coupe(grid, { palette, width, length, onDeck, row, roof });
  else if (archetype === 'pickup') pickup(grid, { palette, width, length, onDeck, deckTop, row, roof });
  else if (archetype === 'propeller') propeller(grid, { palette, width, length, deckTop, onDeck });
  else rocket(grid, { palette, width, length, deckTop, onDeck, row });
  return { grid, archetype };
}

interface Kit {
  palette: Palette;
  width: number;
  length: number;
  onDeck: number;
}
type RowBuilder = (type: Part['type'], z: number, y: number, color: string, extra?: Partial<Part>) => void;
type RoofBuilder = (z: number, top: number, color: string) => void;

/** A coupe: a sloping hood, a cabin with a roof (maybe a spoiler or a light bar on it) and a sloping tail. */
function coupe(grid: Grid, { palette, width, length, onDeck, row, roof }: Kit & { row: RowBuilder; roof: RoofBuilder }): void {
  const add = (part: Part) => grid.add(part);
  const hood = chance(RANDOM_BUILD.hoodChance);
  if (hood) row('slope', 0, onDeck, palette.body, { spin: 2 }); // its tall edge (the back of a slope) towards the cabin
  if (!chance(RANDOM_BUILD.cabinChance)) return;
  const from = 1;
  const to = length - 1 - (chance(RANDOM_BUILD.cabinShortChance) ? 1 : 0);
  if (to <= from) return; // no room for a cabin
  for (let z = from; z < to; z++) row('block', z, onDeck, palette.accent);
  const roofTop = onDeck + CELL_SIZE / 2;
  for (let z = from; z < to; z++) roof(z, roofTop, palette.body);
  // The tail slopes down behind the cabin, when there is room.
  if (to <= length - 1 && chance(RANDOM_BUILD.tailChance)) row('slope', to, onDeck, palette.body);
  const roofLevel = roofTop + PLATE.thickness;
  const decoration = pick(['spoiler', 'bar', 'block', 'none'] as const);
  if (decoration === 'spoiler') row('slope', to - 1, roofLevel + CELL_SIZE / 2, palette.detail);
  else if (decoration === 'bar') add({ type: 'plateHalf', cell: [(width - 1) / 2, roofLevel + PLATE.thickness / 2, from + 0.25], color: palette.detail, spin: 1 });
  else if (decoration === 'block') add({ type: 'block', cell: [Math.floor(width / 2), roofLevel + CELL_SIZE / 2, from], color: palette.detail });
}

/** A pickup: a cabin at the front and an open bed behind it, with low walls or a platform that a piston lifts with its cargo. */
function pickup(grid: Grid, { palette, width, length, onDeck, deckTop, row, roof }: Kit & { deckTop: number; row: RowBuilder; roof: RoofBuilder }): void {
  const add = (part: Part) => grid.add(part);
  if (chance(RANDOM_BUILD.hoodChance)) row('slope', 0, onDeck, palette.body, { spin: 2 });
  row('block', 1, onDeck, palette.accent);
  roof(1, onDeck + CELL_SIZE / 2, palette.body);
  const bed = [...Array(length - 2).keys()].map((i) => i + 2);
  const lift = chance(RANDOM_BUILD.liftChance);
  const wallHeight = CELL_SIZE * 0.3 + deckTop; // the centre of a low block on the deck (0.6 tall)
  if (lift) {
    // A block with a piston on it, a platform on its head and some cargo; the tailgate is a row of low blocks (the platform passes over it).
    const x = Math.floor((width - 1) / 2);
    const z = bed[0];
    add({ type: 'block', cell: [x, onDeck, z], color: palette.detail });
    const pistonY = onDeck + CELL_SIZE;
    add({ type: 'piston', cell: [x, pistonY, z], face: [0, 1, 0], color: palette.detail });
    const head = onDeck + CELL_SIZE / 2 + PISTON_BODY.depth; // the top of the folded piston: its base and head
    add({ type: 'plateLargeHalf', cell: [x, head + PLATE.thickness / 2, z + 0.5], color: palette.accent });
    const cargo = pick(['block', 'blockLow'] as const);
    add({ type: cargo, cell: [x, head + PLATE.thickness + (cargo === 'blockLow' ? 0.3 : 0.5), z + 0.5], color: palette.body });
    row('blockLow', length - 1, wallHeight, palette.accent);
  } else {
    // Low walls round the bed, and some cargo in the middle when there is a free column.
    for (const z of bed.slice(0, -1)) {
      add({ type: 'blockLow', cell: [0, wallHeight, z], color: palette.accent });
      add({ type: 'blockLow', cell: [width - 1, wallHeight, z], color: palette.accent });
    }
    row('blockLow', length - 1, wallHeight, palette.accent);
    if (width === 3 && chance(0.7)) {
      const cargo = pick(['block', 'blockLow'] as const);
      add({ type: cargo, cell: [1, cargo === 'block' ? onDeck : deckTop + 0.3, bed[0]], color: palette.detail });
    }
  }
}

/** A buggy with a propeller on a post: two crossed strips on a rotor, spinning all the time in the menu. */
function propeller(grid: Grid, { palette, width, length, deckTop, onDeck }: Kit & { deckTop: number }): void {
  const add = (part: Part) => grid.add(part);
  const x = Math.floor((width - 1) / 2);
  const z = 1;
  // A seat block and a post of the car's colours, then the rotor, and the blades a strip thick on its head (two, crossed).
  add({ type: 'block', cell: [x, onDeck, z], color: palette.accent });
  const mount: Vec3 = [x, onDeck + CELL_SIZE, z];
  add({ type: 'rotor', cell: mount, face: [0, 1, 0], color: palette.detail, speed: pick(RANDOM_BUILD.rotorSpeeds) });
  const head = deckTop + CELL_SIZE + ROTOR_BODY.depth; // the top of the rotor, on the seat block
  add({ type: 'plateLong', cell: [x, head + PLATE.thickness / 2, z], color: palette.body });
  add({ type: 'plateLong', cell: [x, head + PLATE.thickness * 1.5, z], color: palette.body, spin: 1 });
  if (chance(0.6)) add({ type: 'blockLow', cell: [x, deckTop + 0.3, length - 1], color: palette.detail });
}

/** A rocket car: thrusters on its tail, turbos on the roof and a fin; the menu fires them in bursts. */
function rocket(grid: Grid, { palette, width, length, deckTop, onDeck, row }: Kit & { deckTop: number; row: RowBuilder }): void {
  const add = (part: Part) => grid.add(part);
  if (chance(RANDOM_BUILD.hoodChance)) row('slope', 0, onDeck, palette.body, { spin: 2 });
  for (const x of width > 1 ? [0, width - 1] : [0]) add({ type: 'thruster', cell: [x, 0, length], face: [0, 0, 1], spin: 2, color: palette.detail });
  const to = length - 1;
  for (let z = 1; z < to; z++) row('block', z, onDeck, palette.accent);
  const roofTop = onDeck + CELL_SIZE / 2;
  const turbos = chance(0.8) ? [1] : [];
  for (const z of turbos) add({ type: 'turbo', cell: [Math.floor((width - 1) / 2), roofTop + CELL_SIZE / 2, z], face: [0, 1, 0], color: palette.detail });
  // A fin on the tail: a tall thin block on the last deck row.
  if (chance(0.7)) add({ type: 'blockTallQuarter', cell: [(width - 1) / 2 + 0.25, deckTop + CELL_SIZE, length - 1], color: palette.body });
}

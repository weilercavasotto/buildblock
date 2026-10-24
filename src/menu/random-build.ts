import { Grid } from '../build/grid';
import { CELL_SIZE, PAINT_COLORS, PISTON_BODY, PLATE, RANDOM_BUILD, ROTOR_BODY } from '../constants';
import { Part, Vec3, frontOf, matrixOf } from '../types';

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const chance = (probability: number): boolean => Math.random() < probability;

/** The kinds of vehicle the main menu shows (see `RANDOM_BUILD.archetypes`). */
export type Archetype = 'coupe' | 'pickup' | 'propeller' | 'rocket' | 'sled' | 'windmill' | 'lighthouse' | 'rocketship' | 'plane';

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

/** The orientation fields (`studs`, `spin`) that make a part's front (local +z) point along `direction`; none when it is the default one. */
function facing(type: Part['type'], direction: Vec3, studs?: Vec3): Pick<Part, 'studs' | 'spin'> {
  const ups: Vec3[] = studs ? [studs] : [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const studs of ups) {
    for (const spin of [0, 1, 2, 3]) {
      if (frontOf({ studs, spin }).every((v, i) => Math.round(v) === direction[i])) return { studs, spin } as Pick<Part, 'studs' | 'spin'>;
    }
  }
  return {} as Pick<Part, 'studs' | 'spin'>;
}

/** The orientation fields that turn a part's local x and z (either or both) onto the given world directions. */
function orient(x: Vec3 | null, z: Vec3 | null): Pick<Part, 'studs' | 'spin'> {
  const ups: Vec3[] = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const studs of ups) {
    for (const spin of [0, 1, 2, 3]) {
      const m = matrixOf({ studs, spin });
      const same = (a: readonly number[], b: Vec3 | null) => b === null || a.every((v, i) => Math.round(v) === b[i]);
      if (same(m[0], x) && same(m[2], z)) return { studs, spin } as Pick<Part, 'studs' | 'spin'>;
    }
  }
  return {} as Pick<Part, 'studs' | 'spin'>;
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
  if (archetype === 'windmill' || archetype === 'lighthouse' || archetype === 'rocketship') {
    // Not vehicles: builds that stand still while their rotors turn, their lamps shine and their thrusters fire.
    if (archetype === 'windmill') windmill(grid, palette);
    else if (archetype === 'lighthouse') lighthouse(grid, palette);
    else rocketship(grid, palette);
    return { grid, archetype };
  }
  if (archetype === 'plane') {
    plane(grid, palette);
    return { grid, archetype };
  }
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

  if (archetype === 'sled') {
    // No wheels: a ski at each end of both sides, and thrusters on the tail that fire in bursts (a ski steers with the autopilot's steering).
    for (const z of new Set([0, length - 1])) {
      add({ type: 'ski', cell: [-1, 0, z], face: [-1, 0, 0] });
      add({ type: 'ski', cell: [width, 0, z], face: [1, 0, 0] });
    }
    for (const x of width > 1 ? [0, width - 1] : [0]) add({ type: 'thruster', cell: [x, 0, length], face: [0, 0, 1], spin: 2, color: palette.detail });
  } else {
    const axles = new Set([0, length - 1]);
    if (length >= 5 && chance(RANDOM_BUILD.middleAxleChance)) axles.add(Math.floor(length / 2));
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
  }

  // Headlights on the nose (the front of a lamp points the way the car drives, towards -z), at ground level where the hood does not cover them.
  if (chance(RANDOM_BUILD.lampChance)) {
    for (const x of width > 1 ? [0, width - 1] : [0]) add({ type: 'lamp', cell: [x, 0, -1], face: [0, 0, -1], color: palette.detail, ...facing('lamp', [0, 0, -1]) });
  }

  const across = [...Array(width).keys()];
  /** A row of `type` across the car at row `z`, `y` above the ground. */
  const row = (type: Part['type'], z: number, y: number, color: string | undefined, extra: Partial<Part> = {}) => across.forEach((x) => add({ type, cell: [x, y, z], ...(color ? { color } : {}), ...extra } as Part));
  /** The roof: a plate (or a pane of glass, or a smooth tile) on every block of the cabin row `z` (its top is at `top`); glass keeps its own tint. */
  const roof = (z: number, top: number, color: string, type: 'plate' | 'glass' | 'tile' = 'plate') => across.forEach((x) => add({ type, cell: [x, top + PLATE.thickness / 2, z], ...(type === 'glass' ? {} : { color }) }));

  if (archetype === 'coupe' || archetype === 'sled') coupe(grid, { palette, width, length, onDeck, row, roof });
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
type RowBuilder = (type: Part['type'], z: number, y: number, color: string | undefined, extra?: Partial<Part>) => void;
type RoofBuilder = (z: number, top: number, color: string, type?: 'plate' | 'glass' | 'tile') => void;

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
  const decoration = chance(RANDOM_BUILD.sirenChance) ? 'siren' : pick(['spoiler', 'bar', 'block', 'none'] as const);
  // A smooth tile roof only when nothing is built on it (a tile has no studs); otherwise a plate, or a pane of glass.
  const roofType = decoration === 'none' && chance(RANDOM_BUILD.tileRoofChance) ? 'tile' : chance(RANDOM_BUILD.glassRoofChance) ? 'glass' : 'plate';
  for (let z = from; z < to; z++) roof(z, roofTop, palette.body, roofType);
  // The tail slopes down behind the cabin, when there is room: painted, or a glass rear window.
  if (to <= length - 1 && chance(RANDOM_BUILD.tailChance)) {
    const glass = chance(RANDOM_BUILD.glassTailChance);
    row(glass ? 'windscreen' : 'slope', to, onDeck, glass ? undefined : palette.body);
  }
  const roofLevel = roofTop + PLATE.thickness;
  if (decoration === 'siren') {
    // A block on the roof with a siren on its top, its dome pointing up.
    const x = Math.floor(width / 2);
    add({ type: 'block', cell: [x, roofLevel + CELL_SIZE / 2, from], color: palette.detail });
    add({ type: 'siren', cell: [x, roofLevel + CELL_SIZE * 1.5, from], face: [0, 1, 0], color: palette.accent, ...facing('siren', [0, 1, 0]) });
  } else if (decoration === 'spoiler') row('slope', to - 1, roofLevel + CELL_SIZE / 2, palette.detail);
  else if (decoration === 'bar') add({ type: 'plateHalf', cell: [(width - 1) / 2, roofLevel + PLATE.thickness / 2, from + 0.25], color: palette.detail, spin: 1 });
  else if (decoration === 'block') add({ type: 'block', cell: [Math.floor(width / 2), roofLevel + CELL_SIZE / 2, from], color: palette.detail });
}

/** The cargo of a pickup: a block, a low block or, now and then, a barrel (a round brick). */
const pickCargo = (): 'block' | 'blockLow' | 'roundBrick' => (chance(RANDOM_BUILD.barrelChance) ? 'roundBrick' : pick(['block', 'blockLow'] as const));

/** A pickup: a cabin at the front and an open bed behind it, with low walls or a platform that a piston lifts with its cargo. */
function pickup(grid: Grid, { palette, width, length, onDeck, deckTop, row, roof }: Kit & { deckTop: number; row: RowBuilder; roof: RoofBuilder }): void {
  const add = (part: Part) => grid.add(part);
  if (chance(RANDOM_BUILD.hoodChance)) row('slope', 0, onDeck, palette.body, { spin: 2 });
  row('block', 1, onDeck, palette.accent);
  roof(1, onDeck + CELL_SIZE / 2, palette.body, chance(RANDOM_BUILD.glassRoofChance) ? 'glass' : 'plate');
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
    const cargo = pickCargo();
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
      const cargo = pickCargo();
      add({ type: cargo, cell: [1, cargo === 'blockLow' ? deckTop + 0.3 : onDeck, bed[0]], color: palette.detail });
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

/** A windmill: a wide base and a tower of blocks with a rotor on the front of its top block and two crossed blades on its head, turning slowly in the menu. */
function windmill(grid: Grid, palette: Palette): void {
  const add = (part: Part) => grid.add(part);
  const height = pick(RANDOM_BUILD.windmillHeights);
  add({ type: 'blockLarge', cell: [0, 0, 0], color: palette.body });
  for (let y = 1; y <= height; y++) add({ type: 'block', cell: [0, y, 0], color: palette.accent });
  const front = CELL_SIZE / 2 + ROTOR_BODY.depth; // the plane of the rotor head, in front of the top block
  add({ type: 'rotor', cell: [0, height, 1], face: [0, 0, 1], studs: [0, 0, 1], speed: pick(RANDOM_BUILD.slowRotorSpeeds), color: palette.detail });
  add({ type: 'plateLong', cell: [0, height, front + PLATE.thickness / 2], studs: [0, 0, 1], spin: 0, color: palette.body });
  add({ type: 'plateLong', cell: [0, height, front + PLATE.thickness * 1.5], studs: [0, 0, 1], spin: 1, color: palette.body });
}

/** A lighthouse: round bricks in stripes on a round base, a block on top with a rotor, and on its head a block with a lamp on each side, so the beams sweep round. */
function lighthouse(grid: Grid, palette: Palette): void {
  const add = (part: Part) => grid.add(part);
  const height = pick(RANDOM_BUILD.lighthouseHeights);
  add({ type: 'roundBrickLarge', cell: [0, 0, 0], color: palette.body });
  for (let y = 1; y <= height; y++) add({ type: 'roundBrick', cell: [0, y, 0], color: y % 2 === 0 ? palette.body : palette.accent });
  const top = height + 1;
  add({ type: 'block', cell: [0, top, 0], color: palette.detail });
  add({ type: 'rotor', cell: [0, top + 1, 0], face: [0, 1, 0], studs: [0, 1, 0], speed: pick(RANDOM_BUILD.slowRotorSpeeds), color: palette.accent });
  const lampY = top + CELL_SIZE / 2 + ROTOR_BODY.depth + CELL_SIZE / 2; // the block on the rotor head
  add({ type: 'block', cell: [0, lampY, 0], color: palette.detail });
  for (const x of [1, -1]) add({ type: 'lamp', cell: [x, lampY, 0], face: [x, 0, 0], color: palette.accent, ...facing('lamp', [x, 0, 0]) });
}

/** A rocketship: a large block with pinwheel fins and four thrusters on its sides pushing up, a body of round bricks and a capped nose; the thrusters fire in bursts and it hops. */
function rocketship(grid: Grid, palette: Palette): void {
  const add = (part: Part) => grid.add(part);
  const height = pick(RANDOM_BUILD.rocketshipHeights);
  add({ type: 'blockLarge', cell: [0, 0, 0], color: palette.body }); // a square block: the thrusters need a block to be mounted on
  // Four fins on the rim of the base, each with its tall edge towards the body (half a cell wide, a cell out), in a pinwheel.
  const fins: Array<[Vec3, Vec3]> = [[[1, 1, 0.25], [1, 0, 0]], [[-1, 1, -0.25], [-1, 0, 0]], [[0.25, 1, 1], [0, 0, 1]], [[-0.25, 1, -1], [0, 0, -1]]];
  for (const [cell, out] of fins) add({ type: 'slopeHalf', cell, color: palette.detail, ...facing('slopeHalf', out, [0, 1, 0]) });
  for (let y = 1; y <= height; y++) add({ type: 'roundBrick', cell: [0, y, 0], color: y % 2 === 1 ? palette.accent : palette.body });
  const capY = height + CELL_SIZE / 2 + PLATE.thickness / 2;
  add({ type: 'roundPlate', cell: [0, capY, 0], color: palette.detail });
  add({ type: 'blockQuarter', cell: [0.25, capY + PLATE.thickness / 2 + CELL_SIZE / 2, 0.25], color: palette.detail });
  // The thrusters stand against the sides of the base with their fronts pointing up (a thruster pushes its body along its front, and its bell is at the back, at the bottom), so they push the rocket up.
  for (const [x, face] of [[1.5, 1], [-1.5, -1]] as const) {
    for (const z of [-0.5, 0.5]) add({ type: 'thruster', cell: [x, 0, z], face: [face, 0, 0], power: RANDOM_BUILD.rocketshipPower, color: palette.accent, ...facing('thruster', [0, 1, 0]) });
  }
}

/**
 * A plane: a fuselage two blocks high tied by plates, wheels on both sides at the nose and the tail, swept wings and a small tailplane (on a
 * block at the tail) held against its sides, a fin, and a propeller on its nose pulling it along the ground and, once it is fast enough,
 * into the air. It points towards +z (the cars point towards -z, where the big ramp of the scenery stands: a plane cannot steer away from it).
 */
function plane(grid: Grid, palette: Palette): void {
  const add = (part: Part) => grid.add(part);
  const length = 4;
  const lower = 0;
  const tie = CELL_SIZE / 2 + PLATE.thickness / 2; // the plates between the two layers of blocks
  const upper = CELL_SIZE / 2 + PLATE.thickness + CELL_SIZE / 2; // the centre of the upper blocks
  for (let z = 0; z < length; z++) add({ type: 'block', cell: [0, lower, z], color: palette.body });
  for (let z = 0; z < length - 1; z++) add({ type: 'plate', cell: [0, tie, z + 0.5], color: palette.accent });
  for (let z = 0; z < length; z++) add({ type: 'block', cell: [0, upper, z], color: palette.body });
  // Free-rolling wheels (an engine would be needed to drive them: the propeller does that).
  grid.engineDrive = true;
  for (const z of [0, length - 1]) {
    add({ type: 'wheel', cell: [-1, lower, z], face: [-1, 0, 0] });
    add({ type: 'wheel', cell: [1, lower, z], face: [1, 0, 0] });
  }
  // The wings: the root (the long straight edge) against the side of the fuselage, the leading edge towards +z (the nose).
  const wing = (type: 'wingLarge' | 'wing', side: 1 | -1, span: number, y: number, zCentre: number) =>
    add({ type, cell: [side * (0.5 + span / 2), y, zCentre], color: palette.accent, ...orient([side, 0, 0], [0, 0, 1]) });
  wing('wing', 1, 2, upper, 1.5);
  wing('wing', -1, 2, upper, 1.5);
  // A block on the tail with the small wings (the tailplane) at its height, above the big wings, and a fin on its top.
  const tail = upper + CELL_SIZE;
  add({ type: 'block', cell: [0, tail, 0], color: palette.body });
  wing('wing', 1, 2, tail, 0);
  wing('wing', -1, 2, tail, 0);
  add({ type: 'blockTallQuarter', cell: [0.25, tail + CELL_SIZE / 2 + CELL_SIZE, 0], color: palette.detail });
  add({ type: 'propeller', cell: [0, upper, length], face: [0, 0, 1], power: RANDOM_BUILD.planePower, color: palette.detail, ...facing('propeller', [0, 0, 1]) });
  add({ type: 'lamp', cell: [0, lower, length], face: [0, 0, 1], color: palette.detail, ...facing('lamp', [0, 0, 1]) });
}

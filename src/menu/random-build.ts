import { Grid } from '../build/grid';
import { CELL_SIZE, PLATE, RANDOM_BUILD } from '../constants';

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * Random small car: a base of blocks on the ground tied together by two layers of plates (blocks side by side are not
 * welded, only studs weld: the first layer of plates spans neighbouring columns, the second, offset by half a cell, spans
 * the rows), an optional cabin on top, a few extra blocks and 2-3 axles of wheels.
 */
export function generateRandomBuild(): Grid {
  const grid = new Grid();
  const width = pick(RANDOM_BUILD.widths);
  const length = pick(RANDOM_BUILD.lengths);
  const baseTop = CELL_SIZE / 2;

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < length; z++) grid.add({ type: 'block', cell: [x, 0, z] });
  }
  // Plates: first layer half a cell off in x (joins the columns), second half a cell off in x and z (joins the rows).
  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < length; z++) grid.add({ type: 'plate', cell: [x + 0.5, baseTop + PLATE.thickness / 2, z] });
  }
  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < length - 1; z++) grid.add({ type: 'plate', cell: [x + 0.5, baseTop + PLATE.thickness * 1.5, z + 0.5] });
  }
  const deckTop = baseTop + PLATE.thickness * 2;

  if (Math.random() < RANDOM_BUILD.cabinChance) {
    const from = 1;
    const to = length - 1 - (Math.random() < RANDOM_BUILD.cabinShortChance ? 1 : 0);
    for (let x = 0; x < width; x++) {
      for (let z = from; z < to; z++) grid.add({ type: 'block', cell: [x, deckTop + CELL_SIZE / 2, z] });
    }
    if (Math.random() < RANDOM_BUILD.roofBlockChance) grid.add({ type: 'block', cell: [Math.floor(width / 2), deckTop + CELL_SIZE * 1.5, from] });
  }

  const axles = new Set([0, length - 1]);
  if (length >= 4 && Math.random() < RANDOM_BUILD.middleAxleChance) axles.add(Math.floor(length / 2));
  for (const z of axles) {
    grid.add({ type: 'wheel', cell: [-1, 0, z], face: [-1, 0, 0] });
    grid.add({ type: 'wheel', cell: [width, 0, z], face: [1, 0, 0] });
  }
  return grid;
}

import { Grid } from '../build/grid';
import { RANDOM_BUILD } from '../constants';

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Random small car: a block base, an optional cabin, a few extra blocks and 2-3 axles of wheels. */
export function generateRandomBuild(): Grid {
  const grid = new Grid();
  const width = pick(RANDOM_BUILD.widths);
  const length = pick(RANDOM_BUILD.lengths);

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < length; z++) grid.add({ type: 'block', cell: [x, 0, z] });
  }

  if (Math.random() < RANDOM_BUILD.cabinChance) {
    const from = 1;
    const to = length - 1 - (Math.random() < RANDOM_BUILD.cabinShortChance ? 1 : 0);
    for (let x = 0; x < width; x++) {
      for (let z = from; z < to; z++) grid.add({ type: 'block', cell: [x, 1, z] });
    }
    if (Math.random() < RANDOM_BUILD.roofBlockChance) grid.add({ type: 'block', cell: [Math.floor(width / 2), 2, from] });
  }

  const axles = new Set([0, length - 1]);
  if (length >= 4 && Math.random() < RANDOM_BUILD.middleAxleChance) axles.add(Math.floor(length / 2));
  for (const z of axles) {
    grid.add({ type: 'wheel', cell: [-1, 0, z], face: [-1, 0, 0] });
    grid.add({ type: 'wheel', cell: [width, 0, z], face: [1, 0, 0] });
  }
  return grid;
}

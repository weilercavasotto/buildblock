import { COLORS } from './colors';
import { Part } from '../types';

/**
 * The ramps and obstacles of the floor, in the main menu only (Play has none), built from the parts of the catalog (fixed in place: see
 * `PhysicsWorld.buildScenery`). Cells are world positions (a part's `cell` is its centre, the ground top is y = -0.5). They are far from
 * the origin, where the player builds and the menu car starts.
 */
const across = (from: number, to: number, step = 1): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const each = (xs: number[], make: (x: number) => Part): Part[] => xs.map(make);

/** A two-storey ramp (brown): a gentle slope, a block beam and a second slope on the beam, 5 wide, climbing towards -z. */
const bigRamp: Part[] = [
  ...each(across(-2, 2), (x) => ({ type: 'slopeLong', cell: [x, 0, -16], color: COLORS.scene.rampBrown })),
  ...each(across(-2, 2), (x) => ({ type: 'blockBeam', cell: [x, 0, -18], color: COLORS.scene.rampBrown })),
  ...each(across(-2, 2), (x) => ({ type: 'slopeLong', cell: [x, 1, -18], color: COLORS.scene.rampBrown })),
];

/** A kicker with a table top (green): a gentle slope up to a flat beam, 3 wide. */
const kicker: Part[] = [
  ...each(across(13, 15), (x) => ({ type: 'slopeLong', cell: [x, 0, -8], color: COLORS.scene.rampGreen })),
  ...each(across(13, 15), (x) => ({ type: 'blockBeam', cell: [x, 0, -10], color: COLORS.scene.rampGreen })),
];

/** A low wall of beams to jump over, and a row of tall pillars to weave between (blue). */
const obstacles: Part[] = [
  ...each(across(-15, -5, 2), (x) => ({ type: 'blockBeam', cell: [x, 0, -6], spin: 1, color: COLORS.scene.obstacleBlue })),
  ...each(across(-15, -6, 3), (x) => ({ type: 'blockTall', cell: [x, 0.5, -9], color: COLORS.scene.obstacleBlue })),
];

/** A row of whoops (orange): two steep slopes back to back make a ridge a block tall. */
const bumps: Part[] = [
  ...each(across(5, 9), (x) => ({ type: 'slope', cell: [x, 0, 10], color: COLORS.scene.rampBump })),
  ...each(across(5, 9), (x) => ({ type: 'slope', cell: [x, 0, 9], spin: 2, color: COLORS.scene.rampBump })),
];

export const SCENERY_PARTS: ReadonlyArray<Part> = [...bigRamp, ...kicker, ...obstacles, ...bumps];

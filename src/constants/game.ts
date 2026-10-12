import { Vec3 } from '../types';

/** Edge length of a grid cell in world units. */
export const CELL_SIZE = 1;

/** Y of the ground's top surface: cells with `y = 0` sit exactly on it. */
export const GROUND_Y = -CELL_SIZE / 2;

/** A block's mesh fills its whole cell, like its collider, so neighbouring blocks touch without a gap. */
export const BLOCK_VISUAL_SIZE = CELL_SIZE;

/** The dark outline of a block is drawn this much larger than the cube, so it sits just outside the faces (no z-fighting). */
export const BLOCK_EDGE_SCALE = 1.004;

/** The placement ghost is a bit smaller than the cell so it does not z-fight with the faces of neighbouring blocks. */
export const GHOST_BLOCK_SCALE = 0.985;

export const CAMERA = {
  fov: 55,
  near: 0.1,
  far: 400,
  /** Low enough that the horizon and the sky show in the upper part of the screen. */
  startPosition: [9, 4, 12] as Vec3,
  startTarget: [0, 0.5, 0] as Vec3,
  /** Fraction of PI; keeps the orbit camera above its target (not enough alone: panning moves the target). */
  maxPolarFactor: 0.495,
  /** The camera never goes lower than this above the ground surface, and the orbit target never below the ground. */
  minHeight: 0.4,
  /** Zoom limits: closest and farthest distance (world units) between the camera and its target. */
  minDistance: 3,
  maxDistance: 60,
} as const;

export const SCENE = {
  fogNear: 60,
  fogFar: 160,
  floorSize: 400,
  /** Lifts the grid lines above the floor to avoid z-fighting. */
  gridLift: 0.001,
} as const;

/**
 * Floor-grid sizes a new game can choose from (squares per side), one square per cell (`CELL_SIZE`). The count is even:
 * the grid covers the cells `-cells / 2 … cells / 2 - 1` on both axes (see `buildRange`) and its lines fall on the cell
 * borders (at n ± 0.5), so every block fills exactly one square. The largest is the default.
 */
export const GRID_SIZES = [
  { id: 'small', name: 'Small', cells: 16 },
  { id: 'medium', name: 'Medium', cells: 32 },
  { id: 'large', name: 'Large', cells: 64 },
] as const;
export const DEFAULT_GRID_CELLS: number = GRID_SIZES[GRID_SIZES.length - 1].cells;

/** `cells` if it is one of `GRID_SIZES`, else the default (saves from before sizes existed, or a damaged one). */
export const validGridCells = (cells: unknown): number =>
  GRID_SIZES.find((size) => size.cells === cells)?.cells ?? DEFAULT_GRID_CELLS;

/**
 * Buildable cells on a grid with `cells` squares per side: x / z from `min` to `max` (inside the floor lines) and height
 * y from 0 to `maxY`, so the build volume is as tall as the grid is wide.
 */
export const buildRange = (cells: number): { min: number; max: number; maxY: number } => ({
  min: -cells / 2,
  max: cells / 2 - 1,
  maxY: cells - 1,
});

/** The plate: a thin square the size of a block's footprint, lying flat (it has studs on top like a block). */
export const PLATE = {
  /** Thickness, in cells. */
  thickness: 0.2,
} as const;

/**
 * Connectors ("studs") of blocks and plates: a 2 x 2 grid of round pegs on the top face, `pitch` cells apart. Two parts are
 * welded when one sits on the other and at least one pair of studs lines up; positions snap to the stud pitch in x and z,
 * so a part can rest on half of another (2 studs), or on a corner (1 stud).
 */
export const STUD = {
  pitch: 0.5,
  /** Visual size of a peg, in cells. */
  radius: 0.15,
  height: 0.08,
  segments: 16,
} as const;

export const LIGHTS = {
  hemisphereIntensity: 1.1,
  sunIntensity: 2.2,
  sunPosition: [12, 20, 8] as Vec3,
  shadowMapSize: 2048,
  shadowExtent: 30,
  /** Shadow-map offsets that stop faces from shadowing themselves ("acne") now that blocks touch without a gap. */
  shadowBias: -0.0005,
  shadowNormalBias: 0.03,
  shadowNear: 1,
  shadowFar: 80,
} as const;

/**
 * Wheel model details (the physical size is in `WHEEL`, see physics.ts): a tire (rubber with rounded shoulders and a
 * staggered tread) around a rim (lip, recessed disc, spokes, hub cap and lug nuts). All lengths are world units.
 */
export const WHEEL_VISUAL = {
  /** Segments around the wheel. */
  segments: 40,
  /** Rounding of the tire's shoulders and its inner radius (it sits under the rim lip). */
  tireShoulder: 0.07,
  tireInnerRadius: 0.37,
  /** Tread lugs: how many (alternating between two rows), how far they stand out, their size and the row offset. */
  treadLugs: 28,
  lugHeight: 0.025,
  lugLength: 0.065,
  lugWidth: 0.11,
  lugRowOffset: 0.07,
  /** Rim: outer radius, width (narrower than the tire), the lip ring and how deep the disc is recessed. */
  rimRadius: 0.4,
  rimWidth: 0.3,
  rimLip: 0.045,
  rimRecess: 0.05,
  /** Hub cap at the centre (and how far it sticks out of the rim), spokes and lug nuts. */
  hubRadius: 0.1,
  hubProtrusion: 0.015,
  spokes: 5,
  spokeWidth: 0.075,
  nuts: 5,
  nutRadius: 0.026,
  nutCircle: 0.17,
} as const;

/** Procedural sky dome with blocky "voxel" clouds (see src/scene/sky.ts). */
export const SKY = {
  /** Must stay below CAMERA.far. */
  domeRadius: 300,
  /** Cloud cells per unit of the flat cloud layer: higher means smaller squares. */
  cloudScale: 4,
  /** How the cloud pattern varies from cell to cell: lower means bigger clumps of cells. */
  clumpiness: 0.3,
  /** Wind in cells per second (x, z); the cloud blocks drift this way. */
  wind: [0.08, 0.03] as readonly [number, number],
  /** Noise level above which a cell is filled (higher = fewer clouds). */
  coverage: 0.52,
  /** How slowly the pattern itself changes over time (cells appear/disappear at the edges). */
  evolveSpeed: 0.003,
  /** Clouds fade out between these elevations (sine of the angle above the horizon). */
  fadeStart: 0.02,
  fadeEnd: 0.22,
  /** Exponent of the horizon -> zenith gradient (lower = the zenith colour starts sooner). */
  gradientPower: 0.55,
  /** Dark line between neighbouring cells, as a fraction of the cell, and how dark (0-1). */
  seamWidth: 0.05,
  seamStrength: 0.1,
  /** Shaded bevel on the lower-right edges of a cloud block, as a fraction of the cell, and how strong (0-1). */
  bevelWidth: 0.2,
  bevelStrength: 0.85,
  /** Cells smaller than this many pixels fade into smooth noise to avoid shimmering near the horizon. */
  minCellPixels: 3,
} as const;

/** Metal-ness of the rim (the scene has no environment map, so keep it low or it looks black). */
export const METALNESS = {
  rim: 0.15,
} as const;

export const ROUGHNESS = {
  floor: 1,
  block: 0.55,
  tire: 0.9,
  rim: 0.35,
  scenery: 0.8,
} as const;

/** Outlines drawn around the part under the cursor / the inspected part. */
export const HIGHLIGHT = {
  /** Outline sticks out of the part by this much (world units) to avoid z-fighting. */
  margin: 0.03,
  selectedFillOpacity: 0.22,
  removeFillOpacity: 0.3,
  hoverFillOpacity: 0.12,
} as const;

export const BUILD = {
  /** Pointer travel (px) below which a right press-release counts as a click (remove) rather than a camera pan. */
  clickMaxDistance: 5,
  /** While painting blocks by dragging, cells farther than this (in cells) from where the stroke started are ignored. */
  maxPaintDistance: 50,
} as const;

/** Loading screen (shown when the scene is swapped). */
export const LOADING = {
  /** Shortest time the screen stays up, so it does not flash when the work is quick. */
  minDurationMs: 600,
  /** Longest wait for the browser to paint a step's label before the step runs anyway. */
  paintTimeoutMs: 100,
} as const;

export const FRAME_LIMIT = {
  /** Rendering is capped at this many frames per second, whatever the display refresh rate. */
  targetFps: 60,
  /** A frame may be rendered this early (ms) so the average stays on target on displays whose refresh rate is not a multiple of it. */
  toleranceMs: 4,
} as const;

export const FPS_COUNTER = {
  /** Seconds over which frames are counted before the number is refreshed. */
  updateInterval: 0.5,
  /** At or above this the counter is green; at or above `okFps` it is yellow; below it is red. */
  goodFps: 55,
  okFps: 30,
} as const;

export const ZOOM = {
  /** Each zoom button press multiplies (out) or divides (in) the camera distance by this. */
  buttonFactor: 1.25,
  /** Slider granularity (the slider is logarithmic: equal steps are equal zoom ratios). */
  sliderStep: 0.001,
} as const;

export const HOTBAR = {
  slots: 9,
  /** Parts in the first slots on a fresh install; the rest start empty. */
  defaultParts: ['block', 'wheel'] as const,
} as const;

/** Rotating 3D previews of parts (hotbar, catalog cards, inspector). */
export const PREVIEW = {
  /** Spin speed (rad/s) while hovering a catalog card or inspecting a part. */
  hoverSpinSpeed: 2.2,
  inspectSpinSpeed: 0.8,
  /** Camera field of view (degrees) and direction from the part towards the camera. */
  fov: 30,
  cameraDirection: [1, 0.8, 1.3] as Vec3,
  /** Extra room around the part, as a multiple of its bounding radius. */
  margin: 1.12,
} as const;

/** Pointer travel (px) before a press on a catalog card / hotbar slot turns into a drag. */
export const DRAG = {
  threshold: 5,
} as const;

export const ROTATION = {
  /** Exponential rate (1/s) at which the placement ghost turns towards its target orientation. */
  smoothing: 14,
  /** Below this angle (rad) the ghost snaps to the target. */
  snapEpsilon: 0.002,
} as const;

export const HISTORY = {
  /** Undo steps kept per session; the oldest are dropped beyond this. */
  maxSteps: 100,
} as const;

export const STORAGE = {
  savesKey: 'blocklab.saves.v2',
  /** Hotbar layout and selected slot (per browser, not per save). */
  hotbarKey: 'blocklab.hotbar.v1',
  /** Single-slot save used before the main menu existed; migrated once. */
  legacyKey: 'blocklab.v1',
} as const;

export const SAVE = {
  nameMaxLength: 30,
  legacyName: 'My creation',
} as const;

/** Main-menu background scene. */
export const MENU_SCENE = {
  orbitSpeed: 0.12, // rad/s
  orbitRadius: 13,
  orbitHeight: 5,
  /** Looking above the car pushes it to the lower part of the screen, clear of the menu text. */
  lookOffsetY: 3.2,
  focusYOffset: 0.5,
  focusSmoothing: 2,
  roamRadius: 22,
  respawnDistance: 80,
  fallY: -5,
  minLifetime: 25, // s
  maxLifetime: 45,
  flipUpThreshold: 0.2,
  flipSeconds: 2,
  driveIntervalMin: 1.2, // s
  driveIntervalJitter: 2.5,
  returnInterval: 0.5,
  forwardChance: 0.85,
  reverseThrottle: -0.6,
  straightChance: 0.4,
} as const;

/** Random car generator for the menu. */
export const RANDOM_BUILD = {
  widths: [2, 3],
  lengths: [3, 4, 5],
  cabinChance: 0.75,
  cabinShortChance: 0.5,
  roofBlockChance: 0.4,
  middleAxleChance: 0.5,
} as const;

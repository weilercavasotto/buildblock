import { Vec3 } from '../types';

/** Edge length of a grid cell in world units. */
export const CELL_SIZE = 1;

/** Y of the ground's top surface: cells with `y = 0` sit exactly on it. */
export const GROUND_Y = -CELL_SIZE / 2;

/** A block's mesh fills its whole cell, like its collider, so neighbouring blocks touch without a gap. */
export const BLOCK_VISUAL_SIZE = CELL_SIZE;

/** The dark outline of a block is drawn this much larger than the cube, so it sits just outside the faces (no z-fighting). */
export const BLOCK_EDGE_SCALE = 1.004;

/** The placement ghost (the part itself, translucent) is a bit smaller so it does not z-fight with the faces of neighbouring parts. */
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
  /** While building, the camera's target stays within the creation widened by this many cells (room to build next to it). */
  panMargin: 10,
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
/**
 * The engine body: a cube mounted against a face of a block (`width` across the face, `depth` out of it), in cells. Its centre
 * sits `(CELL_SIZE - depth) / 2` from the cell centre towards the block it is mounted on.
 */
export const ENGINE_BODY = {
  width: 0.8,
  depth: 0.8,
} as const;

/**
 * The rotor body (a spinning part mounted on a face of a block): a fixed base against the block and, on top of it, the head, a
 * thin square plate with studs (a `PLATE` thick) that turns on the axis along the face. Everything welded to the studs of the head
 * turns with it. The whole thing is `width` across the face and `depth` out of it (`baseDepth` + the head), in cells; its centre sits
 * like the engine's.
 */
export const ROTOR_VISUAL = {
  baseDepth: 0.35,
  headDepth: PLATE.thickness,
  /**
   * The base, from the block out: a wide flange (radius, height), the body (radius; it takes the rest of `baseDepth`) and a bearing
   * ring (radius, height) that the round head turns on. The head is a disc (radius), a bit narrower than the cell.
   */
  flangeRadius: 0.46,
  flangeHeight: 0.07,
  bodyRadius: 0.36,
  bearingRadius: 0.42,
  bearingHeight: 0.05,
  headRadius: 0.48,
  /** The bolts round the flange: how many, their radius and height, and how far from the axis they sit. */
  bolts: 8,
  boltRadius: 0.025,
  boltHeight: 0.02,
  boltDistance: 0.4,
  segments: 32,
} as const;
export const ROTOR_BODY = {
  width: 1,
  depth: ROTOR_VISUAL.baseDepth + ROTOR_VISUAL.headDepth,
} as const;

/**
 * The piston (a part mounted on a face of a block that pushes its head out along the face and back): the same shape as the rotor
 * (a base against the block with a round head, a plate thick, with studs on top; `width` across, `depth` = base + head, folded), with a
 * thick rod that shows between them while it is extended. In cells.
 */
export const PISTON_VISUAL = {
  baseDepth: 0.55,
  headDepth: PLATE.thickness,
  /** The base: a wide flange (radius, height) under the barrel (radius) with a light collar ring at its mouth (radius, height); the rod and the head. */
  flangeRadius: 0.46,
  flangeHeight: 0.07,
  barrelRadius: 0.38,
  collarRadius: 0.3,
  collarHeight: 0.05,
  rodRadius: 0.16,
  headRadius: 0.48,
  segments: 32,
} as const;
export const PISTON_BODY = {
  width: 1,
  depth: PISTON_VISUAL.baseDepth + PISTON_VISUAL.headDepth,
} as const;

/** The parts with a head that moves (turns or slides) on a joint: how deep their base and their head are (cells). */
export const HEADED_PARTS = {
  rotor: { baseDepth: ROTOR_VISUAL.baseDepth, headDepth: ROTOR_VISUAL.headDepth, width: ROTOR_BODY.width },
  piston: { baseDepth: PISTON_VISUAL.baseDepth, headDepth: PISTON_VISUAL.headDepth, width: PISTON_BODY.width },
} as const;

/**
 * The turbo body: a cube mounted against a face of a block, like the engine's (`width` across the face, `depth` out of it), in cells.
 */
export const TURBO_BODY = {
  width: 0.6,
  depth: 0.6,
} as const;

/**
 * The thruster body: a cube mounted against a face of a block, like the engine's (`width` across the face, `depth` out of it), in cells.
 */
export const THRUSTER_BODY = {
  width: 0.6,
  depth: 0.6,
} as const;

/**
 * The thruster model (`parts/thruster-model.ts`): a jet pointing along +z (the way it pushes), a tube with a flared bell nozzle at
 * the back (-z) where the flame leaves, in its own frame, `THRUSTER_BODY.width` across. Lengths in cells.
 */
export const THRUSTER_VISUAL = {
  tubeRadius: 0.2,
  tubeLength: 0.3,
  /** The intake ring on the front, the bell (radius at the throat and at the mouth, length) and the glowing ring round its mouth. */
  intakeRadius: 0.23,
  intakeLength: 0.06,
  bellMouthRadius: 0.29,
  bellLength: 0.22,
  ringRadius: 0.29,
  ringTube: 0.022,
  segments: 28,
} as const;

/** The compact bodies of the parts mounted on a block face besides the wheels: where they sit (`partCentre`) and how big they are (`partBox`). */
export const MOUNTED_BODY = { engine: ENGINE_BODY, turbo: TURBO_BODY, thruster: THRUSTER_BODY, rotor: ROTOR_BODY, piston: PISTON_BODY } as const;

/**
 * The turbo model (`parts/turbo-model.ts`): a nitrous bottle lying along z with its nozzle at the back (-z), in its own frame,
 * `TURBO_BODY.width` across. Lengths in cells.
 */
export const TURBO_VISUAL = {
  bottleRadius: 0.2,
  bottleLength: 0.4,
  /** The rounded ends of the bottle (a dome each), the white band round its middle and the brass valve cap on the front. */
  domeLength: 0.1,
  bandLength: 0.07,
  bandOverhang: 0.012,
  valveRadius: 0.05,
  valveLength: 0.07,
  /** The nozzle: a short tube out of the back. */
  nozzleRadius: 0.06,
  nozzleLength: 0.12,
  segments: 24,
} as const;

/**
 * The brake model (`parts/brake-model.ts`): a drilled disc lying in the yz plane (its axis along x, like a wheel's) with a
 * caliper clamped on its top edge, in its own frame and at the size it has on a normal wheel (a large wheel scales it). `inset` is
 * how far toward the vehicle the disc sits from the middle of the wheel. Lengths in cells.
 */
export const BRAKE_VISUAL = {
  discRadius: 0.27,
  discThickness: 0.04,
  hubRadius: 0.07,
  hubLength: 0.08,
  /** The drilled holes: how many, their radius and the radius of the circle they sit on. */
  holes: 6,
  holeRadius: 0.03,
  holeCircle: 0.17,
  /** The caliper (width along the disc's axis, height and length along the rim). */
  caliperThickness: 0.12,
  caliperHeight: 0.14,
  caliperLength: 0.2,
  inset: 0.11,
  segments: 28,
} as const;

/**
 * The engine model (`parts/engine-model.ts`): a V engine drawn in its own frame, `ENGINE_BODY.width` on a side, with the
 * front (where the fan is) towards +z and the cylinder heads up. Lengths in cells.
 */
export const ENGINE_VISUAL = {
  /** Crankcase (the lower block of the engine) and the oil pan under it (narrower, darker). */
  crankcaseHeight: 0.3,
  panHeight: 0.1,
  panWidth: 0.56,
  panLength: 0.6,
  /** Cylinder banks: size, how far from the centre / how high their centre sits, and the tilt of the V (rad). */
  bankWidth: 0.36,
  bankHeight: 0.32,
  bankLength: 0.76,
  bankOffset: 0.17,
  bankLift: 0.14,
  bankTilt: 0.35,
  /** Cylinders per bank, the bore radius and the rim around it (on the top face of each bank). */
  cylinders: 4,
  boreRadius: 0.065,
  rimRadius: 0.092,
  /** Intake manifold in the trough of the V. */
  intakeWidth: 0.16,
  intakeHeight: 0.12,
  intakeLength: 0.56,
  intakeLift: 0.21,
  /** Height of the crankshaft axis, where the fan is. */
  crankHeight: -0.15,
  segments: 24,
} as const;

/**
 * The fan at the front of the engine (also what shows which way it pushes): a hub with blades inside a thin ring, standing
 * `standoff` in front of the engine, plus a small accent-coloured nose cone on the hub. Lengths in cells, pitch in rad.
 */
export const ENGINE_FAN = {
  blades: 6,
  radius: 0.2,
  hubRadius: 0.055,
  hubLength: 0.07,
  bladeWidth: 0.08,
  bladeThickness: 0.012,
  /** Twist of each blade around its length, which gives it its swept look. */
  bladePitch: 0.5,
  ringRadius: 0.215,
  ringTube: 0.012,
  standoff: 0.06,
  noseRadius: 0.03,
  noseLength: 0.05,
} as const;

export const STUD = {
  pitch: 0.5,
  /** Visual size of a peg, in cells. */
  radius: 0.15,
  height: 0.08,
  segments: 16,
  /** Sockets on the underside (the holes the studs of another part go into): radius, a little larger than a stud, and how far they float off the face to avoid z-fighting. */
  socketRadius: 0.17,
  socketLift: 0.004,
} as const;

/** Moving a selection (inspect mode): the step of the buttons and of dragging, in cells, horizontally (the stud pitch) and vertically (a plate). */
export const MOVE = {
  step: STUD.pitch,
  lift: PLATE.thickness,
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
 * staggered tread) around a rim (lip, spokes, hub cap and lug nuts, open between the spokes). All lengths are world units.
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
  /** Rim: outer radius, width (narrower than the tire), the lip ring and how deep the rim is recessed (the length of the lug nuts). */
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
  /** Resting turn (rad) around the vertical axis of every preview: the angle that frames the wheel well. */
  angle: -0.45,
  cameraDirection: [1, 0.8, 1.3] as Vec3,
  /** Extra room around the part, as a multiple of its bounding radius. */
  margin: 1.12,
} as const;

/** Pointer travel (px) before a press on a catalog card / hotbar slot turns into a drag. */
export const DRAG = {
  threshold: 5,
} as const;

/**
 * Visual effects. `bounce`: a part that has just been placed squashes and stretches like jelly (`amplitude` of the first squash,
 * `frequency` Hz, `damping` 1/s, `volume` how much the sides give for the height). `dust`: earth thrown up by a wheel that
 * grips the ground (the values here are the strongest effect, at `maxSpeed`; slower, fewer and smaller / gentler particles are thrown, down
 * to `scaleMin` of the size, lift and reach; `slip` is the extra dust of a wheel that spins faster than it moves). `smoke`: puffs from an engine's exhaust (the values here are at `maxSpeed` of the vehicle; slower there are fewer, smaller and gentler puffs, between `idleRate` and `drivingRate`, down to `scaleMin`; `throttleShare` of the full effect shows as soon as the throttle is pressed). `pop`: the swelling and shrinking of a removed part (`swell` is how much it grows first); `vibration`: how much a running engine
 * shakes (metres, radians). All lengths in cells, times in seconds.
 */
export const FX = {
  /** The flame of a turbo that is firing: particles per second, size, life, speed (along the nozzle) and scatter. */
  /** The flame of a thruster that is firing (bigger and longer than a turbo's, and orange). */
  thrustFlame: { rate: 170, size: [0.14, 0.3], life: [0.18, 0.38], speed: [3.5, 6], spread: 0.4 },
  flame: { max: 400, rate: 130, size: [0.1, 0.22], life: [0.14, 0.3], speed: [3, 5.5], spread: 0.35 },
  bounce: { duration: 0.6, amplitude: 0.32, frequency: 3.4, damping: 7, volume: 0.5 },
  dust: {
    max: 600,
    rate: 70,
    maxSpeed: 14,
    minSpeed: 1.2,
    slip: 0.5,
    size: [0.1, 0.22],
    life: [0.45, 0.9],
    gravity: 6,
    drag: 1.6,
    spread: 1.1,
    lift: [0.8, 2.2],
    back: 0.35,
    scaleMin: 0.35,
  },
  smoke: {
    max: 400,
    idleRate: 5,
    drivingRate: 18,
    size: [0.06, 0.34],
    life: [1.0, 1.8],
    rise: [0.7, 1.4],
    drift: 0.35,
    drag: 0.6,
    maxSpeed: 14,
    scaleMin: 0.35,
    throttleShare: 0.3,
    /** Where it leaves the engine, in the engine model's own frame (the back, on top). */
    exhaust: [0.12, 0.34, -0.3],
  },
  /** A part the player removes swells for a moment and pops away. */
  pop: { duration: 0.28, swell: 0.22 },
  vibration: { idle: 0.004, driving: 0.014, tilt: 0.02, frequency: 42 },
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
  /** Version of how parts are stored: 2 = every part is oriented the same way (`Part.studs` / `Part.spin`); older saves have none. */
  format: 2,
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
  /** Pistons: seconds between a push out and a pull back. Thrusters and turbos: the length of a burst and the pause between two (s). */
  pistonInterval: 3.5,
  burstLength: 1.2,
  burstPauseMin: 4,
  burstPauseJitter: 4,
} as const;

/** Random car generator for the menu. */
export const RANDOM_BUILD = {
  /** The kinds of vehicle, repeated in proportion to how often they appear. */
  archetypes: ['coupe', 'coupe', 'coupe', 'pickup', 'pickup', 'propeller', 'rocket', 'rocket'] as const,
  widths: [2, 3],
  lengths: [3, 4, 5],
  pickupLengths: [4, 5],
  propellerLengths: [3, 4],
  /** A sloping hood, a sloping tail, a lifting bed on a pickup. */
  hoodChance: 0.75,
  tailChance: 0.5,
  liftChance: 0.5,
  /** The speeds a propeller can have (see `ROTOR`). */
  rotorSpeeds: [4, 6, 8, -5, -7] as const,
  cabinChance: 0.75,
  cabinShortChance: 0.5,
  roofBlockChance: 0.4,
  middleAxleChance: 0.5,
} as const;

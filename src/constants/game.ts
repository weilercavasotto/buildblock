import { Vec3 } from '../types';

/** Edge length of a grid cell in world units. */
export const CELL_SIZE = 1;

/** Y of the ground's top surface: cells with `y = 0` sit exactly on it. */
export const GROUND_Y = -CELL_SIZE / 2;

/** A block's mesh is slightly smaller than its cell so neighbouring blocks show a seam. */
export const BLOCK_VISUAL_SIZE = 0.98;

export const CAMERA = {
  fov: 55,
  near: 0.1,
  far: 400,
  startPosition: [6, 6, 9] as Vec3,
  startTarget: [0, 0.5, 0] as Vec3,
  /** Fraction of PI; keeps the orbit camera above the ground. */
  maxPolarFactor: 0.495,
} as const;

export const SCENE = {
  fogNear: 60,
  fogFar: 160,
  floorSize: 400,
  gridSize: 60,
  gridDivisions: 60,
  /** Lifts the grid lines above the floor to avoid z-fighting. */
  gridLift: 0.001,
} as const;

export const LIGHTS = {
  hemisphereIntensity: 1.1,
  sunIntensity: 2.2,
  sunPosition: [12, 20, 8] as Vec3,
  shadowMapSize: 2048,
  shadowExtent: 30,
  shadowNear: 1,
  shadowFar: 80,
} as const;

/** Wheel mesh details (the physical size is in `WHEEL`, see physics.ts). */
export const WHEEL_VISUAL = {
  tireSegments: 28,
  /** Length of the hub bar as a multiple of the wheel radius. */
  spokeLength: 1.5,
  /** How far the hub bar sticks out of the tire on each side. */
  spokeOverhang: 0.04,
  spokeThickness: 0.14,
} as const;

export const ROUGHNESS = {
  floor: 1,
  block: 0.55,
  tire: 0.9,
  spoke: 0.4,
  scenery: 0.8,
} as const;

export const BUILD = {
  /** Pointer travel (px) below which a press-release counts as a click rather than a camera drag. */
  clickMaxDistance: 5,
} as const;

export const STORAGE = {
  savesKey: 'blocklab.saves.v2',
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

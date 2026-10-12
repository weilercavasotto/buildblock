import { COLORS } from './colors';
import { CELL_SIZE, GROUND_Y } from './game';
import { Vec3 } from '../types';

export const WORLD = {
  gravity: -15,
  /** Fixed simulation step in seconds. */
  step: 1 / 60,
  /** Longest frame time fed to the simulation, so a stalled tab does not explode the physics. */
  maxFrameTime: 0.1,
} as const;

/** Wheels are larger than half a cell, which also lifts the chassis off the ground. */
export const WHEEL = {
  radius: 0.65,
  width: 0.4,
  density: 1,
} as const;

/**
 * Tire types a wheel can have (`Part.tire`, chosen in the part inspector). Each trades grip against top speed:
 * `friction` is the wheel's friction coefficient, `speed` multiplies `VEHICLE.maxWheelSpeed` and `torque` multiplies
 * `VEHICLE.motorStrength` (a grippier tire needs a stronger motor, or the car cannot turn). `grip` / `topSpeed` are the
 * 1-5 ratings shown to the player (keep them in line with the numbers).
 */
export const TIRES = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'All-round tires: good grip and a good top speed.',
    friction: 2.5,
    speed: 1,
    torque: 1,
    grip: 3,
    topSpeed: 3,
  },
  {
    id: 'speed',
    name: 'Speed',
    description: 'Slick, low-grip tires for speed. Fast on a straight line, they slide in turns.',
    friction: 1.4,
    speed: 1.35,
    torque: 1,
    grip: 2,
    topSpeed: 5,
  },
  {
    id: 'traction',
    name: 'Traction',
    description: 'Deep-tread tires for snow and rough ground: huge grip, but slower.',
    friction: 4,
    speed: 0.75,
    torque: 3,
    grip: 5,
    topSpeed: 2,
  },
] as const;
export type TireId = (typeof TIRES)[number]['id'];
export const DEFAULT_TIRE: TireId = 'standard';

/** Is `value` the id of a tire type? */
export const isTireId = (value: unknown): value is TireId => TIRES.some((tire) => tire.id === value);

/** The tire of a part: its own, or the default. */
export const tireOf = (part: { tire?: string }): (typeof TIRES)[number] =>
  TIRES.find((tire) => tire.id === part.tire) ?? TIRES.find((tire) => tire.id === DEFAULT_TIRE)!;

/**
 * Wheel suspension: the wheel hangs from the chassis on a vertical spring (a prismatic joint with a position motor, see
 * docs/physics.md). The player sets the strength (0-100, `Part.suspension`) of each wheel in the part inspector.
 */
export const SUSPENSION = {
  min: 0,
  max: 100,
  step: 5,
  /** Strength of a wheel whose `Part.suspension` is not set. */
  defaultStrength: 50,
  /**
   * Spring stiffness (1/s²: the spring constant per kg the wheel supports) at strength `min` and `max`; in between it
   * grows exponentially. At rest the chassis sinks about `gravity / stiffness` cells.
   */
  minStiffness: 160,
  maxStiffness: 600,
  /** Damping as a fraction of critical damping (1 = no bounce at all). */
  dampingRatio: 0.7,
  /** How far the wheel may move up / down from its rest position, in cells. */
  travelUp: 0.4,
  travelDown: 0.3,
  /** Mass of the hub body between the chassis and the wheel (it has no collider). */
  hubMass: 0.1,
  /** Rotational inertia of the hub (kg·m²), much larger than a wheel's so the wheel motor keeps its strength. */
  hubInertia: 5,
} as const;

/** The suspension strength of a part: its own, or the default; always an integer in `[min, max]`. */
export const suspensionOf = (part: { suspension?: number }): number =>
  clampSuspension(part.suspension ?? SUSPENSION.defaultStrength);

export const clampSuspension = (value: number): number =>
  Math.min(SUSPENSION.max, Math.max(SUSPENSION.min, Math.round(Number.isFinite(value) ? value : SUSPENSION.defaultStrength)));

/** Spring stiffness for a strength. */
export const suspensionStiffness = (strength: number): number => {
  const t = (clampSuspension(strength) - SUSPENSION.min) / (SUSPENSION.max - SUSPENSION.min);
  return SUSPENSION.minStiffness * (SUSPENSION.maxStiffness / SUSPENSION.minStiffness) ** t;
};

export const CHASSIS = {
  friction: 0.6,
  density: 1,
} as const;

/** Spawn height added so the wheels do not start inside the floor. */
export const SPAWN_LIFT = WHEEL.radius - CELL_SIZE / 2 + 0.05;

/** Collision groups; see docs/physics.md for the interaction matrix. */
export const COLLISION_GROUP = {
  ground: 1,
  chassis: 2,
  wheel: 4,
} as const;

export const VEHICLE = {
  /** Wheel angular speed at full throttle (rad/s). */
  maxWheelSpeed: 14,
  motorStrength: 60,
  idleBrake: 12,
  /** How much steering input changes the speed of each side. */
  steerGain: 0.7,
} as const;

export const GROUND_COLLIDER = {
  halfExtent: 200,
  halfThickness: CELL_SIZE / 2,
  /** Centre Y so the top surface is at GROUND_Y. */
  centerY: GROUND_Y - CELL_SIZE / 2,
  friction: 1,
} as const;

export interface SceneryProp {
  halfExtents: Vec3;
  position: Vec3;
  /** Tilt around the X axis in degrees. */
  tiltDeg: number;
  color: string;
}

/** Fixed ramps and obstacles, only present in Play mode and far from the build area. */
export const SCENERY: SceneryProp[] = [
  { halfExtents: [3, 0.25, 4], position: [0, 0.3, -16], tiltDeg: 15, color: COLORS.scene.rampBrown },
  { halfExtents: [2.5, 0.25, 3], position: [14, 0.1, -10], tiltDeg: 15, color: COLORS.scene.rampGreen },
  { halfExtents: [6, 0.5, 0.5], position: [-10, -0.25, -6], tiltDeg: 0, color: COLORS.scene.obstacleBlue },
  { halfExtents: [6, 0.5, 0.5], position: [-10, -0.25, -9], tiltDeg: 0, color: COLORS.scene.obstacleBlue },
];

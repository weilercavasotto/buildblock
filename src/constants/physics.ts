import { COLORS } from './colors';
import { CELL_SIZE, GROUND_Y, PLATE } from './game';
import { PartType, Vec3 } from '../types';

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
 * Tire of a wheel (`Part.tire`, a slider in the part inspector): from `min` (speed tires: slick, low grip, fast) through
 * `default` (standard tires) to `max` (traction tires: deep tread, huge grip, slower). The tire's properties are
 * interpolated linearly between these three points: `friction` is the wheel's friction coefficient, `speed` multiplies
 * `VEHICLE.maxWheelSpeed` and `torque` multiplies `VEHICLE.motorStrength` (a grippier tire needs a stronger motor, or the
 * car cannot skid-steer).
 */
export const TIRE = {
  min: 0,
  max: 100,
  step: 5,
  default: 50,
  points: [
    { at: 0, friction: 1.4, speed: 1.35, torque: 1 },
    { at: 50, friction: 2.5, speed: 1, torque: 1 },
    { at: 100, friction: 4, speed: 0.75, torque: 3 },
  ],
} as const;

export const clampTire = (value: number): number =>
  Math.min(TIRE.max, Math.max(TIRE.min, Math.round(Number.isFinite(value) ? value : TIRE.default)));

/** The tire value of a part: its own, or the default; always an integer in `[min, max]`. */
export const tireValueOf = (part: { tire?: number }): number => clampTire(part.tire ?? TIRE.default);

/** Friction, top-speed and torque multipliers of a part's tire, interpolated between the points of `TIRE`. */
export function tireOf(part: { tire?: number }): { friction: number; speed: number; torque: number } {
  const value = tireValueOf(part);
  const [low, mid, high] = TIRE.points;
  const [from, to] = value <= mid.at ? [low, mid] : [mid, high];
  const t = (value - from.at) / (to.at - from.at);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return { friction: lerp(from.friction, to.friction), speed: lerp(from.speed, to.speed), torque: lerp(from.torque, to.torque) };
}

/** Converts what an old save kept in `Part.tire` (a tire name) to a tire value; anything else is not changed. */
export const legacyTireValue = (tire: unknown): unknown =>
  tire === 'speed' ? TIRE.min : tire === 'traction' ? TIRE.max : tire === 'standard' ? TIRE.default : tire;

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
   * Spring stiffness (1/s²: the spring constant per kg of `referenceLoad`) at strength `min` and `max`; in between it
   * grows exponentially. The spring constant itself is fixed (stiffness x `referenceLoad`), so the heavier the load on a
   * wheel the more it sinks: a wheel carrying `referenceLoad` sinks about `gravity / stiffness` cells.
   */
  minStiffness: 200,
  maxStiffness: 1000,
  /** Mass (kg) a wheel carries in a typical small car (6 blocks on 4 wheels): the load the strength scale is calibrated for. */
  referenceLoad: 1.5,
  /** Damping as a fraction of critical damping (1 = no bounce at all). */
  dampingRatio: 0.7,
  /**
   * Ride height: the spring's rest position holds the wheel this far below the mount (in cells), so the body rides higher
   * and has room to sink under load before it reaches the floor. Must be less than `travelDown`.
   */
  rideHeight: 0.15,
  /** How far the wheel may move up / down from its mount (the nominal position, 0), in cells. */
  travelUp: 0.4,
  travelDown: 0.35,
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

/**
 * Size of each wheel type: `scale` multiplies `WHEEL.radius` / `WHEEL.width`; `speed` multiplies the angular top speed (a
 * bigger wheel covers more ground per turn, so the large wheel turns slower to stay controllable); `torque` multiplies
 * the motor strength (the large wheel is far heavier, so the same motor setting would be far too strong); `cruise` is the
 * fraction of that strength used when driving straight: steering needs the full strength to skid the car round, but the
 * same torque in a straight line would tip a light body backwards (a wheelie), so it is eased off (see `VehicleController`).
 */
export const WHEEL_SIZES = {
  wheel: { scale: 1, speed: 1, torque: 1, cruise: 0.3 },
  bigWheel: { scale: 2, speed: 0.75, torque: 0.6, cruise: 0.2 },
} as const;
export const wheelSizeOf = (type: PartType): { scale: number; speed: number; torque: number; cruise: number } =>
  type === 'bigWheel' ? WHEEL_SIZES.bigWheel : WHEEL_SIZES.wheel;

/**
 * Weight of a block (`Part.weight`, set with a slider in the part inspector): an integer from `min` to `max`. A block of
 * the `default` weight has the mass of one unit of `CHASSIS.density`; the others scale linearly (`weightMass`), so the range
 * goes from a quarter of that mass to four times as much.
 */
export const WEIGHT = {
  min: 1,
  max: 16,
  step: 1,
  default: 4,
} as const;

export const clampWeight = (value: number): number =>
  Math.min(WEIGHT.max, Math.max(WEIGHT.min, Math.round(Number.isFinite(value) ? value : WEIGHT.default)));

/** The weight of a part: its own, or the default; always an integer in `[min, max]`. */
export const weightOf = (part: { weight?: number }): number => clampWeight(part.weight ?? WEIGHT.default);

/** Volume of a part relative to a block (a plate is a thin slab), which is what makes it lighter at the same weight. */
export const partVolume = (part: { type: PartType }): number => (part.type === 'plate' ? PLATE.thickness : 1);

/** Mass multiplier (relative to `CHASSIS.density`) of a block of this weight. */
export const weightMass = (weight: number): number => clampWeight(weight) / WEIGHT.default;

export const CHASSIS = {
  friction: 0.6,
  density: 1,
} as const;

/** Gap (cells) between a wheel and the floor when a creation spawns. */
export const SPAWN_CLEARANCE = 0.05;

/** Spawn height added so the wheels do not start inside the floor. */
export const SPAWN_LIFT = WHEEL.radius - CELL_SIZE / 2 + SPAWN_CLEARANCE;

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

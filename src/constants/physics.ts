import { COLORS } from './colors';
import { CELL_SIZE, GROUND_Y } from './game';
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

/**
 * The brake of a wheel (`Part.brake`, 1-10; missing = the wheel has no brake): fitted to a wheel with the Brake part and set with a
 * slider in the part inspector. While `Space` is held a braked wheel is held back (driven or not) with strength
 * `VEHICLE.idleBrake + VEHICLE.brakeStrength * strength / default`, so the default strength brakes as `brakeStrength` says and 10
 * twice as much. Only the wheels that have one brake.
 */
export const BRAKE = {
  min: 1,
  max: 10,
  step: 1,
  default: 5,
} as const;

export const clampBrake = (value: number): number =>
  Math.min(BRAKE.max, Math.max(BRAKE.min, Math.round(Number.isFinite(value) ? value : BRAKE.default)));

/** The brake strength of a wheel (1-10), or 0 when it has none. */
export const brakeOf = (part: { brake?: number }): number => (part.brake === undefined ? 0 : clampBrake(part.brake));

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

/** Mass multiplier (relative to `CHASSIS.density`) of a block of this weight. */
export const weightMass = (weight: number): number => clampWeight(weight) / WEIGHT.default;

/**
 * The engine (`Part.power`, a slider in the part inspector): a part mounted on a face of a block that drives the wheels. A
 * body's wheels are powered only by the engines mounted on that body, through the way each engine faces (`Part.front`): a
 * engine pushes the vehicle towards its front, so an engine turned around reverses the throttle. One engine of the `default`
 * power can drive `wheelsPerEngine` wheels at full torque; with more wheels the torque is shared, with fewer each wheel gets
 * up to `maxShare` times its normal torque. An engine weighs `mass` blocks of the default weight. Where it is mounted matters:
 * its push (`leverage` m/s² per unit of the body's mass at the default power, along its front, while the throttle is held on the
 * ground) is applied as a torque about the body's centre of mass, so a high or off-centre engine pitches or turns the vehicle.
 */
export const ENGINE = {
  min: 1,
  max: 10,
  step: 1,
  default: 5,
  wheelsPerEngine: 4,
  maxShare: 2,
  mass: 2,
  leverage: 4,
} as const;

/**
 * The turbo (`Part.power` as its boost, on the same 1-10 scale as the engine's): a part mounted on a face of a block that boosts
 * the wheels of that body while `Shift` is held. The boosts of a body's turbos add up (one turbo of the `default` strength counts
 * as 1, up to `maxBoost`); the driven wheels then turn `speedGain` times faster and push `torqueGain` times harder for each
 * unit of boost. A turbo weighs `mass` blocks of the default weight.
 */
export const TURBO = {
  speedGain: 0.4,
  torqueGain: 1,
  maxBoost: 3,
  mass: 1,
} as const;

/**
 * The thruster (`Part.power` as its thrust, on the same 1-10 scale as the engine's): a part mounted on a face of a block that pushes
 * its body along its front, at the place where it is mounted (so one that is off-centre also turns the body), while `Space` is held,
 * on the ground or in the air, with or without an engine. `thrust` is the force of one thruster of the `default` strength (a light
 * 2 x 2 car with one weighs about 90 with the world's gravity, so one just lifts it); the thrusts of all the thrusters add up. A thruster weighs
 * `mass` blocks of the default weight.
 */
export const THRUSTER = {
  thrust: 100,
  mass: 0.5,
} as const;

export const clampPower = (value: number): number =>
  Math.min(ENGINE.max, Math.max(ENGINE.min, Math.round(Number.isFinite(value) ? value : ENGINE.default)));

/** The power of an engine: its own, or the default; always an integer in `[min, max]`. */
export const powerOf = (part: { power?: number }): number => clampPower(part.power ?? ENGINE.default);

/**
 * The rotor (`Part.speed`, a slider in the part inspector from `-max` to `max`; the sign is the direction, positive is clockwise seen
 * from the head looking at the block): a part mounted on a face of a block whose head, with everything welded to its studs, turns on
 * the axis of the face when it is switched on (the `F` key toggles all of them). The motor drives the head towards `maxSpeed`
 * rad/s times `speed / max`, with an acceleration-based `strength` (so it does not depend on what the head carries); switched off it
 * only brakes lightly (`idleDamping`) and coasts. A rotor's base weighs `mass` blocks of the default weight, its head a plate.
 */
export const ROTOR = {
  max: 10,
  step: 1,
  default: 5,
  maxSpeed: 25,
  strength: 40,
  idleDamping: 0.3,
  mass: 1,
} as const;

export const clampRotorSpeed = (value: number): number =>
  Math.min(ROTOR.max, Math.max(-ROTOR.max, Math.round(Number.isFinite(value) ? value : ROTOR.default)));

/** The speed of a rotor: its own, or the default; an integer in `[-max, max]`. */
export const rotorSpeedOf = (part: { speed?: number }): number => clampRotorSpeed(part.speed ?? ROTOR.default);

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
  /** Strength with which a braked wheel is held while `Space` is held, on top of `idleBrake` (times its brake strength over `BRAKE.default`). */
  brakeStrength: 22,
  /**
   * Driving assist: while the player does not steer, an upright vehicle (its up axis within `uprightMin` of vertical) holds the
   * heading it had when the steering ended: its yaw rate is set to `-straighteningGain * heading error` (1/s), so a symmetric build
   * keeps a straight line. The simulation has a small veer of its own (a few degrees over a hundred metres) that would otherwise
   * show. A turn faster than `straighteningMaxRate` (rad/s, a collision, an off-centre thruster, a skid) is left alone and the
   * heading is taken again when it calms down; steering (A / D) switches the assist off.
   */
  straighteningGain: 5,
  straighteningMaxRate: 0.3,
  uprightMin: 0.8,
  /**
   * Air drag of a vehicle: above `dragFreeSpeed` (m/s, a little over what the wheels reach by themselves, so it only matters for
   * thrusters and falls) it slows down by `airDrag * (speed - dragFreeSpeed)^2` (m/s², whatever its mass), so it reaches a top speed.
   */
  airDrag: 0.2,
  dragFreeSpeed: 10,
  /** How much steering input changes the speed of each side. */
  steerGain: 0.7,
} as const;

/**
 * Flying (`PhysicsWorld.pilot`): while a vehicle has left the ground (none of its wheels or blocks touches it) the player can
 * steer its attitude with W / S (pitch: W nose down, S nose up), A / D (roll) and Q / E (yaw). The attitude changes at `rate`
 * rad/s² around the vehicle's axes (its nose is where its thrusters push, else where its engines push, else the way its wheels
 * roll), up to `maxRate` rad/s; the control surfaces bite less at low speed (`minAuthority` at rest, full at `authoritySpeed`
 * m/s); without input a flying vehicle's rotation fades at `damping` (1/s), and the heading hold of `VEHICLE` is off.
 */
export const FLIGHT = {
  rate: 6,
  maxRate: 2.5,
  damping: 1.5,
  authoritySpeed: 8,
  minAuthority: 0.4,
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

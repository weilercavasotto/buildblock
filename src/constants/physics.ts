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
  friction: 2.5,
  density: 1,
} as const;

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

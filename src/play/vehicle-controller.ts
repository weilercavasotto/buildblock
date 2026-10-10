import { WheelDrive } from './physics-world';
import { Vec3 } from '../types';

const MAX_WHEEL_SPEED = 14; // rad/s
const MOTOR_STRENGTH = 60;
const IDLE_BRAKE = 12;
const STEER_GAIN = 0.7;

const KEY_MAP: Record<string, 'forward' | 'back' | 'left' | 'right'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface DrivenWheel {
  wheel: WheelDrive;
  /** +1 / -1: motor direction that rolls this wheel towards the vehicle's forward. 0: not aligned, free-rolling. */
  roll: number;
  /** +1 right side, -1 left side, 0 centre. */
  side: number;
}

export class VehicleController {
  private pressed = { forward: false, back: false, left: false, right: false };
  private autopilot: { throttle: number; steer: number } | null = null;
  private driven: DrivenWheel[];
  private listening: boolean;

  /** With `keyboard: false` the vehicle only moves through `setAutopilot` (used by the main menu). */
  constructor(wheels: WheelDrive[], { keyboard = true } = {}) {
    this.listening = keyboard;
    // Forward is perpendicular to the axles of the majority of wheels.
    const onX = wheels.filter((w) => w.axis[0] !== 0).length;
    const forward: Vec3 = onX >= wheels.length - onX ? [0, 0, -1] : [1, 0, 0];
    const right = cross(forward, [0, 1, 0]);
    const centre = wheels
      .reduce<Vec3>((s, w) => [s[0] + w.cell[0], s[1] + w.cell[1], s[2] + w.cell[2]], [0, 0, 0])
      .map((v) => v / Math.max(wheels.length, 1)) as Vec3;

    this.driven = wheels.map((wheel) => ({
      wheel,
      roll: Math.sign(dot(cross(wheel.axis, [0, 1, 0]), forward)),
      side: Math.sign(Math.round(dot([wheel.cell[0] - centre[0], 0, wheel.cell[2] - centre[2]], right) * 100)),
    }));

    if (keyboard) {
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keyup', this.onKey);
    }
  }

  dispose(): void {
    if (!this.listening) return;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }

  /** Drives the vehicle with the given throttle/steer in [-1, 1]; `null` hands control back to the keyboard. */
  setAutopilot(input: { throttle: number; steer: number } | null): void {
    this.autopilot = input;
  }

  private onKey = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    this.pressed[action] = e.type === 'keydown';
    e.preventDefault();
  };

  update(): void {
    const throttle = this.autopilot?.throttle ?? Number(this.pressed.forward) - Number(this.pressed.back);
    const steer = this.autopilot?.steer ?? Number(this.pressed.right) - Number(this.pressed.left);
    const idle = throttle === 0 && steer === 0;

    for (const { wheel, roll, side } of this.driven) {
      if (roll === 0) continue;
      if (idle) {
        wheel.joint.configureMotorVelocity(0, IDLE_BRAKE);
        continue;
      }
      // Right turn (steer > 0): right wheels slow down / reverse, left wheels speed up.
      const speed = throttle - steer * side * STEER_GAIN;
      wheel.joint.configureMotorVelocity(roll * speed * MAX_WHEEL_SPEED, MOTOR_STRENGTH);
    }
  }
}

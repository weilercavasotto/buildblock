import { WheelDrive } from './physics-world';
import { ENGINE, VEHICLE } from '../constants';
import { Vec3 } from '../types';

const KEY_MAP: Record<string, 'forward' | 'back' | 'left' | 'right' | 'brake'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
};

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface DrivenWheel {
  wheel: WheelDrive;
  /** +1 / -1: engine direction that rolls this wheel towards the vehicle's forward. 0: not aligned or not powered, free-rolling. */
  roll: number;
  /** +1 right side, -1 left side, 0 centre. */
  side: number;
  /** Multiplies the wheel motor strength: the share of the body's engine power this wheel gets (1 when engines are not needed). */
  power: number;
}

export class VehicleController {
  private pressed = { forward: false, back: false, left: false, right: false, brake: false };
  private autopilot: { throttle: number; steer: number; brake?: boolean } | null = null;
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

    this.driven = wheels.map((wheel) => {
      let roll = Math.sign(dot(cross(wheel.axis, [0, 1, 0]), forward));
      let power = 1;
      if (wheel.engines) {
        // Each engine pushes towards its front: its power counts along the travel line, positive towards `forward`. Engines
        // facing sideways add nothing and an engine turned around reverses the throttle. No net push: the wheel rolls freely.
        const push = wheel.engines.reduce((sum, m) => sum + (m.power / ENGINE.default) * dot(m.front, forward), 0);
        roll *= Math.sign(push);
        power = Math.min(ENGINE.maxShare, (Math.abs(push) * ENGINE.wheelsPerEngine) / wheel.wheelCount);
      }
      return {
        wheel,
        roll,
        side: Math.sign(Math.round(dot([wheel.cell[0] - centre[0], 0, wheel.cell[2] - centre[2]], right) * 100)),
        power,
      };
    });

    if (keyboard) {
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keyup', this.onKey);
    }
  }

  /** How hard the vehicle is being driven, 0-1 (throttle or steering input): the engines' smoke and shaking follow it. */
  get level(): number {
    const throttle = this.autopilot?.throttle ?? Number(this.pressed.forward) - Number(this.pressed.back);
    const steer = this.autopilot?.steer ?? Number(this.pressed.right) - Number(this.pressed.left);
    return Math.min(1, Math.max(Math.abs(throttle), Math.abs(steer)));
  }

  /** How many wheels are driven (an engine pushes them along the travel line). */
  get poweredWheels(): number {
    return this.driven.filter((d) => d.roll !== 0 && d.power > 0).length;
  }

  dispose(): void {
    if (!this.listening) return;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }

  /** Drives the vehicle with the given throttle/steer in [-1, 1]; `null` hands control back to the keyboard. */
  setAutopilot(input: { throttle: number; steer: number; brake?: boolean } | null): void {
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

    const braking = this.autopilot?.brake ?? this.pressed.brake;

    for (const { wheel, roll, side, power } of this.driven) {
      // Braking (Space) holds the wheels that have a brake, driven or not, and overrides the throttle for them.
      if (braking && wheel.brake > 0) {
        wheel.joint.configureMotorVelocity(0, VEHICLE.idleBrake + VEHICLE.brakeStrength * wheel.brake); // on top of the light hold of a wheel at rest
        continue;
      }
      if (roll === 0) continue;
      if (idle) {
        wheel.joint.configureMotorVelocity(0, VEHICLE.idleBrake);
        continue;
      }
      // Right turn (steer > 0): right wheels slow down / reverse, left wheels speed up.
      const speed = throttle - steer * side * VEHICLE.steerGain;
      // Full strength to steer, `cruise` of it in a straight line (see `WHEEL_SIZES`), blended with the steering input.
      const strength = wheel.cruise + (1 - wheel.cruise) * Math.min(1, Math.abs(steer));
      wheel.joint.configureMotorVelocity(roll * speed * VEHICLE.maxWheelSpeed * wheel.speed, VEHICLE.motorStrength * wheel.torque * strength * power);
    }
  }
}

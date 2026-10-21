import { WheelDrive } from './physics-world';
import { ENGINE, TURBO, VEHICLE, keyModeOf } from '../constants';
import { Part, Vec3, isRotor, isPiston } from '../types';

/** The keys that drive and fly the vehicle: fixed (and reserved: see `RESERVED_KEYS`). The keys of the other parts are the parts' own (`Part.key`). */
const KEY_MAP: Record<string, 'forward' | 'back' | 'left' | 'right' | 'yawLeft' | 'yawRight'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyQ: 'yawLeft',
  KeyE: 'yawRight',
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
  private pressed = { forward: false, back: false, left: false, right: false, yawLeft: false, yawRight: false };
  private autopilot: { throttle: number; steer: number; brake?: boolean; boost?: boolean; thrust?: boolean; rotors?: boolean; pistons?: boolean } | null = null;
  /** The part keys that are held right now, and the ones switched on by a press (a key runs its `hold` parts while held and flips its `toggle` parts). */
  private held = new Set<string>();
  private toggled = new Set<string>();
  /** The keys some part is bound to: the only part keys this listens to (the rest of the keyboard is left alone). */
  private bound: Set<string>;
  /** Was a brake held at the last `update`? */
  private wheelBraking = false;
  private driven: DrivenWheel[];
  private listening: boolean;

  /**
   * `parts` are the parts of the creation being played (their keys decide what runs). With `keyboard: false` the vehicle only moves
   * through `setAutopilot` (used by the main menu).
   */
  constructor(wheels: WheelDrive[], private parts: ReadonlyArray<Part> = [], { keyboard = true } = {}) {
    this.listening = keyboard;
    this.bound = new Set(parts.flatMap((p) => (p.key ? [p.key] : [])));
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
      window.addEventListener('blur', this.releaseAll);
    }
  }

  /**
   * Is this rotor, piston, thruster or turbo (or the brake of this wheel) running? Its key decides: a `hold` part while the key is held,
   * a `toggle` part once the key has been pressed an odd number of times. A part with no key never runs. The autopilot (main menu)
   * runs every part of a kind at once.
   */
  isOn = (part: Part): boolean => {
    if (this.autopilot) {
      if (isRotor(part.type)) return this.autopilot.rotors ?? false;
      if (isPiston(part.type)) return this.autopilot.pistons ?? false;
      if (part.type === 'thruster') return this.autopilot.thrust ?? false;
      if (part.type === 'turbo') return this.autopilot.boost ?? false;
      return this.autopilot.brake ?? false;
    }
    if (!part.key) return false;
    return keyModeOf(part) === 'toggle' ? this.toggled.has(part.key) : this.held.has(part.key);
  };

  private anyOn(match: (part: Part) => boolean): boolean {
    return this.parts.some((p) => match(p) && this.isOn(p));
  }

  /**
   * What the pilot asks of a flying vehicle (see `FLIGHT`), each -1 to 1: pitch from W / S (W is nose down, +1), roll from A / D
   * (D banks right, +1) and yaw from Q / E (E turns right, +1). The autopilot never flies.
   */
  get pilot(): { pitch: number; roll: number; yaw: number } {
    if (this.autopilot) return { pitch: 0, roll: 0, yaw: 0 };
    return {
      pitch: Number(this.pressed.forward) - Number(this.pressed.back),
      roll: Number(this.pressed.right) - Number(this.pressed.left),
      yaw: Number(this.pressed.yawRight) - Number(this.pressed.yawLeft),
    };
  }

  /** Is any thruster firing? (The sound of the jets follows it.) */
  get thrusting(): boolean {
    return this.anyOn((p) => p.type === 'thruster');
  }

  /** Is any brake held? */
  get braking(): boolean {
    return this.wheelBraking;
  }

  /** Is any turbo blowing? */
  get boosting(): boolean {
    return this.anyOn((p) => p.type === 'turbo');
  }

  /** Is the player steering (A / D, or the autopilot's steer)? The straightening assist is off while so. */
  get steering(): boolean {
    const steer = this.autopilot?.steer ?? Number(this.pressed.right) - Number(this.pressed.left);
    return steer !== 0;
  }

  /** Is any rotor switched on (they start off)? */
  get rotating(): boolean {
    return this.anyOn((p) => isRotor(p.type));
  }

  /** The throttle, -1 (S) to 1 (W): the engines' push on the body (see `ENGINE.leverage`) follows it. */
  get throttle(): number {
    return this.autopilot?.throttle ?? Number(this.pressed.forward) - Number(this.pressed.back);
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
    window.removeEventListener('blur', this.releaseAll);
  }

  /** The window lost the focus: the keys that were held are released (their keyup never comes). */
  private releaseAll = (): void => {
    this.held.clear();
    this.pressed = { forward: false, back: false, left: false, right: false, yawLeft: false, yawRight: false };
  };

  /** Drives the vehicle with the given throttle/steer in [-1, 1]; `null` hands control back to the keyboard. */
  setAutopilot(input: { throttle: number; steer: number; brake?: boolean; boost?: boolean; thrust?: boolean; rotors?: boolean; pistons?: boolean } | null): void {
    this.autopilot = input;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // browser and system shortcuts are not for the vehicle
    const down = e.type === 'keydown';
    // The key of some parts: held while pressed; each press (not the repeats of a held key) flips the toggles.
    if (this.bound.has(e.code)) {
      if (down) {
        if (!e.repeat) {
          if (this.toggled.has(e.code)) this.toggled.delete(e.code);
          else this.toggled.add(e.code);
        }
        this.held.add(e.code);
      } else {
        this.held.delete(e.code);
      }
      e.preventDefault();
      return;
    }
    const action = KEY_MAP[e.code];
    if (!action) return;
    this.pressed[action] = down;
    e.preventDefault();
  };

  update(): void {
    const throttle = this.autopilot?.throttle ?? Number(this.pressed.forward) - Number(this.pressed.back);
    const steer = this.autopilot?.steer ?? Number(this.pressed.right) - Number(this.pressed.left);
    const idle = throttle === 0 && steer === 0;

    this.wheelBraking = false;

    for (const { wheel, roll, side, power } of this.driven) {
      // A held brake key holds the wheels that have it, driven or not, and overrides the throttle for them.
      if (this.isOn(wheel.part)) {
        this.wheelBraking = true;
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
      // The turbos of the wheel's body whose keys are held make it turn faster and push harder.
      const boost = Math.min(TURBO.maxBoost, wheel.turbos.reduce((sum, t) => sum + (this.isOn(t.part) ? t.boost : 0), 0));
      wheel.joint.configureMotorVelocity(
        roll * speed * VEHICLE.maxWheelSpeed * wheel.speed * (1 + TURBO.speedGain * boost),
        VEHICLE.motorStrength * wheel.torque * strength * power * (1 + TURBO.torqueGain * boost),
      );
    }
  }
}

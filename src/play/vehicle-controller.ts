import { WheelDrive } from './physics-world';
import { ENGINE, TURBO, VEHICLE, actionsOf, keysOf } from '../constants';
import { Part, Vec3, isRotor, isPiston } from '../types';

/**
 * The fixed driving keys of a game saved before engines existed (`Grid.engineDrive` false): there is no engine to give keys to, so its
 * wheels still drive with W / S and steer with A / D (and the arrows). Every other game is driven only by the keys the player gave to
 * the parts (`Part.keys`).
 */
const LEGACY_KEYS: Record<string, 'forward' | 'back' | 'left' | 'right'> = {
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
const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

interface DrivenWheel {
  wheel: WheelDrive;
  /** False when no engine pushes this wheel along the travel line: it only turns to steer. */
  driven: boolean;
  /** +1 / -1: the direction that rolls this wheel towards the vehicle's forward when its engines push forward. 0: not aligned or not powered, free-rolling. */
  roll: number;
  /** +1 right side, -1 left side, 0 centre. */
  side: number;
  /** Multiplies the wheel motor strength: the share of the body's engine power this wheel gets (1 when engines are not needed). */
  power: number;
  /** +1 / -1: the way the engines of its body push along the travel line (the steering is relative to it, so a car whose engine faces backwards still turns right with the right key). */
  dir: number;
  /** The engines of its body that push along the travel line: each one's weight (its power over the default) and whether it pushes forward (+1) or backwards (-1). */
  engines: Array<{ part: Part; weight: number; sign: number }>;
}

export class VehicleController {
  private autopilot: { throttle: number; steer: number; brake?: boolean; boost?: boolean; thrust?: boolean; rotors?: boolean; pistons?: boolean; lamps?: boolean; sirens?: boolean; propellers?: boolean } | null = null;
  /** The part keys that are held right now. */
  private held = new Set<string>();
  /** The (part, action) pairs each key is bound to: a press flips the `toggle` ones, the held key runs the `hold` ones. */
  private bindings = new Map<string, Array<{ part: Part; action: string }>>();
  /** The toggle actions that are switched on, per part (a toggle starts off). */
  private toggled = new Map<Part, Set<string>>();
  /** The fixed keys of a game without engines (see `LEGACY_KEYS`). */
  private legacy: boolean;
  private legacyPressed = { forward: false, back: false, left: false, right: false };
  private driven: DrivenWheel[];
  private listening: boolean;
  /** What `update` last found: any brake held, how hard the vehicle is driven (0-1) and whether the player steers. */
  private wheelBraking = false;
  private drive = 0;
  private turning = false;

  /**
   * `parts` are the parts of the creation being played (their keys decide what runs). With `keyboard: false` the vehicle only moves
   * through `setAutopilot` (used by the main menu).
   */
  constructor(wheels: WheelDrive[], private parts: ReadonlyArray<Part> = [], { keyboard = true } = {}) {
    this.listening = keyboard;
    this.legacy = wheels.some((w) => w.engines === null);
    for (const part of parts) {
      for (const action of actionsOf(part)) {
        for (const code of keysOf(part, action.id)) this.bindings.set(code, [...(this.bindings.get(code) ?? []), { part, action: action.id }]);
      }
    }
    // Forward is perpendicular to the axles of the majority of wheels.
    const onX = wheels.filter((w) => w.axis[0] !== 0).length;
    const forward: Vec3 = onX >= wheels.length - onX ? [0, 0, -1] : [1, 0, 0];
    const right = cross(forward, [0, 1, 0]);
    const centre = wheels
      .reduce<Vec3>((s, w) => [s[0] + w.cell[0], s[1] + w.cell[1], s[2] + w.cell[2]], [0, 0, 0])
      .map((v) => v / Math.max(wheels.length, 1)) as Vec3;

    this.driven = wheels.map((wheel) => {
      const roll = Math.sign(dot(cross(wheel.axis, [0, 1, 0]), forward));
      let driven = true;
      let power = 1;
      let dir = 1;
      const engines: DrivenWheel['engines'] = [];
      if (wheel.engines) {
        // Each engine pushes towards its front: its power counts along the travel line, positive towards `forward`. Engines
        // facing sideways add nothing and an engine turned around pushes backwards. No net push: the wheel rolls freely.
        let push = 0;
        for (const m of wheel.engines) {
          const along = dot(m.front, forward);
          push += (m.power / ENGINE.default) * along;
          if (Math.abs(along) > 0.01) engines.push({ part: m.part, weight: (m.power / ENGINE.default) * Math.abs(along), sign: Math.sign(along) });
        }
        if (push === 0) {
          // No engine pushes along the travel line: the wheel is not driven, but it can still be turned by its steering keys (a
          // propeller or thruster vehicle steers with its wheels); `driven` false keeps it free-rolling while it is not steering.
          driven = false;
        } else dir = Math.sign(push);
        power = Math.min(ENGINE.maxShare, (Math.abs(push) * ENGINE.wheelsPerEngine) / wheel.wheelCount);
      }
      return {
        wheel,
        roll,
        driven,
        side: Math.sign(Math.round(dot([wheel.cell[0] - centre[0], 0, wheel.cell[2] - centre[2]], right) * 100)),
        power: driven ? power : 1,
        dir,
        engines,
      };
    });

    if (keyboard) {
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keyup', this.onKey);
      window.addEventListener('blur', this.releaseAll);
    }
  }

  /**
   * Is this action of the part running (a rotor's or piston's `run`, a thruster's or turbo's `run`, a wheel's `brake`...)? The keys
   * decide: a `hold` action while any of its keys is held, a `toggle` action once its keys have been pressed an odd number of times
   * (it starts off). An action with no key never runs. The autopilot (main menu) runs every part of a kind at once.
   */
  isOn = (part: Part, action: string): boolean => {
    if (this.autopilot) {
      if (isRotor(part.type)) return this.autopilot.rotors ?? false;
      if (isPiston(part.type)) return this.autopilot.pistons ?? false;
      if (part.type === 'thruster') return this.autopilot.thrust ?? false;
      if (part.type === 'turbo') return this.autopilot.boost ?? false;
      if (part.type === 'propeller') return this.autopilot.propellers ?? false;
      if (part.type === 'lamp') return this.autopilot.lamps ?? false;
      if (part.type === 'siren') return this.autopilot.sirens ?? false;
      if (action === 'steerLeft') return this.autopilot.steer < 0;
      if (action === 'steerRight') return this.autopilot.steer > 0;
      return action === 'brake' ? (this.autopilot.brake ?? false) : false;
    }
    const mode = actionsOf(part).find((a) => a.id === action)?.mode;
    if (mode === 'toggle') return this.toggled.get(part)?.has(action) ?? false;
    return keysOf(part, action).some((code) => this.held.has(code));
  };

  /** The throttle an engine is given, -1 (reverse) to 1 (accelerate): its own keys, or the autopilot's. */
  engineInput = (engine: Part): number => this.autopilot?.throttle ?? Number(this.isOn(engine, 'forward')) - Number(this.isOn(engine, 'reverse'));

  /** How much a wheel is asked to steer, -1 (left) to 1 (right): its own keys, or the autopilot's. */
  steerInput = (wheel: Part): number => this.autopilot?.steer ?? Number(this.isOn(wheel, 'steerRight')) - Number(this.isOn(wheel, 'steerLeft'));

  private anyOn(match: (part: Part) => boolean): boolean {
    return this.parts.some((p) => match(p) && this.isOn(p, 'run'));
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

  /** Is the player steering (a wheel's steering key held, or the autopilot's steer)? The straightening assist is off while so. */
  get steering(): boolean {
    return this.turning;
  }

  /** Is any rotor switched on (they start off)? */
  get rotating(): boolean {
    return this.anyOn((p) => isRotor(p.type));
  }

  /** How hard the vehicle is being driven, 0-1 (the strongest throttle or steering input): the engines' smoke and shaking follow it. */
  get level(): number {
    return this.drive;
  }

  /** How many wheels are driven (an engine pushes them along the travel line). */
  get poweredWheels(): number {
    return this.driven.filter((d) => d.driven && d.roll !== 0 && d.power > 0).length;
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
    this.legacyPressed = { forward: false, back: false, left: false, right: false };
  };

  /** Drives the vehicle with the given throttle/steer in [-1, 1]; `null` hands control back to the keyboard. */
  setAutopilot(input: { throttle: number; steer: number; brake?: boolean; boost?: boolean; thrust?: boolean; rotors?: boolean; pistons?: boolean; lamps?: boolean; sirens?: boolean; propellers?: boolean } | null): void {
    this.autopilot = input;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // browser and system shortcuts are not for the vehicle
    const down = e.type === 'keydown';
    const bound = this.bindings.get(e.code);
    if (bound) {
      if (down) {
        // Each press (not the repeats of a held key) flips the toggle actions bound to the key.
        if (!e.repeat) {
          for (const { part, action } of bound) {
            if (actionsOf(part).find((a) => a.id === action)?.mode !== 'toggle') continue;
            const on = this.toggled.get(part) ?? new Set<string>();
            if (!on.delete(action)) on.add(action);
            this.toggled.set(part, on);
          }
        }
        this.held.add(e.code);
      } else {
        this.held.delete(e.code);
      }
      e.preventDefault();
    }
    const legacy = this.legacy ? LEGACY_KEYS[e.code] : undefined;
    if (legacy) {
      this.legacyPressed[legacy] = down;
      e.preventDefault();
    }
  };

  update(): void {
    this.wheelBraking = false;
    let drive = 0;
    let turning = false;
    const legacyThrottle = Number(this.legacyPressed.forward) - Number(this.legacyPressed.back);
    const legacySteer = Number(this.legacyPressed.right) - Number(this.legacyPressed.left);

    for (const { wheel, roll, driven, side, power, dir, engines } of this.driven) {
      const steer = wheel.engines === null ? (this.autopilot?.steer ?? legacySteer) : this.steerInput(wheel.part);
      // The wheel's throttle: what the engines of its body are asked, weighted by their power and the way they push.
      let throttle: number;
      if (wheel.engines === null) throttle = this.autopilot?.throttle ?? legacyThrottle;
      else {
        let sum = 0;
        let total = 0;
        for (const e of engines) {
          sum += e.weight * e.sign * this.engineInput(e.part);
          total += e.weight;
        }
        throttle = total > 0 ? clamp1(sum / total) : 0;
      }
      drive = Math.max(drive, Math.abs(throttle), Math.abs(steer));
      if (steer !== 0) turning = true;

      // A held brake key holds the wheels that have it, driven or not, and overrides the throttle for them.
      if (this.isOn(wheel.part, 'brake')) {
        this.wheelBraking = true;
        wheel.joint.configureMotorVelocity(0, VEHICLE.idleBrake + VEHICLE.brakeStrength * wheel.brake); // on top of the light hold of a wheel at rest
        continue;
      }
      if (!driven && steer === 0) {
        wheel.joint.configureMotorVelocity(0, VEHICLE.freeWheel); // let go of the wheel: the last steering command must not keep turning it
        continue;
      }
      if (roll === 0) continue;
      if (throttle === 0 && steer === 0) {
        wheel.joint.configureMotorVelocity(0, VEHICLE.idleBrake);
        continue;
      }
      // Right turn (steer > 0): right wheels slow down / reverse, left wheels speed up; a wheel without a steering key keeps going straight.
      const speed = throttle - dir * steer * side * VEHICLE.steerGain;
      // Full strength to steer, `cruise` of it in a straight line (see `WHEEL_SIZES`), blended with the steering input.
      const strength = wheel.cruise + (1 - wheel.cruise) * Math.min(1, Math.abs(steer));
      // The turbos of the wheel's body whose keys are held make it turn faster and push harder.
      const boost = Math.min(TURBO.maxBoost, wheel.turbos.reduce((sum, t) => sum + (this.isOn(t.part, 'run') ? t.boost : 0), 0));
      wheel.joint.configureMotorVelocity(
        roll * speed * VEHICLE.maxWheelSpeed * wheel.speed * (1 + TURBO.speedGain * boost),
        VEHICLE.motorStrength * wheel.torque * strength * power * (1 + TURBO.torqueGain * boost),
      );
    }
    this.drive = Math.min(1, drive);
    this.turning = turning;
  }
}

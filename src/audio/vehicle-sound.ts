import { VEHICLE_SOUND as V } from '../constants';
import { AudioState } from '../play/physics-world';
import { sound } from './sound';

/** What the controls say, besides the physics (see `VehicleController`). */
export interface DriveInput {
  /** How hard the vehicle is driven, 0-1. */
  level: number;
  braking: boolean;
  boosting: boolean;
  thrusting: boolean;
  /** Are the rotors switched on? */
  rotors: boolean;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The sounds of a vehicle in Play: continuous voices (the engine, the wheels on the earth, a skid, the brakes, the jets, the turbos
 * and the rotors) whose pitch and level follow the state of the vehicle every frame, and the one-shots (a bump, a piston). Built when
 * Play starts and `dispose`d when it stops. Silent where there is no audio. All the numbers are in `VEHICLE_SOUND`.
 */
export class VehicleSound {
  private ctx = sound.context();
  private nodes: AudioNode[] = [];
  private sources: Array<AudioScheduledSourceNode> = [];
  private engineA!: OscillatorNode;
  private engineB!: OscillatorNode;
  private engineFilter!: BiquadFilterNode;
  private engineGain!: GainNode;
  private rumbleFilter!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private skidGain!: GainNode;
  private brakeOsc!: OscillatorNode;
  private brakeGain!: GainNode;
  private jetFilter!: BiquadFilterNode;
  private jetGain!: GainNode;
  private jetRumbleGain!: GainNode;
  private hissGain!: GainNode;
  private rotorOsc!: OscillatorNode;
  private rotorFilter!: BiquadFilterNode;
  private rotorGain!: GainNode;
  private chopGain!: GainNode;
  private chopLfo!: OscillatorNode;
  private lastImpact = -1;
  private pistons = 0;

  constructor() {
    const out = sound.vehicleOutput;
    if (!this.ctx || !out) return;
    const ctx = this.ctx;
    const gain = (): GainNode => this.keep(ctx.createGain(), 0);
    const filter = (type: BiquadFilterType, frequency: number, q = 1): BiquadFilterNode => {
      const f = this.keep(ctx.createBiquadFilter());
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = q;
      return f;
    };
    const osc = (type: OscillatorType): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = type;
      this.sources.push(o);
      return o;
    };
    const noise = (): AudioBufferSourceNode | null => {
      const n = sound.createNoiseSource();
      if (n) this.sources.push(n);
      return n;
    };

    // The engine: a saw and a square an octave down through a low-pass, with a little shake.
    const e = V.engine;
    this.engineA = osc('sawtooth');
    this.engineB = osc('square');
    this.engineFilter = filter('lowpass', e.cutoffIdle, 1.2);
    this.engineGain = gain();
    const subLevel = gain();
    subLevel.gain.value = e.sub;
    const shake = osc('sine');
    shake.frequency.value = e.shakeRate;
    const shakeDepth = gain();
    shakeDepth.gain.value = e.shakeDepth;
    shake.connect(shakeDepth);
    shakeDepth.connect(this.engineA.frequency);
    shakeDepth.connect(this.engineB.frequency);
    this.engineA.connect(this.engineFilter);
    this.engineB.connect(subLevel).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(out);

    // The wheels on the earth, and a skid.
    const rumbleNoise = noise();
    this.rumbleFilter = filter('bandpass', V.rumble.cutoffLow, V.rumble.q);
    this.rumbleGain = gain();
    rumbleNoise?.connect(this.rumbleFilter).connect(this.rumbleGain).connect(out);
    const skidNoise = noise();
    this.skidGain = gain();
    skidNoise?.connect(filter('bandpass', V.skid.freq, V.skid.q)).connect(this.skidGain).connect(out);

    // The brakes.
    this.brakeOsc = osc('sawtooth');
    this.brakeOsc.frequency.value = V.brake.freq;
    this.brakeGain = gain();
    this.brakeOsc.connect(filter('bandpass', V.brake.freq, 3)).connect(this.brakeGain).connect(out);

    // The jets: a roar of noise and a low rumble.
    const jetNoise = noise();
    this.jetFilter = filter('lowpass', V.thruster.cutoff, 0.7);
    this.jetGain = gain();
    jetNoise?.connect(this.jetFilter).connect(this.jetGain).connect(out);
    const jetRumble = osc('sawtooth');
    jetRumble.frequency.value = V.thruster.rumble;
    this.jetRumbleGain = gain();
    jetRumble.connect(filter('lowpass', 220)).connect(this.jetRumbleGain).connect(out);

    // The turbos: a spray (a hiss of high noise) while the boost is held.
    const hissNoise = noise();
    this.hissGain = gain();
    hissNoise?.connect(filter('highpass', V.turbo.hissFreq)).connect(this.hissGain).connect(out);

    // The rotors: a saw chopped at the rate the blades pass.
    this.rotorOsc = osc('sawtooth');
    this.rotorOsc.frequency.value = V.rotor.base;
    this.rotorFilter = filter('lowpass', 900, 0.9);
    this.rotorGain = gain();
    this.chopGain = gain();
    this.chopGain.gain.value = 1 - V.rotor.chop;
    this.chopLfo = osc('sine');
    this.chopLfo.frequency.value = 1;
    const chopDepth = gain();
    chopDepth.gain.value = V.rotor.chop;
    this.chopLfo.connect(chopDepth).connect(this.chopGain.gain);
    this.rotorOsc.connect(this.rotorFilter).connect(this.chopGain).connect(this.rotorGain).connect(out);

    for (const s of this.sources) s.start();
  }

  /** Keeps a node to disconnect it later (`gain` starts at `value` when it is given). */
  private keep<T extends AudioNode>(node: T, gainValue?: number): T {
    this.nodes.push(node);
    if (gainValue !== undefined && node instanceof GainNode) node.gain.value = gainValue;
    return node;
  }

  /** Moves the voices towards the state of the vehicle (call it every frame). */
  update(state: AudioState, input: DriveInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.engineA) return;
    const t = ctx.currentTime;
    const k = V.smoothing;
    const to = (param: AudioParam, value: number) => param.setTargetAtTime(value, t, k);
    const driven = state.engineDrive ? state.engines > 0 : state.wheels > 0;

    // Engine: the pitch follows the speed and the throttle, the level the throttle and the number of engines.
    const e = V.engine;
    const revs = clamp01(state.speed / e.topSpeed);
    const pitch = e.idle + (e.top - e.idle) * revs + e.throttleBoost * input.level;
    const loud = e.gainIdle + (e.gainLoud - e.gainIdle) * clamp01(input.level * 0.7 + revs * 0.5);
    to(this.engineA.frequency, pitch);
    to(this.engineB.frequency, pitch / 2);
    to(this.engineFilter.frequency, e.cutoffIdle + (e.cutoffTop - e.cutoffIdle) * clamp01(revs * 0.6 + input.level * 0.6));
    to(this.engineGain.gain, driven ? loud * Math.min(1.6, Math.sqrt(Math.max(1, state.engineDrive ? state.engines : 1))) : 0);

    // Wheels on the earth, skid and brakes.
    const grip = clamp01(state.rumble);
    to(this.rumbleFilter.frequency, V.rumble.cutoffLow + (V.rumble.cutoffHigh - V.rumble.cutoffLow) * grip);
    to(this.rumbleGain.gain, V.rumble.gain * grip);
    to(this.skidGain.gain, V.skid.gain * clamp01(state.slip * 2) + (input.braking && state.speed > V.brake.minSpeed ? V.skid.gain * 0.4 : 0));
    const braking = input.braking && state.speed > V.brake.minSpeed;
    to(this.brakeOsc.frequency, V.brake.freq - V.brake.fall * (1 - clamp01(state.speed / V.brake.topSpeed)));
    to(this.brakeGain.gain, braking ? V.brake.gain : 0);

    // Jets and turbos (the boost is heard as a spray while the key is held).
    const jets = input.thrusting ? Math.min(1.5, state.thrusters) : 0;
    to(this.jetGain.gain, jets > 0 ? V.thruster.gain * Math.min(1, 0.6 + jets * 0.4) : 0);
    to(this.jetFilter.frequency, V.thruster.cutoff + V.thruster.cutoffPerThruster * Math.min(4, state.thrusters));
    to(this.jetRumbleGain.gain, jets > 0 ? V.thruster.rumbleGain : 0);
    const boosting = input.boosting && state.turbos > 0;
    to(this.hissGain.gain, boosting ? V.turbo.hissGain : 0);

    // Rotors: the pitch and the chop follow the fastest one, the level the number that turn.
    const spinning = state.rotors.filter((r) => r > 0.5).length;
    const fastest = Math.max(0, ...state.rotors);
    to(this.rotorOsc.frequency, V.rotor.base + V.rotor.perRadian * fastest);
    to(this.chopLfo.frequency, (fastest / (2 * Math.PI)) * V.rotor.bladeCount);
    to(this.rotorFilter.frequency, 500 + 40 * fastest);
    to(this.rotorGain.gain, spinning > 0 ? V.rotor.gain * Math.min(1.5, clamp01(fastest / V.rotor.topSpeed) * 1.2 + 0.2) * Math.min(1.5, Math.sqrt(spinning)) : 0);

    // One-shots: a bump, and a piston starting and stopping.
    if (state.impact > V.impact.minChange && t - this.lastImpact > V.impact.minGap) {
      this.lastImpact = t;
      sound.play('thud', { gain: clamp01((state.impact - V.impact.minChange) / (V.impact.maxChange - V.impact.minChange)) * 0.9 + 0.1, pitch: 1.2 - 0.4 * clamp01(state.impact / V.impact.maxChange) });
    }
    if (state.pistonsMoving > 0 && this.pistons === 0) sound.play('pistonStart');
    if (state.pistonsMoving === 0 && this.pistons > 0) sound.play('pistonEnd');
    this.pistons = state.pistonsMoving;
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    this.sources = [];
    this.nodes = [];
  }
}

/**
 * Sound tunables. Every sound is synthesised with the Web Audio API (no audio files): the one-shot effects are the recipes of `SFX`
 * (layers of tones and filtered noise, played by `audio/sound.ts`), the engine, wheels, jets, rotors and the rest of Play are the
 * continuous voices of `VEHICLE_SOUND` (`audio/vehicle-sound.ts`).
 */
export const SOUND = {
  /** localStorage key of the saved settings (`{ muted }`). */
  storageKey: 'blocklab.sound',
  /** Overall level, and the level of the interface / building effects and of the vehicle voices. */
  master: 0.5,
  sfx: 0.9,
  vehicle: 0.8,
  /** Seconds the master level takes to fade when muting / unmuting. */
  muteFade: 0.06,
  /** Seconds of a random white-noise buffer that every noise sound is cut from. */
  noiseSeconds: 2,
  /** Pitch of a one-shot varies by up to this fraction either way, so repeated sounds do not sound mechanical. */
  pitchJitter: 0.04,
  /** Shortest time (s) between two plays of the same effect (a drag that places or paints many parts must not stack them). */
  minGap: 0.045,
} as const;

/** One layer of an effect: an oscillator gliding from one pitch to another, or noise through a filter gliding from one cutoff to another. */
export interface ToneLayer {
  kind: 'tone';
  type: OscillatorType;
  /** Frequencies (Hz) at the start and at the end. */
  from: number;
  to: number;
  /** Length (s) and peak level (0-1). */
  duration: number;
  gain: number;
  /** Seconds before it starts (a second note of a figure) and its fade-in. */
  delay?: number;
  attack?: number;
}
export interface NoiseLayer {
  kind: 'noise';
  filter: BiquadFilterType;
  from: number;
  to: number;
  q?: number;
  duration: number;
  gain: number;
  delay?: number;
  attack?: number;
}
export type SfxLayer = ToneLayer | NoiseLayer;

const tone = (type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0): ToneLayer => ({ kind: 'tone', type, from, to, duration, gain, delay });
const noise = (filter: BiquadFilterType, from: number, to: number, duration: number, gain: number, q = 1, delay = 0): NoiseLayer => ({ kind: 'noise', filter, from, to, duration, gain, q, delay });

/** The one-shot effects, by name. */
export const SFX = {
  // Interface
  // The standard button sound: a short, round sine tap, low enough not to be sharp (the same family as `place`).
  click: [tone('sine', 500, 360, 0.06, 0.45)],
  tick: [tone('sine', 1100, 900, 0.03, 0.22)],
  select: [tone('sine', 1000, 1250, 0.035, 0.22)],
  open: [tone('sine', 380, 640, 0.12, 0.3), noise('bandpass', 1500, 3200, 0.09, 0.08, 1)],
  close: [tone('sine', 640, 380, 0.1, 0.25)],
  confirm: [tone('sine', 523, 523, 0.09, 0.28), tone('sine', 659, 659, 0.09, 0.28, 0.07), tone('sine', 784, 784, 0.16, 0.3, 0.14)],
  error: [tone('square', 150, 105, 0.1, 0.2), noise('lowpass', 500, 300, 0.06, 0.12)],
  // Building
  place: [tone('sine', 260, 430, 0.07, 0.5), noise('bandpass', 1300, 900, 0.035, 0.25, 1), tone('sine', 430, 330, 0.13, 0.22, 0.07)],
  // The same family as `place` (a soft sine pop, a tap of noise, a wobble) but falling: placing rises, removing sinks.
  remove: [tone('sine', 430, 260, 0.07, 0.5), noise('bandpass', 900, 1300, 0.035, 0.22, 1), tone('sine', 260, 195, 0.13, 0.22, 0.07)],
  rotate: [tone('triangle', 620, 710, 0.045, 0.25)],
  tilt: [tone('triangle', 470, 540, 0.045, 0.25)],
  move: [tone('triangle', 450, 450, 0.035, 0.16)],
  // A spray: a short hiss of high noise, the same sound as the turbo's spray (`VEHICLE_SOUND.turbo`), like a can of paint.
  paint: [noise('highpass', 3800, 3800, 0.11, 0.22, 0.7)],
  // Two soft sine notes like `place`, going down for undo and up for redo.
  undo: [tone('sine', 400, 300, 0.07, 0.4), tone('sine', 300, 235, 0.11, 0.25, 0.06)],
  redo: [tone('sine', 300, 400, 0.07, 0.4), tone('sine', 400, 470, 0.11, 0.25, 0.06)],
  // Play
  thud: [tone('sine', 140, 45, 0.2, 0.8), noise('lowpass', 700, 200, 0.14, 0.5)],
  pistonStart: [noise('highpass', 3200, 1600, 0.32, 0.25)],
  // A canopy opening: a soft whoomph of noise that swells and fades, and closing: a short flap.
  chuteOpen: [noise('lowpass', 300, 1100, 0.35, 0.4, 0.8), noise('bandpass', 900, 500, 0.3, 0.2, 1, 0.1)],
  // A stage bolt: a sharp crack and a low thump.
  boltFire: [noise('highpass', 5000, 1800, 0.07, 0.6, 0.8), tone('sine', 160, 55, 0.18, 0.7), noise('lowpass', 900, 200, 0.16, 0.4)],
  chuteClose: [noise('lowpass', 900, 300, 0.18, 0.25, 0.8)],
  pistonEnd: [tone('sine', 95, 60, 0.16, 0.6), noise('lowpass', 520, 260, 0.09, 0.3)],
} as const satisfies Record<string, ReadonlyArray<SfxLayer>>;
export type SfxName = keyof typeof SFX;

/** The voices that run while a vehicle is played. Frequencies in Hz, levels 0-1, times in seconds. */
export const VEHICLE_SOUND = {
  /** How fast the voices follow the changing state of the vehicle (the time constant of the smoothing). */
  smoothing: 0.07,
  engine: {
    /** The pitch at rest and at `topSpeed` (m/s), plus `throttleBoost` when the throttle is down. */
    idle: 52,
    top: 190,
    topSpeed: 22,
    throttleBoost: 38,
    /** The cutoff of the low-pass that darkens it at rest and opens it with the revs. */
    cutoffIdle: 260,
    cutoffTop: 1500,
    gainIdle: 0.07,
    gainLoud: 0.2,
    /** The level of the sub-octave square against the saw, and the shake (rate in Hz, depth in Hz of the pitch). */
    sub: 0.55,
    shakeRate: 6.5,
    shakeDepth: 2.5,
  },
  /** Wheels throwing earth: a band of noise whose pitch and level follow the strength of the dust (see `PlayEffects.rumble`). */
  rumble: { gain: 0.24, cutoffLow: 240, cutoffHigh: 950, q: 0.8 },
  /** Wheels slipping or locked: a thin hiss. */
  skid: { gain: 0.14, freq: 1900, q: 5 },
  /** The brakes squealing: a high saw that falls as the vehicle slows, heard above `minSpeed` (m/s). */
  brake: { gain: 0.07, freq: 1250, fall: 350, minSpeed: 2.5, topSpeed: 20 },
  /** The roar of the thrusters (noise through a low-pass that opens with their number). */
  thruster: { gain: 0.34, cutoff: 700, cutoffPerThruster: 350, rumble: 55, rumbleGain: 0.18 },
  /** The turbos: a spray, a hiss of high noise (above `hissFreq`) while the boost is held. */
  turbo: { hissGain: 0.16, hissFreq: 3800 },
  /** A rotor: a saw whose pitch follows its speed (rad/s), chopped as its blades pass; `perRadian` Hz for each rad/s. */
  /** A propeller: a saw whose pitch follows how fast the blades turn (0-1), chopped as they pass; `bladeHz` is the blade-pass rate at full speed. */
  propeller: { base: 60, pitchRange: 140, gain: 0.12, chop: 0.6, bladeHz: 22 },
  rotor: { base: 40, perRadian: 4.5, gain: 0.13, chop: 0.55, bladeCount: 2, topSpeed: 25 },
  /** An impact is heard when the vehicle's velocity changes by more than `minChange` (m/s) in a step, loudest at `maxChange`. */
  impact: { minChange: 1.4, maxChange: 9, minGap: 0.12 },
} as const;

/** The buttons that click when pressed (the others make their own sound: the modes, undo / redo, rotate, play / stop...). */
export const UI_CLICK_SELECTOR = '#menu button, .dialog button, #part-inspector button, #top-left button, #zoom button, #btn-clear, #menu-saves button';

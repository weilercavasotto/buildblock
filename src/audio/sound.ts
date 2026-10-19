import { SFX, SOUND, SfxLayer, SfxName } from '../constants';

/**
 * The sound engine: one Web Audio context (created on the first sound, resumed by the first click or key, as browsers require), a
 * master level that mutes, a bus for the effects and a bus for the vehicle voices, and the player of the recipes of `SFX`. Everything
 * is synthesised (see `constants/sound.ts`); nothing is loaded. The mute setting is saved in localStorage.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private vehicleBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  private listeners: Array<(muted: boolean) => void> = [];
  private mutedState = loadMuted();
  /** What the settings multiply the bus levels by (0-1). */
  private levels = { master: 1, sfx: 1, vehicle: 1 };

  constructor() {
    // Browsers keep audio suspended until the player does something: the first click / key wakes it.
    const wake = () => {
      void this.context()?.resume();
    };
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, wake, { capture: true, passive: true });
  }

  get muted(): boolean {
    return this.mutedState;
  }

  /** Called with the new state whenever the sound is muted or unmuted. */
  onMuteChange(fn: (muted: boolean) => void): void {
    this.listeners.push(fn);
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    try {
      localStorage.setItem(SOUND.storageKey, JSON.stringify({ muted }));
    } catch {
      /* private mode or blocked storage: the setting just is not kept */
    }
    this.applyLevels(SOUND.muteFade);
    this.listeners.forEach((fn) => fn(muted));
  }

  /** Sets the volume levels from the settings (each 0-1; they multiply the levels of `SOUND`). */
  setLevels(levels: { master: number; sfx: number; vehicle: number }): void {
    this.levels = levels;
    this.applyLevels(SOUND.muteFade);
  }

  private applyLevels(fade: number): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.vehicleBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.mutedState ? 0 : SOUND.master * this.levels.master, t, fade);
    this.sfxBus.gain.setTargetAtTime(SOUND.sfx * this.levels.sfx, t, fade);
    this.vehicleBus.gain.setTargetAtTime(SOUND.vehicle * this.levels.vehicle, t, fade);
  }

  toggleMuted(): void {
    this.setMuted(!this.mutedState);
  }

  /** The audio context, made on first use (null where the browser has no Web Audio). */
  context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    this.ctx = new Context();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.mutedState ? 0 : SOUND.master * this.levels.master;
    const compressor = this.ctx.createDynamicsCompressor(); // many layers at once must not clip
    this.master.connect(compressor).connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SOUND.sfx * this.levels.sfx;
    this.sfxBus.connect(this.master);
    this.vehicleBus = this.ctx.createGain();
    this.vehicleBus.gain.value = SOUND.vehicle * this.levels.vehicle;
    this.vehicleBus.connect(this.master);
    this.noiseBuffer = this.makeNoise(this.ctx);
    return this.ctx;
  }

  /** Where the continuous vehicle voices connect to. */
  get vehicleOutput(): AudioNode | null {
    this.context();
    return this.vehicleBus;
  }

  /** A looping white-noise source, for the continuous voices. */
  createNoiseSource(): AudioBufferSourceNode | null {
    const ctx = this.context();
    if (!ctx || !this.noiseBuffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    return source;
  }

  /**
   * Plays the effect `name`. `pitch` multiplies its frequencies (a heavy part sounds lower), `gain` its level; it varies a little by
   * itself. The same effect is not played again within `SOUND.minGap`.
   */
  play(name: SfxName, { pitch = 1, gain = 1 }: { pitch?: number; gain?: number } = {}): void {
    const ctx = this.context();
    if (!ctx || !this.sfxBus || this.mutedState || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < SOUND.minGap) return;
    this.lastPlayed.set(name, now);
    const jitter = pitch * (1 + (Math.random() * 2 - 1) * SOUND.pitchJitter);
    for (const layer of SFX[name] as ReadonlyArray<SfxLayer>) this.layer(ctx, layer, jitter, gain, now);
  }

  private layer(ctx: AudioContext, layer: SfxLayer, pitch: number, gain: number, now: number): void {
    const start = now + (layer.delay ?? 0);
    const end = start + layer.duration;
    const level = this.envelope(ctx, layer.gain * gain, start, end, layer.attack ?? 0.004);
    level.connect(this.sfxBus!);
    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(layer.from * pitch, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to * pitch), end);
      osc.connect(level);
      osc.start(start);
      osc.stop(end + 0.03);
    } else if (this.noiseBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.Q.value = layer.q ?? 1;
      filter.frequency.setValueAtTime(layer.from * pitch, start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to * pitch), end);
      source.connect(filter).connect(level);
      source.start(start, Math.random() * (SOUND.noiseSeconds - layer.duration - 0.1));
      source.stop(end + 0.03);
    }
  }

  /** A gain that rises to `peak` quickly and falls away to silence by `end`. */
  private envelope(ctx: AudioContext, peak: number, start: number, end: number, attack: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    return g;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * SOUND.noiseSeconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

function loadMuted(): boolean {
  try {
    return JSON.parse(localStorage.getItem(SOUND.storageKey) ?? '{}').muted === true;
  } catch {
    return false;
  }
}

export const sound = new SoundEngine();

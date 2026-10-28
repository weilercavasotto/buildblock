/**
 * The settings of the game (the panel of the gear button, top right): their defaults, where they are saved and what the panel lists.
 * Every value is saved in localStorage; `settings.ts` holds them at run time. The mute switch is the sound engine's own (`sound.muted`).
 */
export const SETTINGS_STORAGE_KEY = 'buildblock.settings';

export const SETTINGS_DEFAULTS = {
  /** The FPS counter (also F3): off until the player turns it on. */
  showFps: false,
  /** The list of keys at the bottom left while playing. */
  showControls: true,
  /** The shadow of the sun (a light, soft look is cheaper without them). */
  shadows: true,
  /** Dust, smoke and flames while playing. */
  effects: true,
  /** Volume levels, 0-1: everything, the interface and building sounds, and the vehicle's voices. */
  volumeMaster: 1,
  volumeSfx: 1,
  volumeVehicle: 1,
} as const;

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;
export type SettingsValues = { [K in SettingKey]: (typeof SETTINGS_DEFAULTS)[K] extends boolean ? boolean : number };

/** One row of the panel: a switch (`toggle`), a volume slider (`slider`, 0-100%) or the mute switch (`mute`, the sound engine's). */
export interface SettingRow {
  kind: 'toggle' | 'slider' | 'mute';
  /** Which setting it changes (not for `mute`). */
  key?: SettingKey;
  label: string;
  hint?: string;
}

export const SETTINGS_PANEL: ReadonlyArray<{ heading: string; rows: ReadonlyArray<SettingRow> }> = [
  {
    heading: 'Sound',
    rows: [
      { kind: 'mute', label: 'Sound', hint: 'The M key does the same.' },
      { kind: 'slider', key: 'volumeMaster', label: 'Volume' },
      { kind: 'slider', key: 'volumeSfx', label: 'Interface and building' },
      { kind: 'slider', key: 'volumeVehicle', label: 'Vehicle' },
    ],
  },
  {
    heading: 'Display',
    rows: [
      { kind: 'toggle', key: 'showFps', label: 'FPS counter', hint: 'F3 shows or hides it.' },
      { kind: 'toggle', key: 'showControls', label: 'Controls while playing', hint: 'The keys of your parts, at the bottom left.' },
    ],
  },
  {
    heading: 'Graphics',
    rows: [
      { kind: 'toggle', key: 'shadows', label: 'Shadows', hint: 'Turn them off if the game runs slowly.' },
      { kind: 'toggle', key: 'effects', label: 'Dust, smoke and flames', hint: 'The particles while playing.' },
    ],
  },
];

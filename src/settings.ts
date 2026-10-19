import { SETTINGS_DEFAULTS, SETTINGS_STORAGE_KEY, SettingKey, SettingsValues } from './constants';

/**
 * The settings of the game at run time, loaded from localStorage and saved on every change (see `constants/settings.ts`). A saved
 * value of the wrong kind is ignored. The game applies them by listening with `subscribe`.
 */
class Settings {
  private values: SettingsValues = { ...SETTINGS_DEFAULTS } as SettingsValues;
  private listeners: Array<() => void> = [];

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
      for (const key of Object.keys(SETTINGS_DEFAULTS) as SettingKey[]) {
        const value = saved[key];
        if (typeof value === typeof SETTINGS_DEFAULTS[key] && (typeof value !== 'number' || (value >= 0 && value <= 1))) (this.values as Record<string, unknown>)[key] = value;
      }
    } catch {
      /* no saved settings, or unreadable: the defaults stay */
    }
  }

  get<K extends SettingKey>(key: K): SettingsValues[K] {
    return this.values[key];
  }

  set<K extends SettingKey>(key: K, value: SettingsValues[K]): void {
    if (this.values[key] === value) return;
    this.values[key] = value;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* private mode or blocked storage: the setting just is not kept */
    }
    this.listeners.forEach((fn) => fn());
  }

  /** Called whenever any setting changes. */
  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }
}

export const settings = new Settings();

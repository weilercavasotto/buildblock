import { SETTINGS_STORAGE_KEY, SOUND, STORAGE } from './constants';

/**
 * The project was called BlockLab before it was BuildBlock, and its `localStorage` keys started with `blocklab.`. This moves what a browser
 * already holds under the old names to the new ones, once: a value is copied only when the new key is empty and the old key is removed
 * afterwards, so nothing is lost and nothing is overwritten. It runs as soon as it is imported, and `main.ts` imports it first, so every
 * module that reads the storage afterwards (the saves, the settings, the hotbar, the sound, the onboarding) already finds the new keys.
 * (`STORAGE.legacyKey`, the single-slot save of the very first version, keeps its old name: `save.ts` still migrates it.)
 */
const RENAMED: ReadonlyArray<readonly [string, string]> = [
  ['blocklab.saves.v2', STORAGE.savesKey],
  ['blocklab.hotbar.v1', STORAGE.hotbarKey],
  ['blocklab.onboarding.v1', STORAGE.onboardingKey],
  ['blocklab.settings', SETTINGS_STORAGE_KEY],
  ['blocklab.sound', SOUND.storageKey],
];

try {
  for (const [from, to] of RENAMED) {
    const value = localStorage.getItem(from);
    if (value === null) continue;
    if (localStorage.getItem(to) === null) localStorage.setItem(to, value);
    if (localStorage.getItem(to) !== null) localStorage.removeItem(from);
  }
} catch {
  /* storage unavailable or full: the game starts with the defaults, as it does without a storage */
}

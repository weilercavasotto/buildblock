import { Part } from './types';

export interface SaveGame {
  id: string;
  name: string;
  updatedAt: number;
  parts: Part[];
}

const STORAGE_KEY = 'blocklab.saves.v2';
const LEGACY_KEY = 'blocklab.v1';

function readAll(): SaveGame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      return Array.isArray(data) ? (data as SaveGame[]) : [];
    }
    // One-time migration of the single-slot save used before the main menu existed.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parts = JSON.parse(legacy) as Part[];
      const saves: SaveGame[] = parts.length
        ? [{ id: newId(), name: 'My creation', updatedAt: Date.now(), parts }]
        : [];
      writeAll(saves);
      localStorage.removeItem(LEGACY_KEY);
      return saves;
    }
  } catch {
    /* corrupted or unavailable storage */
  }
  return [];
}

function writeAll(saves: SaveGame[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch {
    /* storage unavailable or full */
  }
}

const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** All saves, most recently updated first. */
export function listSaves(): SaveGame[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSave(id: string): SaveGame | undefined {
  return readAll().find((s) => s.id === id);
}

export function createSave(name: string): SaveGame {
  const save: SaveGame = { id: newId(), name, updatedAt: Date.now(), parts: [] };
  writeAll([...readAll(), save]);
  return save;
}

export function updateSave(id: string, parts: Part[]): void {
  const saves = readAll();
  const save = saves.find((s) => s.id === id);
  if (!save) return;
  save.parts = parts;
  save.updatedAt = Date.now();
  writeAll(saves);
}

export function deleteSave(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

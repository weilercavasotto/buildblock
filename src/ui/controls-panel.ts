import { PLAY_CONTROLS, PART_KEY_LABELS, TEXT, isKeyed, keyLabel } from '../constants';
import { Part } from '../types';

/** The commands of the keys the player gave to parts: the keys with what they run (several parts on one key are counted), in key order. */
function partKeyRows(parts: ReadonlyArray<Part>): Array<{ keys: string[]; label: string }> {
  const byKey = new Map<string, Map<string, number>>();
  for (const part of parts) {
    if (!isKeyed(part) || !part.key) continue;
    const label = PART_KEY_LABELS[part.type] ?? part.type;
    const group = byKey.get(part.key) ?? new Map<string, number>();
    group.set(label, (group.get(label) ?? 0) + 1);
    byKey.set(part.key, group);
  }
  return [...byKey]
    .map(([code, group]) => ({ keys: [keyLabel(code)], label: [...group].map(([label, n]) => (n > 1 ? `${n} × ${label}` : label)).join(' + ') }))
    .sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
}

/**
 * The panel at the bottom left in Play mode: the keys that drive the creation, only for the parts it has: the driving keys for wheels
 * and the flight keys for thrusters (`PLAY_CONTROLS`), then the keys the player gave to the rotors, pistons, thrusters, turbos and brakes,
 * grouped by key ("G  3 × Pistons out / back"). Parts that need a key and have none are counted at the bottom. Hidden when no row
 * applies. All text is set with `textContent`.
 */
export class ControlsPanel {
  private root = document.getElementById('controls-panel')!;
  private enabled = true;
  private parts: ReadonlyArray<Part> | null = null;

  /** Lists the commands of the parts in `parts` (the creation that is about to be played). */
  show(parts: ReadonlyArray<Part>): void {
    this.parts = parts;
    const rows = this.enabled
      ? [...PLAY_CONTROLS.filter((control) => control.when(parts)), ...partKeyRows(parts)]
      : [];
    const unbound = this.enabled ? parts.filter((p) => isKeyed(p) && !p.key).length : 0;
    this.root.hidden = rows.length === 0 && unbound === 0;
    if (this.root.hidden) return;
    const title = document.createElement('h3');
    title.className = 'controls-title';
    title.textContent = TEXT.hud.controlsTitle;
    const list = document.createElement('dl');
    list.className = 'controls-list';
    for (const row of rows) {
      const keys = document.createElement('dt');
      row.keys.forEach((key, i) => {
        if (i > 0) keys.append(document.createTextNode(' '));
        const cap = document.createElement('kbd');
        cap.textContent = key;
        keys.append(cap);
      });
      const label = document.createElement('dd');
      label.textContent = row.label;
      list.append(keys, label);
    }
    this.root.replaceChildren(title, list);
    if (unbound > 0) {
      const warning = document.createElement('p');
      warning.className = 'controls-warning';
      warning.textContent = `${TEXT.hud.unboundControls(unbound)}. ${TEXT.hud.unboundHint}`;
      this.root.append(warning);
    }
  }

  hide(): void {
    this.parts = null;
    this.root.hidden = true;
  }

  /** The settings switch the panel on and off; while playing it follows at once. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.parts) this.show(this.parts);
  }
}

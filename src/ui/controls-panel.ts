import { PLAY_CONTROLS, TEXT } from '../constants';
import { Part } from '../types';

/**
 * The panel at the bottom left in Play mode: the keys that drive the creation, only for the parts it has (`PLAY_CONTROLS`): wheels
 * give the driving keys, a brake or a thruster Space, a turbo Shift, a rotor F. Hidden when no row applies. All text is set with
 * `textContent`.
 */
export class ControlsPanel {
  private root = document.getElementById('controls-panel')!;
  private enabled = true;
  private parts: ReadonlyArray<Part> | null = null;

  /** Lists the commands of the parts in `parts` (the creation that is about to be played). */
  show(parts: ReadonlyArray<Part>): void {
    this.parts = parts;
    const rows = this.enabled ? PLAY_CONTROLS.filter((control) => control.when(parts)) : [];
    this.root.hidden = rows.length === 0;
    if (rows.length === 0) return;
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

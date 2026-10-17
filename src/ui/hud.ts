import { CURSOR_MODES, TEXT } from '../constants';
import { CursorMode } from '../types';

export interface HudHandlers {
  onTogglePlay(): void;
  onReset(): void;
  onClear(): void;
  onMenu(): void;
  onHelp(): void;
  /** Opens the saved-games panel over the current game. */
  onSaves(): void;
  onUndo(): void;
  onMode(mode: CursorMode): void;
  onRotate(direction: 1 | -1): void;
  onTilt(direction: 1 | -1): void;
  onRedo(): void;
}

export class Hud {
  private playButton = document.getElementById('btn-play')!;
  private helpButton = document.getElementById('help-button')!;
  private hotbar = document.getElementById('hotbar')!;
  private topLeft = document.getElementById('top-left')!;
  private topBar = document.getElementById('top-bar')!;
  /** Parts of the top bar that only make sense while building (undo, redo, clear). */
  private buildOnly = document.querySelectorAll<HTMLElement>('.build-only');
  private undoButton = document.getElementById('btn-undo') as HTMLButtonElement;
  private redoButton = document.getElementById('btn-redo') as HTMLButtonElement;
  /** Parts of the top bar that only make sense while playing (reset). */
  private playOnly = document.querySelectorAll<HTMLElement>('.play-only');
  private notice = document.getElementById('play-notice')!;
  private visible = true;
  private mode: 'build' | 'play' = 'build';

  constructor(handlers: HudHandlers) {
    document.getElementById('btn-clear')!.onclick = handlers.onClear;
    this.playButton.onclick = handlers.onTogglePlay;
    const reset = document.getElementById('btn-reset')!;
    reset.onclick = handlers.onReset;
    reset.textContent = TEXT.hud.resetLabel;
    reset.title = TEXT.hud.reset;
    document.getElementById('btn-menu')!.onclick = handlers.onMenu;
    document.getElementById('btn-saves')!.onclick = handlers.onSaves;
    this.helpButton.onclick = handlers.onHelp;
    this.createModeButtons(handlers.onMode);
    this.setupRotateButtons(handlers.onRotate, handlers.onTilt);
    this.undoButton.onclick = handlers.onUndo;
    this.redoButton.onclick = handlers.onRedo;
    this.setMode('build');
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.updateVisibility();
  }

  private rotateButtons = [
    document.getElementById('btn-rotate-left') as HTMLButtonElement,
    document.getElementById('btn-rotate-right') as HTMLButtonElement,
  ];

  private tiltButtons = [
    document.getElementById('btn-tilt-up') as HTMLButtonElement,
    document.getElementById('btn-tilt-down') as HTMLButtonElement,
  ];

  private setupRotateButtons(onRotate: (direction: 1 | -1) => void, onTilt: (direction: 1 | -1) => void): void {
    document.getElementById('rotate-group')!.setAttribute('aria-label', TEXT.rotation.group);
    const [left, right] = this.rotateButtons;
    left.onclick = () => onRotate(-1);
    right.onclick = () => onRotate(1);
    this.tiltButtons[0].onclick = () => onTilt(1);
    this.tiltButtons[1].onclick = () => onTilt(-1);
    this.setRotateEnabled(true);
    this.setTiltEnabled(true);
  }

  /** The rotate buttons only work in Build mode with a rotatable part selected; otherwise they are dimmed. */
  setRotateEnabled(enabled: boolean): void {
    const [left, right] = this.rotateButtons;
    for (const [button, label, key] of [
      [left, TEXT.rotation.left, 'A'],
      [right, TEXT.rotation.right, 'D'],
    ] as const) {
      button.disabled = !enabled;
      button.title = enabled ? TEXT.rotation.tooltip(label, key) : `${TEXT.rotation.tooltip(label, key)}: ${TEXT.rotation.unavailable}`;
      button.setAttribute('aria-label', TEXT.rotation.tooltip(label, key));
    }
  }

  /** The tilt buttons (up / down) work with the parts that can be tilted; otherwise they are dimmed. */
  setTiltEnabled(enabled: boolean): void {
    const [up, down] = this.tiltButtons;
    for (const [button, label, key] of [
      [up, TEXT.rotation.tiltUp, 'W / ↑'],
      [down, TEXT.rotation.tiltDown, 'S / ↓'],
    ] as const) {
      button.disabled = !enabled;
      button.title = enabled ? TEXT.rotation.tooltip(label, key) : `${TEXT.rotation.tooltip(label, key)}: ${TEXT.rotation.tiltUnavailable}`;
      button.setAttribute('aria-label', TEXT.rotation.tooltip(label, key));
    }
  }

  /** Highlights the button of the active cursor mode. */
  setCursorMode(mode: CursorMode): void {
    document.querySelectorAll<HTMLElement>('#mode-switch button').forEach((el) => {
      el.classList.toggle('active', el.dataset.mode === mode);
      el.setAttribute('aria-pressed', String(el.dataset.mode === mode));
    });
  }

  private createModeButtons(onMode: (mode: CursorMode) => void): void {
    const group = document.getElementById('mode-switch')!;
    group.setAttribute('aria-label', TEXT.modes.group);
    for (const mode of CURSOR_MODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `mode-${mode.id}`;
      button.dataset.mode = mode.id;
      button.title = TEXT.modes.tooltip(mode.label, mode.key, mode.description);
      const key = document.createElement('kbd');
      key.textContent = mode.key;
      // An icon instead of the name; the tooltip and aria-label (below) still say it.
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('width', '18');
      icon.setAttribute('height', '18');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = mode.icon; // trusted constant (src/constants/cursor-modes.ts)
      button.append(key, icon);
      button.setAttribute('aria-label', `${mode.label} (${mode.key})`);
      button.onclick = () => onMode(mode.id);
      group.append(button);
    }
  }

  setHistoryState(canUndo: boolean, canRedo: boolean): void {
    this.undoButton.disabled = !canUndo;
    this.redoButton.disabled = !canRedo;
  }

  /**
   * Menu: nothing is shown. Build: top-left buttons, top bar and the hotbar. Play: top-left buttons and a top bar with
   * only Play/Stop.
   */
  private updateVisibility(): void {
    const building = this.mode === 'build';
    this.topLeft.hidden = this.topBar.hidden = !this.visible;
    this.hotbar.hidden = !this.visible || !building;
    this.buildOnly.forEach((el) => (el.hidden = !building));
    this.playOnly.forEach((el) => (el.hidden = building));
  }

  /** Shows a short message under the top bar (while playing), or hides it with null. */
  setNotice(message: string | null): void {
    this.notice.hidden = message === null;
    this.notice.textContent = message ?? '';
  }

  setMode(mode: 'build' | 'play'): void {
    this.mode = mode;
    if (mode === 'build') this.setNotice(null);
    this.updateVisibility();
    const playing = mode === 'play';
    this.playButton.textContent = playing ? TEXT.hud.stop : TEXT.hud.play;
    this.playButton.title = playing ? TEXT.hud.stopTooltip : TEXT.hud.playTooltip;
    this.playButton.classList.toggle('playing', playing);
  }
}

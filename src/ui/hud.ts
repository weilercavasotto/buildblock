import { TEXT } from '../constants';
import { PartType } from '../types';

export interface HudHandlers {
  onTool(tool: PartType): void;
  onTogglePlay(): void;
  onClear(): void;
  onMenu(): void;
  onHelp(): void;
  onUndo(): void;
  onRedo(): void;
}

export class Hud {
  private toolButtons: Record<PartType, HTMLElement>;
  private playButton = document.getElementById('btn-play')!;
  private helpButton = document.getElementById('help-button')!;
  private root = document.getElementById('hud')!;
  private topLeft = document.getElementById('top-left')!;
  private topBar = document.getElementById('top-bar')!;
  /** Parts of the top bar that only make sense while building (undo, redo, clear). */
  private buildOnly = document.querySelectorAll<HTMLElement>('.build-only');
  private undoButton = document.getElementById('btn-undo') as HTMLButtonElement;
  private redoButton = document.getElementById('btn-redo') as HTMLButtonElement;
  private visible = true;
  private mode: 'build' | 'play' = 'build';

  constructor(handlers: HudHandlers) {
    this.toolButtons = {
      block: document.getElementById('tool-block')!,
      wheel: document.getElementById('tool-wheel')!,
    };
    this.toolButtons.block.onclick = () => handlers.onTool('block');
    this.toolButtons.wheel.onclick = () => handlers.onTool('wheel');
    document.getElementById('btn-clear')!.onclick = handlers.onClear;
    this.playButton.onclick = handlers.onTogglePlay;
    document.getElementById('btn-menu')!.onclick = handlers.onMenu;
    this.helpButton.onclick = handlers.onHelp;
    this.undoButton.onclick = handlers.onUndo;
    this.redoButton.onclick = handlers.onRedo;
    this.setMode('build');
  }

  setTool(tool: PartType): void {
    for (const [name, el] of Object.entries(this.toolButtons)) el.classList.toggle('active', name === tool);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.updateVisibility();
  }

  setHistoryState(canUndo: boolean, canRedo: boolean): void {
    this.undoButton.disabled = !canUndo;
    this.redoButton.disabled = !canRedo;
  }

  /**
   * Menu: nothing is shown. Build: top-left buttons, top bar and the tools. Play: top-left buttons and a top bar with
   * only Play/Stop.
   */
  private updateVisibility(): void {
    const building = this.mode === 'build';
    this.topLeft.hidden = this.topBar.hidden = !this.visible;
    this.root.hidden = !this.visible || !building;
    this.buildOnly.forEach((el) => (el.hidden = !building));
  }

  setMode(mode: 'build' | 'play'): void {
    this.mode = mode;
    this.updateVisibility();
    const playing = mode === 'play';
    this.playButton.textContent = playing ? TEXT.hud.stop : TEXT.hud.play;
    this.playButton.classList.toggle('playing', playing);
  }
}

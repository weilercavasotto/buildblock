import { TEXT } from '../constants';
import { PartType } from '../types';

export interface HudHandlers {
  onTool(tool: PartType): void;
  onTogglePlay(): void;
  onClear(): void;
  onMenu(): void;
  onUndo(): void;
  onRedo(): void;
}

export class Hud {
  private toolButtons: Record<PartType, HTMLElement>;
  private playButton = document.getElementById('btn-play')!;
  private tools = document.getElementById('tools')!;
  private hint = document.getElementById('hint')!;
  private root = document.getElementById('hud')!;
  private historyBar = document.getElementById('history')!;
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
    this.undoButton.onclick = handlers.onUndo;
    this.redoButton.onclick = handlers.onRedo;
    this.setMode('build');
  }

  setTool(tool: PartType): void {
    for (const [name, el] of Object.entries(this.toolButtons)) el.classList.toggle('active', name === tool);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = this.hint.hidden = !visible;
    this.updateHistoryBar();
  }

  setHistoryState(canUndo: boolean, canRedo: boolean): void {
    this.undoButton.disabled = !canUndo;
    this.redoButton.disabled = !canRedo;
  }

  /** Undo/redo only make sense while building. */
  private updateHistoryBar(): void {
    this.historyBar.hidden = !this.visible || this.mode !== 'build';
  }

  setMode(mode: 'build' | 'play'): void {
    this.mode = mode;
    this.updateHistoryBar();
    const playing = mode === 'play';
    this.tools.style.display = playing ? 'none' : 'flex';
    this.playButton.textContent = playing ? TEXT.hud.stop : TEXT.hud.play;
    this.playButton.classList.toggle('playing', playing);
    this.hint.innerHTML = playing ? TEXT.hud.playHint : TEXT.hud.buildHint;
  }
}

import { TEXT } from '../constants';
import { PartType } from '../types';

export interface HudHandlers {
  onTool(tool: PartType): void;
  onTogglePlay(): void;
  onClear(): void;
  onMenu(): void;
}

export class Hud {
  private toolButtons: Record<PartType, HTMLElement>;
  private playButton = document.getElementById('btn-play')!;
  private tools = document.getElementById('tools')!;
  private hint = document.getElementById('hint')!;
  private root = document.getElementById('hud')!;

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
    this.setMode('build');
  }

  setTool(tool: PartType): void {
    for (const [name, el] of Object.entries(this.toolButtons)) el.classList.toggle('active', name === tool);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = this.hint.hidden = !visible;
  }

  setMode(mode: 'build' | 'play'): void {
    const playing = mode === 'play';
    this.tools.style.display = playing ? 'none' : 'flex';
    this.playButton.textContent = playing ? TEXT.hud.stop : TEXT.hud.play;
    this.playButton.classList.toggle('playing', playing);
    this.hint.innerHTML = playing ? TEXT.hud.playHint : TEXT.hud.buildHint;
  }
}

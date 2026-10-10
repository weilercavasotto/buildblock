import { SaveGame, deleteSave, listSaves } from '../save';

export interface MenuHandlers {
  onLoad(id: string): void;
  onNew(name: string): void;
}

export class Menu {
  private root = document.getElementById('menu')!;
  private main = document.getElementById('menu-main')!;
  private saves = document.getElementById('menu-saves')!;
  private list = document.getElementById('save-list')!;
  private nameInput = document.getElementById('new-name') as HTMLInputElement;

  constructor(private handlers: MenuHandlers) {
    document.getElementById('menu-play')!.onclick = () => this.showSaves();
    document.getElementById('menu-back')!.onclick = () => this.showMain();
    document.getElementById('new-create')!.onclick = () => this.create();
    this.nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') this.create();
    };
  }

  show(): void {
    this.root.classList.add('open');
    this.showMain();
  }

  hide(): void {
    this.root.classList.remove('open');
  }

  private showMain(): void {
    this.main.hidden = false;
    this.saves.hidden = true;
  }

  private showSaves(): void {
    this.main.hidden = true;
    this.saves.hidden = false;
    this.nameInput.value = '';
    this.renderList();
  }

  private create(): void {
    const name = this.nameInput.value.trim() || `Creation ${listSaves().length + 1}`;
    this.handlers.onNew(name);
  }

  private renderList(): void {
    this.list.replaceChildren();
    const saves = listSaves();
    if (saves.length === 0) {
      const empty = document.createElement('div');
      empty.id = 'save-empty';
      empty.textContent = 'No saved games yet. Start a new one below.';
      this.list.append(empty);
      return;
    }
    for (const save of saves) this.list.append(this.renderItem(save));
  }

  private renderItem(save: SaveGame): HTMLElement {
    const item = document.createElement('div');
    item.className = 'save-item';

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = save.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const parts = save.parts.length === 1 ? '1 part' : `${save.parts.length} parts`;
    meta.textContent = `${parts} · ${new Date(save.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`;
    info.append(name, meta);

    const load = document.createElement('button');
    load.className = 'primary';
    load.textContent = 'Load';
    load.onclick = () => this.handlers.onLoad(save.id);

    const remove = document.createElement('button');
    remove.className = 'danger';
    remove.textContent = 'Delete';
    remove.onclick = () => {
      if (confirm(`Delete "${save.name}"? This cannot be undone.`)) {
        deleteSave(save.id);
        this.renderList();
      }
    };

    item.append(info, load, remove);
    return item;
  }
}

import { SAVE, TEXT } from '../constants';
import { SaveGame, deleteSave, listSaves } from '../save';
import { confirmDialog } from './confirm-dialog';

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
    document.getElementById('menu-version')!.textContent = TEXT.menu.version(__APP_VERSION__);
    this.nameInput.maxLength = SAVE.nameMaxLength;
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
    const name = this.nameInput.value.trim() || TEXT.menu.defaultSaveName(listSaves().length + 1);
    this.handlers.onNew(name);
  }

  private renderList(): void {
    this.list.replaceChildren();
    const saves = listSaves();
    if (saves.length === 0) {
      const empty = document.createElement('div');
      empty.id = 'save-empty';
      empty.textContent = TEXT.menu.noSaves;
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
    const date = new Date(save.updatedAt).toLocaleString(TEXT.menu.dateLocale, { dateStyle: 'medium', timeStyle: 'short' });
    meta.textContent = `${TEXT.menu.parts(save.parts.length)} · ${date}`;
    info.append(name, meta);

    const load = document.createElement('button');
    load.className = 'primary';
    load.textContent = TEXT.menu.load;
    load.onclick = () => this.handlers.onLoad(save.id);

    const remove = document.createElement('button');
    remove.className = 'danger';
    remove.textContent = TEXT.menu.delete;
    remove.onclick = async () => {
      const { title, message, confirm, cancel } = TEXT.menu.deleteDialog;
      const confirmed = await confirmDialog({
        title,
        message: message(save.name),
        confirmLabel: confirm,
        cancelLabel: cancel,
        danger: true,
      });
      if (confirmed) {
        deleteSave(save.id);
        this.renderList();
      }
    };

    item.append(info, load, remove);
    return item;
  }
}

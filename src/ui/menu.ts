import { DEFAULT_GRID_CELLS, GRID_SIZES, SAVE, TEXT } from '../constants';
import { SaveGame, deleteSave, gridCellsOf, listSaves } from '../save';
import { savePreviewUrl } from './save-preview';
import { confirmDialog } from './confirm-dialog';

export interface MenuHandlers {
  onLoad(id: string): void;
  /** `name` is already defaulted; `gridCells` is one of `GRID_SIZES`. */
  onNew(name: string, gridCells: number): void;
}

export class Menu {
  private root = document.getElementById('menu')!;
  private main = document.getElementById('menu-main')!;
  private saves = document.getElementById('menu-saves')!;
  private newGame = document.getElementById('menu-new')!;
  private sizes = document.getElementById('grid-size')!;
  private gridCells = DEFAULT_GRID_CELLS;
  private list = document.getElementById('save-list')!;
  private nameInput = document.getElementById('new-name') as HTMLInputElement;
  /** True while the saved-games panel is open over a game (the button beside Home) instead of being part of the main menu. */
  private overlay = false;

  constructor(private handlers: MenuHandlers) {
    document.getElementById('menu-version')!.textContent = TEXT.menu.version(__APP_VERSION__);
    this.nameInput.maxLength = SAVE.nameMaxLength;
    document.getElementById('menu-play')!.onclick = () => this.showSaves();
    document.getElementById('menu-back')!.onclick = () => (this.overlay ? this.hide() : this.showMain());
    document.getElementById('menu-back')!.textContent = TEXT.menu.back;
    const open = document.getElementById('new-open')!;
    open.textContent = TEXT.menu.newGame;
    open.onclick = () => this.showNewGame();
    document.getElementById('new-back')!.textContent = TEXT.menu.back;
    document.getElementById('new-back')!.onclick = () => this.showSaves();
    document.getElementById('new-create')!.textContent = TEXT.menu.newGamePanel.create;
    document.getElementById('new-create')!.onclick = () => this.create();
    this.renderSizes();
    this.nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') this.create();
    };
    // Esc closes the panel opened over a game (from "New game" it goes back to the list first).
    addEventListener('keydown', (e) => {
      if (!this.overlay || e.code !== 'Escape') return;
      if (this.newGame.hidden) this.hide();
      else this.showSaves();
    });
  }

  /** Is the saved-games panel open over a game? (the game's shortcuts must wait) */
  get overGame(): boolean {
    return this.overlay;
  }

  /** Opens the saved-games panel (the same as the main menu's) over the current game. */
  openSaves(): void {
    this.overlay = true;
    this.root.classList.add('open', 'over-game');
    this.showSaves();
  }

  show(): void {
    this.overlay = false;
    this.root.classList.add('open');
    this.showMain();
  }

  hide(): void {
    this.overlay = false;
    this.root.classList.remove('open', 'over-game');
  }

  private showMain(): void {
    this.main.hidden = false;
    this.saves.hidden = true;
    this.newGame.hidden = true;
  }

  private showSaves(): void {
    this.main.hidden = true;
    this.saves.hidden = false;
    this.newGame.hidden = true;
    this.renderList();
  }

  /** The "New game" panel: a name (optional, defaults to "Creation N") and the grid size. */
  private showNewGame(): void {
    this.main.hidden = true;
    this.saves.hidden = true;
    this.newGame.hidden = false;
    this.nameInput.value = '';
    this.nameInput.placeholder = TEXT.menu.newGamePanel.namePlaceholder(this.defaultName());
    this.selectSize(DEFAULT_GRID_CELLS);
    this.nameInput.focus();
  }

  private defaultName(): string {
    return TEXT.menu.defaultSaveName(listSaves().length + 1);
  }

  private create(): void {
    this.handlers.onNew(this.nameInput.value.trim() || this.defaultName(), this.gridCells);
  }

  /** One radio-style card per `GRID_SIZES` entry. */
  private renderSizes(): void {
    for (const size of GRID_SIZES) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'grid-size-option';
      option.dataset.cells = String(size.cells);
      option.setAttribute('role', 'radio');
      const name = document.createElement('span');
      name.className = 'size-name';
      name.textContent = size.name;
      const cells = document.createElement('span');
      cells.className = 'size-cells';
      cells.textContent = TEXT.menu.gridSize(size.cells);
      option.append(name, cells);
      option.onclick = () => this.selectSize(size.cells);
      this.sizes.append(option);
    }
  }

  private selectSize(cells: number): void {
    this.gridCells = cells;
    this.sizes.querySelectorAll<HTMLElement>('.grid-size-option').forEach((el) => {
      const selected = el.dataset.cells === String(cells);
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-checked', String(selected));
    });
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

    // The picture of the creation on the floor, drawn just after the list is shown so a long list does not hold up the panel.
    const preview = document.createElement('img');
    preview.className = 'save-preview';
    preview.alt = TEXT.menu.previewAlt(save.name);
    preview.draggable = false;
    setTimeout(() => (preview.src = savePreviewUrl(save)), 0);

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = save.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const date = new Date(save.updatedAt).toLocaleString(TEXT.menu.dateLocale, { dateStyle: 'medium', timeStyle: 'short' });
    meta.textContent = `${TEXT.menu.parts(save.parts.length)} · ${TEXT.menu.gridSize(gridCellsOf(save))} · ${date}`;
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

    item.append(preview, info, load, remove);
    return item;
  }
}

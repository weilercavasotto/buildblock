import { HOTBAR, PART_INFO, SIZE, STORAGE, TEXT } from '../constants';
import { PartType } from '../types';
import { DragSource, enableDrag } from './drag-drop';
import { createPreviewCanvas, renderPartPreview } from './part-preview';

type Slot = PartType | null;

const isPartType = (value: unknown): value is PartType => typeof value === 'string' && value in PART_INFO;

/**
 * The hotbar: `HOTBAR.slots` slots (keys 1-9) that each hold a part to place, plus a button that opens the catalog.
 * The selected slot decides what the left button places (an empty slot places nothing). Slots can be rearranged by
 * dragging (dropping on another slot swaps them), cleared with a right click, and filled from the catalog by dragging.
 * The layout and the selected slot are kept in localStorage.
 */
export class Hotbar {
  private slots: Slot[];
  private selected = 0;
  private slotEls: HTMLButtonElement[] = [];
  private listeners: Array<(part: PartType | null) => void> = [];
  private layoutListeners: Array<() => void> = [];
  private userSelectListeners: Array<() => void> = [];

  private root = document.getElementById('hotbar-slots')!;
  private label = document.getElementById('hotbar-label')!;

  constructor(openCatalog: () => void) {
    this.slots = this.load();
    for (let i = 0; i < HOTBAR.slots; i++) this.slotEls.push(this.createSlot(i));
    this.root.replaceChildren(...this.slotEls);
    const catalogButton = document.getElementById('catalog-button')!;
    catalogButton.title = TEXT.hotbar.catalog;
    catalogButton.setAttribute('aria-label', TEXT.hotbar.catalog);
    catalogButton.onclick = openCatalog;
    this.renderAll();
  }

  /** Called with the part to place whenever the selected slot or its content changes (null = empty slot). */
  subscribe(fn: (part: PartType | null) => void): void {
    this.listeners.push(fn);
    fn(this.current);
  }

  /** Called when a slot is selected on purpose (key, click or the catalog), as opposed to its content changing. */
  onUserSelect(fn: () => void): void {
    this.userSelectListeners.push(fn);
  }

  /** Called after any change of the slots or of the selected slot. Returns a function that unsubscribes. */
  onLayoutChange(fn: () => void): () => void {
    this.layoutListeners.push(fn);
    return () => (this.layoutListeners = this.layoutListeners.filter((l) => l !== fn));
  }

  get current(): PartType | null {
    return this.slots[this.selected];
  }

  get selectedIndex(): number {
    return this.selected;
  }

  slotOf(type: PartType): number[] {
    return this.slots.flatMap((s, i) => (s === type ? [i] : []));
  }

  select(index: number): void {
    if (index < 0 || index >= HOTBAR.slots) return;
    this.selected = index;
    this.renderAll();
    this.changed();
    this.userSelectListeners.forEach((fn) => fn());
  }

  assign(index: number, type: Slot): void {
    this.slots[index] = type;
    this.renderAll();
    if (index === this.selected) this.notify();
    this.save();
  }

  /** Swaps the contents of two slots. */
  swap(a: number, b: number): void {
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    this.renderAll();
    this.changed();
  }

  /**
   * Puts `type` in the hotbar and returns its slot: the slot that already holds it, else the first empty one, else the
   * selected slot (which it replaces).
   */
  add(type: PartType): number {
    const existing = this.slots.indexOf(type);
    if (existing >= 0) return existing;
    const empty = this.slots.indexOf(null);
    const index = empty >= 0 ? empty : this.selected;
    this.assign(index, type);
    return index;
  }

  /** Raised above a modal's backdrop while the catalog is open so parts can be dropped on it. */
  setRaised(raised: boolean): void {
    document.getElementById('hotbar')!.classList.toggle('over-dialog', raised);
  }

  private createSlot(index: number): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot';
    el.dataset.slot = String(index);
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.assign(index, null);
    });
    enableDrag(el, {
      source: () => (this.slots[index] ? { type: this.slots[index]!, slot: index } : null),
      image: () => el.querySelector('canvas'),
      onClick: () => this.select(index), // also for empty slots (they are only not draggable)
      onDrop: (source: DragSource, target) => this.dropOnSlot(source, target),
    });
    return el;
  }

  private dropOnSlot(source: DragSource, target: number | null): void {
    if (target === null) {
      if (source.slot !== undefined) this.assign(source.slot, null); // dragged out of the bar: remove
      return;
    }
    if (source.slot !== undefined) this.swap(source.slot, target);
    else this.assign(target, source.type);
  }

  private renderAll(): void {
    this.slotEls.forEach((el, i) => this.renderSlot(el, i));
    // The name of the selected part shows above the bar (nothing for an empty slot).
    const current = this.current;
    this.label.hidden = current === null;
    this.label.textContent = current ? PART_INFO[current].name : '';
    this.layoutListeners.forEach((fn) => fn());
  }

  private renderSlot(el: HTMLButtonElement, index: number): void {
    const type = this.slots[index];
    el.classList.toggle('selected', index === this.selected);
    el.setAttribute('aria-pressed', String(index === this.selected));
    el.setAttribute('aria-label', type ? TEXT.hotbar.slot(index + 1, PART_INFO[type].name) : TEXT.hotbar.emptySlot(index + 1));
    el.title = el.getAttribute('aria-label')!;

    el.replaceChildren();
    const key = document.createElement('span');
    key.className = 'slot-key';
    key.textContent = String(index + 1);
    el.append(key);
    if (type) {
      const canvas = createPreviewCanvas(SIZE.hotbarPreview);
      renderPartPreview(type, canvas);
      el.append(canvas);
    }
  }

  private changed(): void {
    this.notify();
    this.save();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn(this.current));
  }

  private load(): Slot[] {
    const fallback: Slot[] = Array.from({ length: HOTBAR.slots }, (_, i) => HOTBAR.defaultParts[i] ?? null);
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE.hotbarKey) ?? 'null') as { slots?: unknown[]; selected?: number } | null;
      if (!data || !Array.isArray(data.slots)) return fallback;
      if (typeof data.selected === 'number' && data.selected >= 0 && data.selected < HOTBAR.slots) this.selected = data.selected;
      return Array.from({ length: HOTBAR.slots }, (_, i) => (isPartType(data.slots![i]) ? (data.slots![i] as PartType) : null));
    } catch {
      return fallback;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE.hotbarKey, JSON.stringify({ slots: this.slots, selected: this.selected }));
    } catch {
      /* storage unavailable */
    }
  }
}

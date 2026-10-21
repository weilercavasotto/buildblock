import { DRAG, SIZE } from '../constants';
import { PartType } from '../types';
import { createPreviewCanvas, renderPartPreview } from './part-preview';

/** What is being dragged: a part from the catalog, or the part of a hotbar slot. */
export interface DragSource {
  type: PartType;
  /** Set when the drag starts from a hotbar slot. */
  slot?: number;
}

export interface DragOptions {
  /** The thing to drag, or null when there is nothing (an empty slot). */
  source(): DragSource | null;
  /** Canvas whose picture follows the pointer. */
  image(): HTMLCanvasElement | null;
  /** Called for a press-and-release without dragging (also for keyboard activation). */
  onClick?(): void;
  /** Called when a drag ends: `slot` is the hotbar slot under the pointer, or null when dropped elsewhere. */
  onDrop(source: DragSource, slot: number | null): void;
}

/** Hotbar slots are the drop targets: elements carrying `data-slot="<index>"`. */
const slotAt = (x: number, y: number): HTMLElement | null =>
  (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-slot]') ?? null;

/**
 * Pointer-based drag & drop (not the HTML5 API, which is flaky with canvases and touch). A press that moves more than
 * `DRAG.threshold` px becomes a drag with a ghost image following the pointer and the slot under it highlighted
 * (`.drop-hover`); releasing over a slot drops there. Without movement it is a click.
 */
export function enableDrag(el: HTMLElement, options: DragOptions): void {
  let suppressClick = false;
  el.style.touchAction = 'none';

  el.addEventListener('click', () => {
    if (!suppressClick) options.onClick?.();
  });

  el.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    const source = options.source();
    if (!source) return;

    let ghost: HTMLElement | null = null;
    let hover: HTMLElement | null = null;

    const move = (e: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < DRAG.threshold) return;
        ghost = makeGhost(source.type, options.image());
        document.body.append(ghost);
        document.body.classList.add('dragging');
      }
      ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      const target = slotAt(e.clientX, e.clientY);
      if (target !== hover) {
        hover?.classList.remove('drop-hover');
        target?.classList.add('drop-hover');
        hover = target;
      }
    };

    const end = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!ghost) return; // no drag: the click handler takes care of it
      suppressClick = true;
      setTimeout(() => (suppressClick = false));
      ghost.remove();
      hover?.classList.remove('drop-hover');
      document.body.classList.remove('dragging');
      const target = e.type === 'pointercancel' ? null : slotAt(e.clientX, e.clientY);
      options.onDrop(source, target ? Number(target.dataset.slot) : null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}

/** The picture that follows the pointer: the part drawn afresh at the ghost's size (a hotbar slot's own canvas is too small to scale up), or a copy of `image` if that fails. */
function makeGhost(type: PartType, image: HTMLCanvasElement | null): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  try {
    const canvas = createPreviewCanvas(SIZE.dragGhost);
    renderPartPreview(type, canvas);
    ghost.append(canvas);
  } catch {
    if (image) {
      const copy = document.createElement('canvas');
      copy.width = image.width;
      copy.height = image.height;
      copy.getContext('2d')!.drawImage(image, 0, 0);
      ghost.append(copy);
    }
  }
  return ghost;
}

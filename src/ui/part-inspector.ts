import { PART_CATEGORIES, PART_INFO, PREVIEW, SIZE, TEXT } from '../constants';
import { Grid } from '../build/grid';
import { Part, Vec3, partRotation, subVec, wheelAxle } from '../types';
import { createPreviewCanvas, renderPartPreview, startSpin } from './part-preview';

export interface InspectorHandlers {
  onRemove(part: Part): void;
  onClose(): void;
}

const AXES = ['X', 'Y', 'Z'];
const coords = (cell: Vec3): string => cell.join(', ');

/**
 * Panel on the right of the screen that shows the part selected in inspect mode: a spinning preview, what it is, where
 * it is and how it is connected (rigid body size, mounted wheels / host block), its properties, and a button to remove
 * it. It is refreshed by `show()` whenever the selection or the grid changes. All text is set with `textContent`.
 */
export class PartInspector {
  private root = document.getElementById('part-inspector')!;
  private stopSpin: (() => void) | null = null;

  constructor(
    private grid: Grid,
    private handlers: InspectorHandlers,
  ) {}

  /** Shows the panel for `part`, or hides it when null. */
  show(part: Part | null): void {
    this.stopSpin?.();
    this.stopSpin = null;
    this.root.hidden = part === null;
    if (!part) return;

    const info = PART_INFO[part.type];
    const header = el('div', 'help-header');
    const title = text('h2', 'dialog-title', TEXT.inspector.title);
    const close = text('button', 'help-close', '×') as HTMLButtonElement;
    close.type = 'button';
    close.title = TEXT.inspector.close;
    close.setAttribute('aria-label', TEXT.inspector.close);
    close.onclick = () => this.handlers.onClose();
    header.append(title, close);

    const canvas = createPreviewCanvas(SIZE.partInspectorPreview);
    renderPartPreview(part.type, canvas);
    this.stopSpin = startSpin(part.type, canvas, PREVIEW.inspectSpinSpeed, false);

    const remove = text('button', 'catalog-action danger', TEXT.inspector.remove) as HTMLButtonElement;
    remove.type = 'button';
    remove.onclick = () => this.handlers.onRemove(part);

    // Preview beside the name: saves height, so the position / connection rows are visible without scrolling.
    const summary = el('div', 'inspector-summary');
    const identity = el('div', 'inspector-identity');
    identity.append(
      text('h3', 'inspector-name', info.name),
      text('span', 'inspector-chip', PART_CATEGORIES.find((c) => c.id === info.category)?.title ?? info.category),
    );
    summary.append(canvas, identity);

    this.root.replaceChildren(
      header,
      summary,
      remove,
      text('h4', 'inspector-heading', TEXT.inspector.thisPart),
      this.rows(this.placedRows(part)),
      text('h4', 'inspector-heading', TEXT.catalog.properties),
      this.rows(info.properties.map(({ label, value }) => [label, value] as [string, string])),
      text('p', 'inspector-status', TEXT.inspector.removeHint),
    );
  }

  /** Label / value rows that depend on where this particular part is. */
  private placedRows(part: Part): Array<[string, string]> {
    const rows: Array<[string, string]> = [
      [TEXT.inspector.position, coords(part.cell)],
      [TEXT.inspector.rotation, TEXT.inspector.degrees(partRotation(part))],
    ];
    if (part.type === 'block') {
      rows.push([TEXT.inspector.rigidBody, TEXT.inspector.blocks(this.grid.connectedBlocks(part.cell))]);
      rows.push([TEXT.inspector.wheelsAttached, String(this.grid.wheelsOn(part.cell).length)]);
    } else if (part.face) {
      rows.push([TEXT.inspector.mountedOn, `block at ${coords(subVec(part.cell, part.face))}`]);
      rows.push([TEXT.inspector.axle, TEXT.inspector.axis(AXES[wheelAxle(part).findIndex((v) => v !== 0)])]);
    }
    return rows;
  }

  private rows(rows: Array<[string, string]>): HTMLElement {
    const list = el('dl', 'inspector-props');
    for (const [label, value] of rows) list.append(text('dt', '', label), text('dd', '', value));
    return list;
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function text(tag: string, className: string, content: string): HTMLElement {
  const node = el(tag, className);
  node.textContent = content;
  return node;
}

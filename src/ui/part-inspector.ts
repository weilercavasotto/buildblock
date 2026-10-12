import { PAINT_COLORS, PART_CATEGORIES, PART_INFO, PREVIEW, SIZE, SUSPENSION, TEXT, TIRE, WEIGHT, suspensionOf, tireValueOf, weightOf } from '../constants';
import { Grid } from '../build/grid';
import { Part, Vec3, partCells, partRotation, subVec, wheelAxle } from '../types';
import { createPreviewCanvas, renderPartPreview, startSpin } from './part-preview';

export interface InspectorHandlers {
  onRemove(part: Part): void;
  /** Sets the suspension strength (0-100) of a wheel. */
  onSuspension(part: Part, strength: number): void;
  /** Sets the tire (0 speed tires … 100 traction tires, see `TIRE`) of a wheel, or of all the wheels on its body with `wholeBody`. */
  onTire(part: Part, tire: number, wholeBody: boolean): void;
  /** Sets the weight (an integer, see `WEIGHT`) of a block, or of all the blocks welded to it with `connected`. */
  onWeight(part: Part, weight: number, connected: boolean): void;
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
    renderPartPreview(part.type, canvas, undefined, { color: part.color });
    this.stopSpin = startSpin(part.type, canvas, PREVIEW.inspectSpinSpeed, false, { color: part.color });

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

    // The header (title + close button) stays put; only the body below it scrolls.
    const body = el('div', 'inspector-body');
    body.append(
      summary,
      remove,
      ...this.tireSection(part),
      ...this.weightSection(part),
      ...this.suspensionSection(part),
      text('h4', 'inspector-heading', TEXT.inspector.thisPart),
      this.rows(this.placedRows(part)),
      text('h4', 'inspector-heading', TEXT.catalog.properties),
      this.rows(info.properties.map(({ label, value }) => [label, value] as [string, string])),
      text('p', 'inspector-status', TEXT.inspector.removeHint),
    );
    this.root.replaceChildren(header, body);
  }

  /** Tire slider (wheels only): from speed tires to traction tires; also only changed here, the catalog lists the property. */
  private tireSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasTire) return [];
    const wheels = this.grid.wheelsOnBody(part.cell).length;
    return this.sliderSection({
      heading: TEXT.inspector.tire,
      min: TIRE.min,
      max: TIRE.max,
      step: TIRE.step,
      value: tireValueOf(part),
      defaultValue: TIRE.default,
      low: TEXT.inspector.tireSpeed,
      high: TEXT.inspector.tireTraction,
      hint: TEXT.inspector.tireHint,
      onCommit: (value) => this.handlers.onTire(part, value, false),
      applyAll: wheels > 1 ? { label: TEXT.inspector.tireApplyAll(wheels), run: () => this.handlers.onTire(part, tireValueOf(part), true) } : undefined,
    });
  }

  /** Suspension slider (wheels only; it is the only place to change it, the catalog just lists the property). */
  private suspensionSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasSuspension) return [];
    return this.sliderSection({
      heading: TEXT.inspector.suspension,
      min: SUSPENSION.min,
      max: SUSPENSION.max,
      step: SUSPENSION.step,
      value: suspensionOf(part),
      defaultValue: SUSPENSION.defaultStrength,
      low: TEXT.inspector.suspensionSoft,
      high: TEXT.inspector.suspensionFirm,
      hint: TEXT.inspector.suspensionHint,
      onCommit: (value) => this.handlers.onSuspension(part, value),
    });
  }

  /** Weight slider (blocks only), with a shortcut to give the same weight to every block welded to this one. */
  private weightSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasWeight) return [];
    const connected = this.grid.connectedBlocks(part.cell);
    return this.sliderSection({
      heading: TEXT.inspector.weight,
      min: WEIGHT.min,
      max: WEIGHT.max,
      step: WEIGHT.step,
      value: weightOf(part),
      defaultValue: WEIGHT.default,
      low: TEXT.inspector.weightLight,
      high: TEXT.inspector.weightHeavy,
      hint: TEXT.inspector.weightHint,
      onCommit: (value) => this.handlers.onWeight(part, value, false),
      applyAll: connected > 1 ? { label: TEXT.inspector.weightApplyAll(connected), run: () => this.handlers.onWeight(part, weightOf(part), true) } : undefined,
    });
  }

  /**
   * A heading, a slider with its value, the labels of its ends (with a button that restores the default value in
   * between) and a hint. The value follows the slider while it moves; the change (one undo step) is made on release.
   */
  private sliderSection(o: {
    heading: string;
    min: number;
    max: number;
    step: number;
    value: number;
    defaultValue: number;
    low: string;
    high: string;
    hint: string;
    onCommit(value: number): void;
    /** Optional button below the slider that applies the current value to the related parts (see `Grid.setWeight` / `setTire`). */
    applyAll?: { label: string; run(): void };
  }): HTMLElement[] {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'slider-input';
    slider.min = String(o.min);
    slider.max = String(o.max);
    slider.step = String(o.step);
    slider.value = String(o.value);
    slider.setAttribute('aria-label', o.heading);
    const readout = text('span', 'slider-value', String(o.value));
    slider.oninput = () => (readout.textContent = slider.value);
    slider.onchange = () => o.onCommit(Number(slider.value));

    const reset = text('button', 'slider-reset', TEXT.inspector.defaultValue) as HTMLButtonElement;
    reset.type = 'button';
    reset.hidden = o.value === o.defaultValue;
    reset.onclick = () => o.onCommit(o.defaultValue);

    const row = el('div', 'slider-row');
    row.append(slider, readout);
    const ends = el('div', 'slider-ends');
    ends.append(text('span', '', o.low), reset, text('span', '', o.high));
    const all: HTMLElement[] = [];
    if (o.applyAll) {
      const apply = text('button', 'catalog-action', o.applyAll.label) as HTMLButtonElement;
      apply.type = 'button';
      apply.onclick = o.applyAll.run;
      all.push(apply);
    }
    return [text('h4', 'inspector-heading', o.heading), row, ends, ...all, text('p', 'inspector-status', o.hint)];
  }

  /** Label / value rows that depend on where this particular part is. */
  private placedRows(part: Part): Array<[string, string]> {
    const rows: Array<[string, string]> = [[TEXT.inspector.position, coords(part.cell)]];
    // A large wheel's axle is fixed (its rotation only picks a side), so a rotation in degrees would mislead.
    if (part.type !== 'bigWheel') rows.push([TEXT.inspector.rotation, TEXT.inspector.degrees(partRotation(part))]);
    else rows.push([TEXT.inspector.occupies, TEXT.inspector.cells(partCells(part).length)]);
    if (part.type === 'block') {
      rows.push([TEXT.inspector.color, PAINT_COLORS.find((c) => c.hex.toLowerCase() === part.color)?.name ?? TEXT.inspector.defaultColor]);
      rows.push([TEXT.inspector.weight, String(weightOf(part))]);
      rows.push([TEXT.inspector.rigidBody, TEXT.inspector.blocks(this.grid.connectedBlocks(part.cell))]);
      rows.push([TEXT.inspector.bodyWeight, String(this.grid.connectedWeight(part.cell))]);
      rows.push([TEXT.inspector.wheelsAttached, String(this.grid.wheelsOn(part.cell).length)]);
    } else if (part.face) {
      rows.push([TEXT.inspector.mountedOn, `block at ${coords(subVec(part.cell, part.face))}`]);
      rows.push([TEXT.inspector.tire, String(tireValueOf(part))]);
      rows.push([TEXT.inspector.suspension, TEXT.inspector.suspensionValue(suspensionOf(part))]);
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

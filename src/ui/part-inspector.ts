import { MOVE_ICONS, PISTON, ROTOR, BRAKE, PAINT_COLORS, PART_CATEGORIES, PART_INFO, ENGINE, PREVIEW, SIZE, SUSPENSION, TEXT, TIRE, WEIGHT, brakeOf, powerOf, rotorSpeedOf, strokeOf, suspensionOf, tireValueOf, weightOf } from '../constants';
import { MoveDirection } from '../build/build-mode';
import { Grid } from '../build/grid';
import { Part, Vec3, axleOf, frontOf, isHostType, isStructural, partCells, studsOf, subVec } from '../types';
import { createPreviewCanvas, renderPartPreview, startSpin } from './part-preview';

export interface InspectorHandlers {
  onRemove(part: Part): void;
  /** Removes every part of a multiple selection in one undo step. */
  onRemoveMany(parts: ReadonlyArray<Part>): void;
  /** Moves the whole selection one step in a direction seen from the camera. */
  onMove(direction: MoveDirection): void;
  /** Sets the suspension strength (0-100) of a wheel. */
  onSuspension(part: Part, strength: number): void;
  /** Sets the tire (0 speed tires … 100 traction tires, see `TIRE`) of a wheel, or of all the wheels on its body with `wholeBody`. */
  onTire(part: Part, tire: number, wholeBody: boolean): void;
  /** Sets the weight (an integer, see `WEIGHT`) of a block, or of all the blocks welded to it with `connected`. */
  onWeight(part: Part, weight: number, connected: boolean): void;
  /** Sets the speed (an integer, the sign is the direction, see `ROTOR`) of a rotor. */
  onSpeed(part: Part, speed: number): void;
  /** Sets how far a piston goes out (steps of half a cell, see `PISTON`). */
  onStroke(part: Part, stroke: number): void;
  /** Sets the power (an integer, see `ENGINE`) of an engine, or of all the engines on its body with `connected`. */
  onPower(part: Part, power: number, connected: boolean): void;
  /** Fits a brake of the given strength to a wheel (or takes it off with null), or to every braked wheel on its body with `wholeBody`. */
  onBrake(part: Part, strength: number | null, wholeBody: boolean): void;
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

  /** Shows the panel for the selection: the details of a single part, a summary of several, or hides it when empty. */
  show(parts: ReadonlyArray<Part>): void {
    this.stopSpin?.();
    this.stopSpin = null;
    this.root.hidden = parts.length === 0;
    if (parts.length === 0) return;
    if (parts.length > 1) return this.showMany(parts);
    const part = parts[0];

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
      ...this.brakeSection(part),
      ...this.powerSection(part),
      ...this.speedSection(part),
      ...this.strokeSection(part),
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

  /** A multiple selection: how many parts of each kind, and one button that removes them all. */
  private showMany(parts: ReadonlyArray<Part>): void {
    const header = el('div', 'help-header');
    const close = text('button', 'help-close', '×') as HTMLButtonElement;
    close.type = 'button';
    close.title = TEXT.inspector.close;
    close.setAttribute('aria-label', TEXT.inspector.close);
    close.onclick = () => this.handlers.onClose();
    header.append(text('h2', 'dialog-title', TEXT.inspector.title), close);

    const counts = new Map<string, number>();
    for (const part of parts) counts.set(part.type, (counts.get(part.type) ?? 0) + 1);
    const remove = text('button', 'catalog-action danger', TEXT.inspector.removeMany(parts.length)) as HTMLButtonElement;
    remove.type = 'button';
    remove.onclick = () => this.handlers.onRemoveMany(parts);

    const body = el('div', 'inspector-body');
    body.append(
      text('h3', 'inspector-name', TEXT.inspector.selectedCount(parts.length)),
      remove,
      text('h4', 'inspector-heading', TEXT.inspector.move),
      this.movePad(),
      text('p', 'inspector-status', TEXT.inspector.moveHint),
      this.mouseMoves(),
      this.rows([...counts].map(([type, n]) => [PART_INFO[type as keyof typeof PART_INFO].name, String(n)] as [string, string])),
      text('p', 'inspector-status', TEXT.inspector.removeHint),
      text('p', 'inspector-status', TEXT.inspector.multiHint),
    );
    this.root.replaceChildren(header, body);
  }

  /** How to move the selection with the mouse, as a highlighted box of key caps (Shift = up and down must be hard to miss). */
  private mouseMoves(): HTMLElement {
    const box = el('div', 'move-mouse');
    box.append(text('h4', 'inspector-heading', TEXT.inspector.moveMouseHeading));
    for (const row of TEXT.inspector.moveMouse) {
      const line = el('div', 'move-mouse-row');
      const keys = el('span', 'move-mouse-keys');
      row.keys.forEach((key, i) => {
        if (i > 0) keys.append(text('span', 'help-or', '+'));
        keys.append(text('kbd', '', key));
      });
      line.append(keys, text('span', 'move-mouse-text', row.text));
      box.append(line);
    }
    return box;
  }

  /** The buttons that move the selection: up / forward / down above left / back / right. */
  private movePad(): HTMLElement {
    const pad = el('div', 'move-pad');
    for (const direction of ['up', 'forward', 'down', 'left', 'back', 'right'] as const) {
      const button = el('button', 'catalog-action') as HTMLButtonElement;
      button.type = 'button';
      // An arrow instead of the name; the tooltip and aria-label still say it.
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) icon.setAttribute(name, value);
      icon.innerHTML = MOVE_ICONS[direction]; // trusted constant (src/constants/cursor-modes.ts)
      button.append(icon);
      button.title = TEXT.inspector.moveLabels[direction];
      button.setAttribute('aria-label', TEXT.inspector.moveLabels[direction]);
      button.onclick = () => this.handlers.onMove(direction);
      pad.append(button);
    }
    return pad;
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

  /** Brake of a wheel that has one: a strength slider (with "apply to the other braked wheels") and a button that takes the brake off. */
  private brakeSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasBrake || brakeOf(part) === 0) return [];
    const braked = this.grid.wheelsOnBody(part.cell).filter((w) => brakeOf(w) > 0).length;
    const t = TEXT.inspector;
    const remove = text('button', 'catalog-action', t.brakeRemove) as HTMLButtonElement;
    remove.type = 'button';
    remove.onclick = () => this.handlers.onBrake(part, null, false);
    return [
      ...this.sliderSection({
        heading: t.brake,
        min: BRAKE.min,
        max: BRAKE.max,
        step: BRAKE.step,
        value: brakeOf(part),
        defaultValue: BRAKE.default,
        low: t.brakeLow,
        high: t.brakeHigh,
        hint: t.brakeHint,
        onCommit: (value) => this.handlers.onBrake(part, value, false),
        applyAll: braked > 1 ? { label: t.brakeApplyAll(braked), run: () => this.handlers.onBrake(part, brakeOf(part), true) } : undefined,
      }),
      remove,
    ];
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

  /** Power slider (engines) or boost slider (turbos), with a shortcut to give the same value to every part of its kind on this body. */
  private powerSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasPower) return [];
    const turbo = part.type === 'turbo';
    const thruster = part.type === 'thruster';
    const engines = this.grid.mountedOfTypeOnBody(part.cell, part.type).length;
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: thruster ? t.thrust : turbo ? t.boost : t.power,
      min: ENGINE.min,
      max: ENGINE.max,
      step: ENGINE.step,
      value: powerOf(part),
      defaultValue: ENGINE.default,
      low: thruster ? t.thrustLow : turbo ? t.boostLow : t.powerLow,
      high: thruster ? t.thrustHigh : turbo ? t.boostHigh : t.powerHigh,
      hint: thruster ? t.thrustHint : turbo ? t.boostHint : t.powerHint,
      onCommit: (value) => this.handlers.onPower(part, value, false),
      applyAll: engines > 1 ? { label: thruster ? t.thrustApplyAll(engines) : turbo ? t.boostApplyAll(engines) : t.powerApplyAll(engines), run: () => this.handlers.onPower(part, powerOf(part), true) } : undefined,
    });
  }

  /** Speed slider of a rotor: from counter-clockwise to clockwise, 0 holding the head still. */
  private speedSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasSpeed) return [];
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.speed,
      min: -ROTOR.max,
      max: ROTOR.max,
      step: ROTOR.step,
      value: rotorSpeedOf(part),
      defaultValue: ROTOR.default,
      low: t.speedLow,
      high: t.speedHigh,
      hint: t.speedHint,
      onCommit: (value) => this.handlers.onSpeed(part, value),
    });
  }

  /** Stroke slider of a piston: how far its head goes out, in half cells. */
  private strokeSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasStroke) return [];
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.stroke,
      min: PISTON.min,
      max: PISTON.max,
      step: PISTON.step,
      value: strokeOf(part),
      defaultValue: PISTON.default,
      low: t.strokeLow,
      high: t.strokeHigh,
      hint: t.strokeHint,
      onCommit: (value) => this.handlers.onStroke(part, value),
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
    // The yellow part of the track (see the sliders in main.css).
    const fill = () => slider.style.setProperty('--fill', String((Number(slider.value) - o.min) / (o.max - o.min)));
    fill();
    slider.oninput = () => {
      readout.textContent = slider.value;
      fill();
    };
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
      const apply = text('button', 'catalog-action primary', o.applyAll.label) as HTMLButtonElement;
      apply.type = 'button';
      apply.onclick = o.applyAll.run;
      all.push(apply);
    }
    return [text('h4', 'inspector-heading', o.heading), row, ends, ...all, text('p', 'inspector-status', o.hint)];
  }

  /** Label / value rows that depend on where this particular part is. */
  private placedRows(part: Part): Array<[string, string]> {
    const rows: Array<[string, string]> = [[TEXT.inspector.position, coords(part.cell)]];
    if (part.type === 'bigWheel') rows.push([TEXT.inspector.occupies, TEXT.inspector.cells(partCells(part).length)]);
    else if (isStructural(part.type)) rows.push([TEXT.inspector.studs, TEXT.inspector.studsDirection(studsOf(part))]);
    if (isStructural(part.type)) {
      rows.push([TEXT.inspector.color, PAINT_COLORS.find((c) => c.hex.toLowerCase() === part.color)?.name ?? TEXT.inspector.defaultColor]);
      rows.push([TEXT.inspector.weight, String(weightOf(part))]);
      rows.push([TEXT.inspector.rigidBody, TEXT.inspector.blocks(this.grid.connectedBlocks(part.cell))]);
      rows.push([TEXT.inspector.bodyWeight, String(this.grid.connectedWeight(part.cell))]);
      if (isHostType(part.type)) rows.push([TEXT.inspector.wheelsAttached, String(this.grid.wheelsOn(part.cell).length)]);
    } else if (part.face) {
      const host = this.grid.hostOf(part);
      rows.push([TEXT.inspector.mountedOn, host ? `${PART_INFO[host.type].name} at ${coords(host.cell)}` : '-']);
      if (part.type === 'piston') {
        rows.push([TEXT.inspector.stroke, TEXT.inspector.strokeValue(strokeOf(part))]);
      } else if (part.type === 'rotor') {
        rows.push([TEXT.inspector.speed, TEXT.inspector.speedValue(rotorSpeedOf(part))]);
      } else if (part.type === 'engine') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontValue(frontOf(part))]);
        rows.push([TEXT.inspector.power, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyPower, TEXT.inspector.engines(this.grid.enginesOnBody(part.cell).length)]);
      } else if (part.type === 'thruster') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontValue(frontOf(part))]);
        rows.push([TEXT.inspector.thrust, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyThrusters, String(this.grid.thrustersOnBody(part.cell).length)]);
      } else if (part.type === 'turbo') {
        rows.push([TEXT.inspector.boost, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyTurbos, String(this.grid.turbosOnBody(part.cell).length)]);
      } else {
        rows.push([TEXT.inspector.tire, String(tireValueOf(part))]);
        rows.push([TEXT.inspector.brake, brakeOf(part) > 0 ? String(brakeOf(part)) : TEXT.inspector.brakeNone]);
        rows.push([TEXT.inspector.suspension, TEXT.inspector.suspensionValue(suspensionOf(part))]);
        rows.push([TEXT.inspector.axle, TEXT.inspector.axis(AXES[axleOf(part).findIndex((v) => v !== 0)])]);
      }
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
